const fs = require("fs");
const path = require("path");
const env = require("./env");
const session = require("./session");
const store = require("./store");
const { rebuild } = require("./rebuild");
const githubSync = require("./github-sync");

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "cache-control": "no-store",
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
      if (size > 4.5 * 1024 * 1024) {
        reject(new Error("payload too large (max 4.5MB)"));
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
    send(res, 401, { error: "Sign in with the authorized GitHub account." });
    return null;
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
      const body = await readBody(req);
      let code = String(body.passcode || "").trim();
      if (code.startsWith("$")) code = code.slice(1);
      const expected = String(env.adminPasscode || "abantika2026").trim();
      if (!code || code.toLowerCase() !== expected.toLowerCase()) {
        send(res, 401, { error: "Invalid secret passcode." });
        return true;
      }
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
        media: store.listMedia()
      });
      return true;
    }

    const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? await readBody(req) : {};

    async function saved(payload, { commitMessage, filePaths = [] } = {}) {
      send(res, 200, { ...payload, rebuilt: true, githubSync: { pending: true } });

      (async () => {
        try {
          await rebuild();
        } catch (err) {
          console.error("Rebuild error:", err);
        }
        if (githubSync.isConfigured() && filePaths.length) {
          try {
            const filesToCommit = filePaths.map((fp) => {
              const abs = path.isAbsolute(fp) ? fp : path.join(env.ROOT, fp);
              const rel = path.relative(env.ROOT, abs).replace(/\\/g, "/");

              const cachedBuf = store.getMediaBuffer ? store.getMediaBuffer(rel) : null;
              if (cachedBuf) {
                return { path: rel, content: cachedBuf.toString("base64"), isBase64: true };
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
            await githubSync.commitFiles(filesToCommit, commitMessage || "content: update site files");
          } catch (err) {
            console.error("GitHub Sync error:", err);
          }
        }
      })();
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
      await saved(resData, {
        commitMessage: `content: update project ${resData.title || slug}`,
        filePaths: [path.join("content", "projects", `${slug}.md`)]
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
      await saved(resData, {
        commitMessage: `blog: update ${resData.title || slug}`,
        filePaths: [path.join("content", "blog", `${slug}.md`)]
      });
      return true;
    }
    if (route === "POST /api/journal") {
      const resData = store.saveJournal(body, { isNew: true });
      await saved(resData, {
        commitMessage: `journal: add entry ${resData.date || body.date}`,
        filePaths: [path.join("content", "journal", `${resData.date || body.date}-${resData.slug || "note"}.md`)]
      });
      return true;
    }
    if (req.method === "PUT" && url.pathname.startsWith("/api/journal/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/journal/".length));
      const resData = store.saveJournal(body, { id });
      await saved(resData, {
        commitMessage: `journal: update ${id}`,
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
      send(res, 200, store.listMedia());
      return true;
    }
    if (route === "POST /api/media") {
      const resData = store.saveMedia(body);
      await saved(resData, {
        commitMessage: `media: add ${resData.name}`,
        filePaths: [path.join("src", "assets", "images", resData.folder, resData.name)]
      });
      return true;
    }
    if (route === "DELETE /api/media") {
      const resData = store.removeMedia(body);
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
