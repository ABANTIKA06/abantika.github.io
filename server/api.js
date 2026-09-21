const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const env = require("./env");
const session = require("./session");
const store = require("./store");
const { rebuild } = require("./rebuild");
const githubSync = require("./github-sync");
const r2 = require("./r2");

// --- RATE LIMITING & SECURITY BRUTE-FORCE PROTECTION ---
const failedAttempts = new Map(); // ip -> { count: number, resetTime: number }
const MAX_FAILED_ATTEMPTS = 5;
const BAN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes lockout

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket ? req.socket.remoteAddress || "127.0.0.1" : "127.0.0.1";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (!record) return { allowed: true, remaining: MAX_FAILED_ATTEMPTS };

  if (now > record.resetTime) {
    failedAttempts.delete(ip);
    return { allowed: true, remaining: MAX_FAILED_ATTEMPTS };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const remainingSeconds = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true, remaining: MAX_FAILED_ATTEMPTS - record.count };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, resetTime: now + BAN_WINDOW_MS };
  record.count += 1;
  record.resetTime = now + BAN_WINDOW_MS;
  failedAttempts.set(ip, record);
}

function resetFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

function timingSafeCompare(a, b) {
  const strA = String(a || "").toLowerCase();
  const strB = String(b || "").toLowerCase();
  const bufA = Buffer.from(strA);
  const bufB = Buffer.from(strB);

  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "cache-control": "no-store",
    "Access-Control-Allow-Origin": env.publicOrigin || "*",
    "Access-Control-Allow-Credentials": "true",
    ...headers
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 36 * 1024 * 1024) {
        reject(new Error("payload too large (max 25MB file)"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function origin(req) {
  const host = req.headers.host || `localhost:${env.port}`;
  const proto = req.headers["x-forwarded-proto"] || (env.publicOrigin.startsWith("https") ? "https" : "http");
  return env.publicOrigin || `${proto}://${host}`;
}

function currentUser(req) {
  const data = session.read(req);
  if (!data || !data.login) return null;
  if (data.passcode) return data;
  if (env.allowedGithubUser && data.login.toLowerCase() !== env.allowedGithubUser.toLowerCase()) return null;
  return data;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    send(res, 401, { error: "Sign in with the authorized account." });
    return null;
  }
  if (res && !res.headersSent) {
    try { session.write(res, user); } catch(e) {}
  }
  return user;
}

async function githubLogin(req, res) {
  if (!env.githubClientId || !env.githubClientSecret || !env.allowedGithubUser || !env.sessionSecret) {
    send(res, 503, {
      error: "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ALLOWED_GITHUB_USER, and SESSION_SECRET on the server."
    });
    return;
  }
  const state = session.randomState();
  session.write(res, { login: "oauth-pending", state });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.githubClientId);
  url.searchParams.set("redirect_uri", `${origin(req)}/api/auth/callback`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  res.statusCode = 302;
  res.setHeader("location", url.toString());
  res.end();
}

async function githubCallback(req, res) {
  const url = new URL(req.url, origin(req));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const pending = session.read(req);
  if (!code || !state || !pending || pending.state !== state) {
    send(res, 400, { error: "Invalid GitHub callback." });
    return;
  }
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
      redirect_uri: `${origin(req)}/api/auth/callback`
    })
  });
  const tokenBody = await tokenRes.json();
  if (!tokenBody.access_token) {
    send(res, 401, { error: "GitHub did not return an access token." });
    return;
  }
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenBody.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "abantika-admin"
    }
  });
  const user = await userRes.json();
  const login = String(user.login || "");
  if (!login || login.toLowerCase() !== env.allowedGithubUser.toLowerCase()) {
    session.clear(res);
    send(res, 403, { error: "This GitHub account is not allowlisted for publishing." });
    return;
  }
  session.write(res, { login });
  res.statusCode = 302;
  res.setHeader("location", "/admin/");
  res.end();
}

function devLogin(req, res) {
  if (!env.isLocalHost(req.headers.host)) {
    send(res, 403, { error: "Local development sign-in is only available on localhost." });
    return;
  }
  if (!env.adminDevLogin || !env.allowedGithubUser || !env.sessionSecret) {
    send(res, 503, { error: "ADMIN_DEV_LOGIN, ALLOWED_GITHUB_USER, and SESSION_SECRET must be set on the server." });
    return;
  }
  if (env.adminDevLogin.toLowerCase() !== env.allowedGithubUser.toLowerCase()) {
    send(res, 403, { error: "ADMIN_DEV_LOGIN must match ALLOWED_GITHUB_USER." });
    return;
  }
  session.write(res, { login: env.allowedGithubUser, dev: true });
  send(res, 200, { ok: true, login: env.allowedGithubUser });
}

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Allow-Credentials": "true"
    });
    res.end();
    return true;
  }

  const url = new URL(req.url, origin(req));
  const route = `${req.method} ${url.pathname}`;

  try {
    if (route === "GET /api/health") {
      send(res, 200, { ok: true });
      return true;
    }
    if (route === "GET /api/auth/config") {
      send(res, 200, {
        github: Boolean(env.githubClientId && env.githubClientSecret && env.allowedGithubUser && env.sessionSecret),
        dev: Boolean(env.adminDevLogin && env.sessionSecret && env.allowedGithubUser && env.isLocalHost(req.headers.host)),
        allowlistConfigured: Boolean(env.allowedGithubUser),
        githubSync: githubSync.isConfigured()
      });
      return true;
    }
    if (route === "GET /api/sync/status") {
      const status = await githubSync.getRepoStatus();
      send(res, 200, status);
      return true;
    }
    if (route === "GET /api/auth/github") {
      await githubLogin(req, res);
      return true;
    }
    if (route === "GET /api/auth/callback") {
      await githubCallback(req, res);
      return true;
    }
    if (route === "POST /api/auth/dev") {
      await readBody(req);
      devLogin(req, res);
      return true;
    }
    if (route === "POST /api/auth/passcode") {
      const clientIp = getClientIp(req);
      const rateCheck = checkRateLimit(clientIp);

      if (!rateCheck.allowed) {
        send(res, 429, {
          error: `Too many failed passcode attempts. IP temporarily locked out for ${rateCheck.remainingSeconds} seconds. Please try again later.`
        });
        return true;
      }

      const body = await readBody(req);
      let code = String(body.passcode || "").trim();
      if (code.startsWith("$")) code = code.slice(1);
      const expected = String(env.adminPasscode || "abantika2026").trim();

      const isValid = timingSafeCompare(code, expected);

      if (!isValid) {
        recordFailedAttempt(clientIp);
        // Delay response to defeat rapid automated brute-force scripts
        await new Promise((r) => setTimeout(r, 450));
        const updated = checkRateLimit(clientIp);
        send(res, 401, {
          error: "Invalid secret passcode.",
          remainingAttempts: Math.max(0, updated.remaining || 0)
        });
        return true;
      }

      // Success: clear rate limit record upon successful login
      resetFailedAttempts(clientIp);
      session.write(res, { login: env.allowedGithubUser || "admin", passcode: true });
      send(res, 200, { ok: true, login: env.allowedGithubUser || "admin" });
      return true;
    }
    if (route === "POST /api/auth/logout") {
      await readBody(req);
      session.clear(res);
      send(res, 200, { ok: true });
      return true;
    }
    if (route === "GET /api/session") {
      const user = currentUser(req);
      send(res, 200, user ? { login: user.login, dev: Boolean(user.dev) } : { login: null });
      return true;
    }

    if (!url.pathname.startsWith("/api/")) return false;
    const user = requireUser(req, res);
    if (!user) return true;

    if (route === "GET /api/overview") {
      send(res, 200, store.overview());
      return true;
    }
    if (route === "GET /api/content") {
      send(res, 200, {
        ...store.listAll(),
        notes: store.listNotes(),
        about: store.loadAbout(),
        skills: store.loadSkills(),
        settings: store.loadSettings(),
        media: await store.listMedia()
      });
      return true;
    }

    const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? await readBody(req) : {};

    async function saved(payload, { commitMessage, filePaths = [] } = {}) {
      // On Vercel serverless the process is terminated the moment we call send().
      // Any fire-and-forget async work after send() is silently killed before it
      // can finish. So we MUST commit to GitHub BEFORE sending the response.
      let syncResult = { pending: false };

      if (githubSync.isConfigured() && filePaths.length) {
        try {
          const filesToCommit = filePaths.map((fp) => {
            const abs = path.isAbsolute(fp) ? fp : path.join(env.ROOT, fp);
            const rel = path.relative(env.ROOT, abs).replace(/\\/g, "/");

            const cachedBuf = store.getMediaBuffer ? store.getMediaBuffer(rel) : null;
            if (cachedBuf) {
              return { path: rel, content: cachedBuf.toString("base64"), isBase64: true };
            }

            if (store.isVirtualDeleted && store.isVirtualDeleted(abs)) {
              return { path: rel, isDelete: true };
            }

            const virtContent = store.getVirtualFile ? store.getVirtualFile(abs) : null;
            if (virtContent !== null && virtContent !== undefined) {
              return { path: rel, content: virtContent };
            }

            if (!fs.existsSync(abs)) {
              return { path: rel, isDelete: true };
            }
            const ext = path.extname(abs).toLowerCase();
            const isBinary = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2"].includes(ext);
            if (isBinary) {
              const buf = fs.readFileSync(abs);
              return { path: rel, content: buf.toString("base64"), isBase64: true };
            } else {
              const text = fs.readFileSync(abs, "utf8");
              return { path: rel, content: text };
            }
          });
          syncResult = await githubSync.commitFiles(filesToCommit, commitMessage || "content: update site files");
        } catch (err) {
          console.error("GitHub Sync error:", err);
          syncResult = { error: err.message };
        }
      }

      // Send response AFTER GitHub sync so Vercel does not kill the process early
      send(res, 200, { ...payload, rebuilt: true, githubSync: syncResult });

      // Best-effort local rebuild (works in dev; silently ignored on Vercel read-only FS)
      rebuild().catch((err) => console.error("Rebuild error:", err));
    }

    if (route === "GET /api/notes") {
      send(res, 200, store.listNotes());
      return true;
    }
    if (route === "POST /api/notes") {
      const resData = store.saveNote(body);
      const slug = resData.slug || body.slug || "note";
      await saved(resData, {
        commitMessage: `note: save ${resData.title || slug}`,
        filePaths: [path.join("content", "notes", `${slug}.md`)]
      });
      return true;
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/notes/")) {
      const slug = decodeURIComponent(url.pathname.slice("/api/notes/".length));
      send(res, 200, store.getNote(slug));
      return true;
    }
    if (req.method === "PUT" && url.pathname.startsWith("/api/notes/")) {
      const slug = decodeURIComponent(url.pathname.slice("/api/notes/".length));
      const resData = store.saveNote({ ...body, slug });
      await saved(resData, {
        commitMessage: `note: update ${resData.title || slug}`,
        filePaths: [path.join("content", "notes", `${slug}.md`)]
      });
      return true;
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/api/notes/")) {
      const slug = decodeURIComponent(url.pathname.slice("/api/notes/".length));
      const resData = store.deleteNote(slug);
      await saved(resData, {
        commitMessage: `note: delete ${slug}`,
        filePaths: [path.join("content", "notes", `${slug}.md`)]
      });
      return true;
    }
    if (req.method === "POST" && url.pathname.includes("/promote") && url.pathname.startsWith("/api/notes/")) {
      const parts = url.pathname.slice("/api/notes/".length).split("/");
      const slug = decodeURIComponent(parts[0]);
      const resData = store.promoteNote({ slugOrFilename: slug, targetType: body.targetType });
      await saved(resData, {
        commitMessage: `note: promote ${slug} to ${body.targetType}`,
        filePaths: [path.join("content", "notes", `${slug}.md`), path.join("content", body.targetType === "blog" ? "blog" : "projects", `${resData.slug || slug}.md`)]
      });
      return true;
    }

    if (route === "POST /api/projects") {
      const resData = store.saveProject(body, { isNew: true });
      await saved(resData, {
        commitMessage: `content: publish project ${resData.title || resData.slug}`,
        filePaths: [path.join("content", "projects", `${resData.slug}.md`)]
      });
      return true;
    }
    if (req.method === "PUT" && url.pathname.startsWith("/api/projects/")) {
      const slug = decodeURIComponent(url.pathname.slice("/api/projects/".length));
      const resData = store.saveProject({ ...body, slug });
      const filePaths = [path.join("content", "projects", `${resData.slug || slug}.md`)];
      if (slug && resData.slug && slug !== resData.slug) {
        filePaths.push(path.join("content", "projects", `${slug}.md`));
      }
      await saved(resData, {
        commitMessage: `content: update project ${resData.title || slug}`,
        filePaths
      });
      return true;
    }
    if (route === "POST /api/blog") {
      const resData = store.saveBlog(body, { isNew: true });
      await saved(resData, {
        commitMessage: `blog: publish ${resData.title || resData.slug}`,
        filePaths: [path.join("content", "blog", `${resData.slug}.md`)]
      });
      return true;
    }
    if (req.method === "PUT" && url.pathname.startsWith("/api/blog/")) {
      const slug = decodeURIComponent(url.pathname.slice("/api/blog/".length));
      const resData = store.saveBlog({ ...body, slug });
      const filePaths = [path.join("content", "blog", `${resData.slug || slug}.md`)];
      if (slug && resData.slug && slug !== resData.slug) {
        filePaths.push(path.join("content", "blog", `${slug}.md`));
      }
      await saved(resData, {
        commitMessage: `blog: update ${resData.title || slug}`,
        filePaths
      });
      return true;
    }
    if (route === "POST /api/journal") {
      const resData = store.saveJournal(body, { isNew: true });
      await saved(resData, {
        commitMessage: `journal: add entry ${resData.date || body.date}`,
        filePaths: [path.join("content", "journal", `${resData.id}.md`)]
      });
      return true;
    }
    if (req.method === "PUT" && url.pathname.startsWith("/api/journal/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/journal/".length));
      const resData = store.saveJournal(body, { id });
      const filePaths = [path.join("content", "journal", `${resData.id || id}.md`)];
      if (id && resData.id && id !== resData.id) {
        filePaths.push(path.join("content", "journal", `${id}.md`));
      }
      await saved(resData, {
        commitMessage: `journal: update ${id}`,
        filePaths
      });
      return true;
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/api/projects/")) {
      const slug = decodeURIComponent(url.pathname.slice("/api/projects/".length));
      const resData = store.deleteProject(slug);
      await saved(resData, {
        commitMessage: `content: delete project ${slug}`,
        filePaths: [path.join("content", "projects", `${slug}.md`)]
      });
      return true;
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/api/blog/")) {
      const slug = decodeURIComponent(url.pathname.slice("/api/blog/".length));
      const resData = store.deleteBlog(slug);
      await saved(resData, {
        commitMessage: `blog: delete article ${slug}`,
        filePaths: [path.join("content", "blog", `${slug}.md`)]
      });
      return true;
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/api/journal/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/journal/".length));
      const resData = store.deleteJournal(id);
      await saved(resData, {
        commitMessage: `journal: delete entry ${id}`,
        filePaths: [path.join("content", "journal", `${id}.md`)]
      });
      return true;
    }
    if (route === "PUT /api/about") {
      const resData = store.saveAbout(body);
      await saved(resData, {
        commitMessage: "content: update about page",
        filePaths: [path.join("content", "about.md")]
      });
      return true;
    }
    if (route === "PUT /api/skills") {
      const resData = store.saveSkills(body);
      await saved(resData, {
        commitMessage: "skills: update skills",
        filePaths: [path.join("content", "skills.yml")]
      });
      return true;
    }
    if (route === "PUT /api/settings") {
      const resData = store.saveSettings(body);
      await saved(resData, {
        commitMessage: "settings: update site settings",
        filePaths: [path.join("content", "settings.yml")]
      });
      return true;
    }
    if (route === "GET /api/media") {
      const list = await store.listMedia();
      send(res, 200, list);
      return true;
    }
    if (route === "POST /api/r2-presign") {
      const presigned = await r2.getSignedUploadUrl({
        folder: body.folder || "about",
        filename: body.filename,
        contentType: body.contentType || "application/octet-stream"
      });
      if (!presigned) {
        send(res, 503, { error: "Cloudflare R2 storage is not configured." });
        return true;
      }
      send(res, 200, presigned);
      return true;
    }
    if (route === "POST /api/media-chunk") {
      const { uploadId, folder, filename, chunkIndex, totalChunks, data } = body;
      if (!uploadId || !filename || data === undefined) {
        send(res, 400, { error: "Invalid chunk payload" });
        return true;
      }

      global.chunkBufferCache = global.chunkBufferCache || new Map();
      let session = global.chunkBufferCache.get(uploadId);
      if (!session) {
        session = { folder: folder || "about", filename, totalChunks, chunks: new Array(totalChunks), received: 0 };
        global.chunkBufferCache.set(uploadId, session);
      }

      const buf = Buffer.from(String(data || "").replace(/^data:[^;]+;base64,/, ""), "base64");
      session.chunks[chunkIndex] = buf;
      session.received += 1;

      if (session.received >= totalChunks) {
        global.chunkBufferCache.delete(uploadId);
        const completeBuffer = Buffer.concat(session.chunks);
        const resData = await store.saveMediaBuffer({ folder: session.folder, filename: session.filename, buffer: completeBuffer });
        await saved(resData, {
          commitMessage: `media: add ${resData.name}`,
          filePaths: [path.join("src", "assets", "images", resData.folder, resData.name)]
        });
        return true;
      }

      send(res, 200, { ok: true, received: session.received, totalChunks });
      return true;
    }
    if (route === "POST /api/media") {
      const resData = await store.saveMedia(body);
      await saved(resData, {
        commitMessage: `media: add ${resData.name}`,
        filePaths: [path.join("src", "assets", "images", resData.folder, resData.name)]
      });
      return true;
    }
    if (route === "POST /api/resume") {
      if (!body.data) {
        send(res, 400, { error: "Missing PDF file data." });
        return true;
      }
      const buf = Buffer.from(String(body.data || "").replace(/^data:[^;]+;base64,/, ""), "base64");
      const resData = await store.saveResumeBuffer(buf);
      await saved(resData, {
        commitMessage: "content: update resume PDF (Abantika_Resume.pdf)",
        filePaths: [path.join("src", "assets", "Abantika_Resume.pdf")]
      });
      return true;
    }
    if (route === "DELETE /api/media") {
      const resData = await store.removeMedia(body);
      await saved(resData, {
        commitMessage: `media: remove ${body.filename}`,
        filePaths: [path.join("src", "assets", "images", body.folder, body.filename)]
      });
      return true;
    }

    send(res, 404, { error: "Unknown admin endpoint." });
    return true;
  } catch (err) {
    send(res, 400, { error: err.message || "Request failed." });
    return true;
  }
}

module.exports = { handle };
