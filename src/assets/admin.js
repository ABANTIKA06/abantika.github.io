(function () {
  const app = document.getElementById("admin-app");
  if (!app) return;

  const state = { user: null, config: {}, content: null, message: "", error: "" };

  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  async function api(path, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(path, {
        credentials: "include",
        signal: controller.signal,
        headers: { "content-type": "application/json", ...(opts.headers || {}) },
        ...opts,
        body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    } catch(err) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw err;
    }
  }

  function convertToWebp(file, maxDimension = 1440, quality = 0.80) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file provided."));
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        reject(new Error("File exceeds 25MB limit."));
        return;
      }
      const sanitizeName = (name) => String(name || "").split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, "-") || `upload-${Date.now()}`;

      const isRasterImage = file.type && file.type.startsWith("image/") && !file.type.includes("svg");
      if (isRasterImage) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          let webpDataUrl = "";
          try {
            webpDataUrl = canvas.toDataURL("image/webp", quality);
          } catch(e) {}
          if (webpDataUrl && webpDataUrl.startsWith("data:image/webp")) {
            const baseName = sanitizeName(file.name.replace(/\.[^/.]+$/, ""));
            resolve({ dataUrl: webpDataUrl, filename: `${baseName}.webp` });
            return;
          }
          readRaw();
        };
        img.onerror = () => readRaw();
        img.src = url;
        return;
      }

      function readRaw() {
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: reader.result, filename: sanitizeName(file.name) });
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      }
      readRaw();
    });
  }

  function hash() {
    return location.hash.replace(/^#/, "") || "/";
  }

  function go(path) {
    location.hash = path;
  }

  function askCommit({ kicker, title, copy, confirmLabel, primary }) {
    return new Promise((resolve) => {
      document.querySelector(".admin-modal-root")?.remove();
      const root = document.createElement("div");
      root.className = "admin-modal-root";
      root.innerHTML = `
        <div class="admin-modal-backdrop" data-dismiss="true"></div>
        <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <p class="admin-kicker">${esc(kicker || "00 / CONFIRM")}</p>
          <h2 id="admin-modal-title">${esc(title)}<span class="red-stop">.</span></h2>
          <p>${esc(copy)}</p>
          <div class="admin-actions">
            <button type="button" class="admin-btn" data-commit="no">CANCEL</button>
            <button type="button" class="admin-btn ${primary ? "primary" : ""}" data-commit="yes">${esc(confirmLabel)} <b>→</b></button>
          </div>
        </div>`;
      const finish = (ok) => {
        document.removeEventListener("keydown", onKey);
        root.remove();
        resolve(ok);
      };
      const onKey = (event) => {
        if (event.key === "Escape") finish(false);
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        }
      };
      root.addEventListener("click", (event) => {
        if (event.target.closest("[data-dismiss]")) {
          finish(false);
          return;
        }
        const btn = event.target.closest("[data-commit]");
        if (!btn) return;
        finish(btn.getAttribute("data-commit") === "yes");
      });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(root);
      root.querySelector("[data-commit='yes']").focus();
    });
  }

  function commitPrompt(type, publishFlag, form) {
    const name = formValue(form, "title") || formValue(form, "name") || "this entry";
    const publishing =
      publishFlag === "true" ||
      (type === "journal" && Boolean(formValue(form, "published"))) ||
      ["about", "settings", "skills", "media-upload"].includes(type);
    if (type === "media-upload") {
      return {
        kicker: "07 / MEDIA",
        title: "UPLOAD IMAGE",
        copy: "This will process the image and save it to Cloudflare R2 media storage.",
        confirmLabel: "YES, UPLOAD",
        primary: true
      };
    }
    if (publishing && (type === "project" || type === "blog" || type === "journal")) {
      return {
        kicker: "00 / PUBLISH",
        title: "COMMIT PUBLISH",
        copy: `"${name}" will be written and the public website will rebuild. This cannot be undone except by editing again.`,
        confirmLabel: "YES, COMMIT",
        primary: true
      };
    }
    if (type === "project" || type === "blog" || type === "journal") {
      return {
        kicker: "00 / DRAFT",
        title: "COMMIT DRAFT",
        copy: `"${name}" will be saved as a draft. It will not appear on the public website.`,
        confirmLabel: "YES, COMMIT",
        primary: false
      };
    }
    return {
      kicker: "00 / CONFIRM",
      title: "COMMIT CHANGES",
      copy: "These edits will be written and the public website will rebuild.",
      confirmLabel: "YES, COMMIT",
      primary: true
    };
  }

  /** Show an inline status message in .admin-main without a full re-render */
  function showAdminMsg(text, isError = false) {
    state.message = text;
    let el = document.querySelector(".admin-main .admin-msg");
    if (!el) {
      el = document.createElement("p");
      el.className = "admin-msg";
      const main = document.querySelector(".admin-main");
      if (main) main.insertBefore(el, main.firstChild);
    }
    el.textContent = text;
    el.classList.toggle("error", isError);
  }

  function formValue(form, name) {
    const field = form.elements[name];
    if (!field) return "";
    if (field.type === "checkbox") return field.checked;
    return field.value;
  }

  function input(label, name, value, extra = "", isRequired = false) {
    const reqBadge = isRequired ? `<span class="req-star">*</span><span class="req-tag">REQUIRED</span>` : "";
    return `<label>${esc(label)}${reqBadge}<input name="${esc(name)}" value="${esc(value || "")}" ${extra}></label>`;
  }
  function area(label, name, value, cls = "", isRequired = false) {
    const reqBadge = isRequired ? `<span class="req-star">*</span><span class="req-tag">REQUIRED</span>` : "";
    return `
      <div class="wide area-wrapper" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <label style="margin:0">${esc(label)}${reqBadge}</label>
          <button type="button" class="wysiwyg-btn math-btn" data-area-cmd="math" title="Insert LaTeX Math" style="font-size:10px;padding:2px 8px;font-weight:700;color:var(--accent-red,#e03c31)">∑ LATEX MATH</button>
        </div>
        <textarea class="${cls}" name="${esc(name)}">${esc(value || "")}</textarea>
      </div>`;
  }
  function check(label, name, on) {
    return `<label class="admin-check"><input type="checkbox" name="${esc(name)}" ${on ? "checked" : ""}> ${esc(label)}</label>`;
  }
  function sel(label, name, value, options) {
    return `<label>${esc(label)}<select name="${esc(name)}">${options
      .map((opt) => `<option value="${esc(opt.value)}" ${opt.value === value ? "selected" : ""}>${esc(opt.label)}</option>`)
      .join("")}</select></label>`;
  }

  function htmlToMarkdown(node) {
    if (typeof node === "string") {
      const div = document.createElement("div");
      div.innerHTML = node;
      node = div;
    }
    let md = "";
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        md += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        const inner = htmlToMarkdown(child);
        if (tag === "b" || tag === "strong") {
          md += `**${inner.trim()}**`;
        } else if (tag === "i" || tag === "em") {
          md += `*${inner.trim()}*`;
        } else if (tag === "h1") {
          md += `\n# ${inner.trim()}\n\n`;
        } else if (tag === "h2") {
          md += `\n## ${inner.trim()}\n\n`;
        } else if (tag === "h3") {
          md += `\n### ${inner.trim()}\n\n`;
        } else if (tag === "p" || tag === "div") {
          md += `\n${inner.trim()}\n\n`;
        } else if (tag === "br") {
          md += "\n";
        } else if (tag === "ul") {
          md += `\n${inner.trim()}\n\n`;
        } else if (tag === "ol") {
          md += `\n${inner.trim()}\n\n`;
        } else if (tag === "li") {
          md += `- ${inner.trim()}\n`;
        } else if (tag === "blockquote") {
          md += `\n> ${inner.trim()}\n\n`;
        } else if (tag === "pre" || tag === "code") {
          md += `\n\`\`\`\n${inner.trim()}\n\`\`\`\n\n`;
        } else if (tag === "a") {
          const href = child.getAttribute("href") || "#";
          md += `[${inner.trim()}](${href})`;
        } else {
          md += inner;
        }
      }
    });
    return md.replace(/\n{3,}/g, "\n\n");
  }

  function markdownToHtml(mdText) {
    if (!mdText) return "";
    let html = esc(String(mdText));
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
    html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    html = html.replace(/\*(.*?)\*/g, "<i>$1</i>");
    html = html.replace(/^&gt; (.*$)/gim, "<blockquote>$1</blockquote>");
    html = html.replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>");
    html = html.replace(/```([\s\S]*?)```/g, "<pre>$1</pre>");
    html = html.replace(/^- (.*$)/gim, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/g, "<ul>$1</ul>");
    html = html.replace(/(<\/ul>\s*<ul>)/g, "");
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function syncWysiwyg(wrapper) {
    if (!wrapper) return;
    const editable = wrapper.querySelector(".wysiwyg-editable");
    const source = wrapper.querySelector(".wysiwyg-source");
    const activeTab = wrapper.querySelector(".wysiwyg-tab.active");
    const mode = activeTab ? activeTab.getAttribute("data-wysiwyg-mode") : "edit";
    if (mode === "edit" && editable && source) {
      source.value = htmlToMarkdown(editable).trim();
    }
  }

  function syncAllWysiwyg(container) {
    (container || document).querySelectorAll(".wysiwyg-wrapper").forEach(syncWysiwyg);
  }

  function wysiwygField(label, name, value, isRequired = false) {
    const reqBadge = isRequired ? `<span class="req-star">*</span><span class="req-tag">REQUIRED</span>` : "";
    const initialHtml = markdownToHtml(value || "");
    return `
      <div class="wide wysiwyg-wrapper" data-field="${esc(name)}">
        <div class="wysiwyg-mode-bar">
          <span class="wysiwyg-label">${esc(label)} ${reqBadge}</span>
          <div class="wysiwyg-tabs">
            <button type="button" class="wysiwyg-tab active" data-wysiwyg-mode="edit">EDIT (WYSIWYG)</button>
            <button type="button" class="wysiwyg-tab" data-wysiwyg-mode="source">SOURCE (MD)</button>
            <button type="button" class="wysiwyg-tab" data-wysiwyg-mode="preview">PREVIEW</button>
          </div>
        </div>
        <div class="wysiwyg-toolbar">
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="bold"><b>B</b></button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="italic"><i>I</i></button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="h1">H1</button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="h2">H2</button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="h3">H3</button>
          <span class="wysiwyg-sep"></span>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="ul">• LIST</button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="ol">1. LIST</button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="code">CODE</button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="quote">QUOTE</button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="hr">HR</button>
          <span class="wysiwyg-sep"></span>
          <button type="button" class="wysiwyg-btn wikilink-btn" data-wysiwyg-cmd="wikilink">[[ WIKILINK ]]</button>
          <button type="button" class="wysiwyg-btn math-btn" data-wysiwyg-cmd="math" title="Insert LaTeX Math Formula" style="font-weight:700;color:var(--accent-red,#e03c31)">∑ LATEX MATH</button>
          <button type="button" class="wysiwyg-btn" data-wysiwyg-cmd="image">🖼️ IMAGE</button>
        </div>
        <div class="wysiwyg-editor-area">
          <div class="wysiwyg-editable" contenteditable="true">${initialHtml}</div>
          <textarea class="wysiwyg-source tall" name="${esc(name)}" style="display:none">${esc(value || "")}</textarea>
          <div class="wysiwyg-preview-pane" style="display:none"></div>
        </div>
      </div>`;
  }

  function chrome(title, body) {
    const isCurrent = (path) => {
      if (path === "/" && hash() === "/") return true;
      if (path !== "/" && hash().startsWith(path)) return true;
      return false;
    };

    return `
      <header class="admin-header">
        <a class="admin-brand" href="#/">ABANTIKA<small>ADMIN / PRIVATE CONSOLE</small></a>
        <div class="admin-user desktop-only">
          <a href="/" class="admin-home-circle-btn" title="Return to Home Website" aria-label="Return to public portfolio homepage">
            <span class="circle-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </span>
            <span class="circle-btn-text">RETURN TO HOME</span>
          </a>
          <span>@${esc(state.user.login)}</span>
          <button class="admin-btn" data-act="logout" type="button">SIGN OUT</button>
        </div>
        <button type="button" class="mobile-menu-btn admin-mobile-toggle" id="admin-mobile-toggle-btn" aria-label="Toggle admin navigation menu" aria-expanded="false">
          <span class="menu-bar"></span>
          <span class="menu-bar"></span>
          <span class="menu-bar"></span>
        </button>
      </header>
      <nav class="admin-nav" id="admin-nav" aria-label="Admin">
        <div class="admin-nav-links">
          <a href="#/" class="${isCurrent("/") ? "active" : ""}"><i>01</i> HOME</a>
          <a href="#/about" class="${isCurrent("/about") ? "active" : ""}"><i>02</i> ABOUT</a>
          <a href="#/projects" class="${isCurrent("/projects") ? "active" : ""}"><i>03</i> PROJECTS</a>
          <a href="#/blog" class="${isCurrent("/blog") ? "active" : ""}"><i>04</i> BLOG</a>
          <a href="#/journal" class="${isCurrent("/journal") ? "active" : ""}"><i>05</i> JOURNAL</a>
          <a href="#/notes" class="${isCurrent("/notes") ? "active" : ""}"><i>06</i> NOTES</a>
          <a href="#/media" class="${isCurrent("/media") ? "active" : ""}"><i>07</i> MEDIA</a>
          <a href="#/settings" class="${isCurrent("/settings") ? "active" : ""}"><i>08</i> SETTINGS</a>
        </div>
        <div class="admin-user-mobile mobile-only">
          <span class="admin-mobile-username">LOGGED IN AS <b>@${esc(state.user.login)}</b></span>
          <div class="admin-mobile-actions">
            <a href="/" class="admin-home-circle-btn" title="Return to Home Website" aria-label="Return to public portfolio homepage">
              <span class="circle-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </span>
              <span class="circle-btn-text">RETURN TO HOME</span>
            </a>
            <button class="admin-btn danger" data-act="logout" type="button" style="justify-content:center;height:38px">SIGN OUT</button>
          </div>
        </div>
      </nav>
      <main class="admin-main">
        ${state.error ? `<p class="admin-msg error">${esc(state.error)}</p>` : ""}
        ${state.message ? `<p class="admin-msg">${esc(state.message)}</p>` : ""}
        <p class="admin-kicker">${esc(title)}</p>
        ${body}
      </main>`;
  }

  function gate() {
    return `
      <div class="admin-gate-top">
        <a href="/" class="admin-home-circle-btn" title="Return to Home Website" aria-label="Return to public portfolio homepage">
          <span class="circle-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </span>
          <span class="circle-btn-text">RETURN TO HOME</span>
        </a>
      </div>
      <div class="admin-gate">
        <p class="admin-kicker">00 / PRIVATE CONSOLE</p>
        <h1>ABANTIKA / ADMIN<span class="red-stop">.</span></h1>
        <p>Enter your secret access passcode to unlock the workspace console.</p>
        ${state.error ? `<p class="admin-msg error">${esc(state.error)}</p>` : ""}
        
        <form class="admin-form" data-form="passcode-login" style="max-width:380px;margin:24px 0">
          <label style="font:11px var(--mono)">SECRET ACCESS PASSCODE
            <input type="password" name="passcode" placeholder="Enter secret code..." required style="padding:10px;font-size:14px;background:#fff">
          </label>
          <button class="admin-btn primary" type="submit" style="width:100%;margin-top:10px">UNLOCK CONSOLE <b>→</b></button>
        </form>

        <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
          ${state.config.github ? `<a class="admin-btn" href="/api/auth/github">SIGN IN WITH GITHUB <b>→</b></a>` : ""}
          ${state.config.dev ? `<button class="admin-btn" data-act="dev" type="button">DEVELOPER LOCALHOST LOGIN <b>→</b></button>` : ""}
        </div>
      </div>`;
  }

  function dashboard(overview) {
    const syncWarning = !state.config.githubSync ? `
      <div style="border:2px solid var(--red);padding:16px 20px;margin-bottom:28px;background:#fff8f8">
        <p class="admin-kicker" style="color:var(--red);margin-bottom:6px">⚠ GITHUB SYNC NOT CONFIGURED</p>
        <p style="font:12px/1.6 var(--mono);margin:0">
          Saves are written to the server but <strong>the public website will NOT update</strong> because
          <code>GITHUB_TOKEN</code>, <code>GITHUB_REPO_OWNER</code>, and <code>GITHUB_REPO_NAME</code>
          are not set. Add these as environment variables in Vercel → Project Settings → Environment Variables,
          then redeploy. Until then, changes are lost when Vercel restarts the serverless function.
        </p>
      </div>` : `
      <div style="border:1px solid var(--line);padding:12px 16px;margin-bottom:28px;display:flex;align-items:center;gap:10px">
        <span style="color:#22a722;font:11px var(--mono)">✓ GITHUB SYNC ACTIVE</span>
        <span style="font:11px var(--mono);color:#888">— saves will commit to GitHub and trigger a Vercel redeploy automatically.</span>
      </div>`;
    return chrome(
      "01 / HOME",
      `<h1>CONSOLE<span class="red-stop">.</span></h1>
      ${syncWarning}
      <section class="admin-grid">
        <div class="admin-stat"><span>PROJECTS</span><strong>${overview.projects.published}</strong><p>${overview.projects.draft} DRAFT / ${overview.projects.total} TOTAL</p></div>
        <div class="admin-stat"><span>BLOG</span><strong>${overview.blog.published}</strong><p>${overview.blog.draft} DRAFT / ${overview.blog.total} TOTAL</p></div>
        <div class="admin-stat"><span>JOURNAL</span><strong>${overview.journal.total}</strong><p>${overview.journal.published} PUBLISHED / ${overview.journal.draft} DRAFT</p></div>
      </section>
      <p class="admin-kicker" style="margin-top:36px">LAST PUBLISHED</p>
      <p>${esc(overview.lastPublished || "—")}</p>`
    );
  }


  function rows(items, hrefFn, deleteType) {
    if (!items.length) return `<p>No entries yet.</p>`;
    return `<div class="admin-list">${items
      .map((item) => {
        const href = hrefFn(item);
        const label = item.title;
        const meta = item.date || item.number || "";
        const status = item.published ? "PUBLISHED" : "DRAFT";
        const key = item.slug || item.id || "";
        const deleteBtn = deleteType
          ? `<button type="button" class="admin-row-delete-btn" data-act="delete-${deleteType}" data-${deleteType === "journal" ? "id" : "slug"}="${esc(key)}" data-title="${esc(label)}" title="Delete item">✕</button>`
          : "";
        return `<div class="admin-row-wrapper"><a class="admin-row" href="${esc(href)}"><span>${esc(meta)}</span><b>${esc(label)}</b><span class="admin-badge ${item.published ? "published" : "draft"}">${status}</span><span>→</span></a>${deleteBtn}</div>`;
      })
      .join("")}</div>`;
  }

  function showProgressModal({ kicker, title, copy }) {
    document.querySelector(".admin-modal-root")?.remove();
    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.id = "admin-active-modal";
    root.innerHTML = `
      <div class="admin-modal-backdrop"></div>
      <div class="admin-modal" role="dialog" aria-modal="true">
        <p class="admin-kicker">${esc(kicker || "00 / REBUILDING")}</p>
        <h2 id="admin-modal-title">${esc(title)}<span class="red-stop">.</span></h2>
        <p>${esc(copy)}</p>
        <div class="admin-progress-container">
          <div class="admin-progress-track">
            <div class="admin-progress-bar" id="admin-pbar" style="width: 15%"></div>
          </div>
          <div class="admin-status-text">
            <span id="admin-pstatus">PROCESSING ASSET & SAVING MEDIA...</span>
            <span id="admin-ppercent">15%</span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    let pct = 15;
    const interval = setInterval(() => {
      if (pct < 85) {
        pct += Math.floor(Math.random() * 8) + 4;
        if (pct > 85) pct = 85;
      } else if (pct < 98) {
        pct += 1;
        const statusEl = document.getElementById("admin-pstatus");
        if (statusEl && pct > 88) {
          statusEl.textContent = "SAVING TO CLOUDFLARE R2 & MEDIA STORE...";
        }
      }
      const bar = document.getElementById("admin-pbar");
      const txt = document.getElementById("admin-ppercent");
      if (bar) bar.style.width = pct + "%";
      if (txt) txt.textContent = pct + "%";
    }, 40);
    const watchdogTimer = setTimeout(() => {
      clearInterval(interval);
      root.remove();
      alert("Save operation took longer than expected. Please check your connection or credentials.");
    }, 30000);

    return {
      finish: (successTitle, successCopy, viewUrl, isWarning = false, kicker = "") => {
        clearTimeout(watchdogTimer);
        clearInterval(interval);
        const bar = document.getElementById("admin-pbar");
        const txt = document.getElementById("admin-ppercent");
        const statusEl = document.getElementById("admin-pstatus");
        if (bar) bar.style.width = "100%";
        if (txt) txt.textContent = "100%";
        if (statusEl) statusEl.textContent = isWarning ? "SAVED LOCALLY" : "COMPLETE!";
        setTimeout(() => {
          showSuccessModal({
            kicker: kicker || (isWarning ? "00 / SYNC WARNING" : "00 / SUCCESSFUL"),
            title: successTitle || "PUBLISHED SUCCESSFULLY",
            copy: successCopy || "Changes committed and static site rebuilt.",
            viewUrl,
            isWarning
          });
        }, 200);
      },
      fail: (errMessage) => {
        clearTimeout(watchdogTimer);
        clearInterval(interval);
        root.remove();
        state.error = errMessage;
        let msgEl = document.querySelector(".admin-main .admin-msg.error");
        if (!msgEl) {
          msgEl = document.createElement("p");
          msgEl.className = "admin-msg error";
          const main = document.querySelector(".admin-main");
          if (main) main.insertBefore(msgEl, main.firstChild);
        }
        if (msgEl) msgEl.textContent = state.error;
      }
    };
  }

  function showSuccessModal({ kicker, title, copy, viewUrl, isWarning = false }) {
    document.querySelector(".admin-modal-root")?.remove();
    const root = document.createElement("div");
    root.className = "admin-modal-root";
    const iconHtml = isWarning
      ? `<div style="font-size:36px;line-height:1;margin-right:12px">⚠️</div>`
      : `<svg class="admin-tick-icon" viewBox="0 0 52 52">
            <circle class="admin-tick-circle" cx="26" cy="26" r="23" />
            <path class="admin-tick-check" d="M14 27 l7 7 l17 -17" />
          </svg>`;
    const titleColor = isWarning ? "color:var(--red)" : "";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal" role="dialog" aria-modal="true" style="${isWarning ? "border:2px solid var(--red)" : ""}">
        <div class="admin-tick-container">
          ${iconHtml}
          <div>
            <p class="admin-kicker" style="color:var(--red);margin:0">${esc(kicker || "00 / SUCCESSFUL")}</p>
            <h2 id="admin-modal-title" style="margin:4px 0 0;font-size:clamp(24px, 3.5vw, 36px);${titleColor}">${esc(title)}<span class="red-stop">.</span></h2>
          </div>
        </div>
        <p style="white-space:pre-wrap;margin-top:12px">${esc(copy)}</p>
        <div class="admin-actions">
          <button type="button" class="admin-btn" data-commit="close">CLOSE</button>
          ${viewUrl ? `<a href="${esc(viewUrl)}" target="_blank" rel="noopener" class="admin-btn primary">VIEW PUBLISHED PAGE <b>→</b></a>` : ""}
        </div>
      </div>`;
    const finish = async () => {
      document.removeEventListener("keydown", onKey);
      root.remove();
      if (!state.content) {
        await render();
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        finish();
      }
    };
    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-dismiss]") || event.target.closest("[data-commit='close']")) {
        finish();
      }
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(root);
  }

  function showDeleteConfirmModal({ kicker, type, title, onConfirm }) {
    document.querySelector(".admin-modal-root")?.remove();
    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal" role="dialog" aria-modal="true" style="border:2px solid var(--red)">
        <div class="admin-tick-container">
          <svg class="admin-cross-icon" viewBox="0 0 52 52">
            <circle class="admin-cross-circle" cx="26" cy="26" r="23" />
            <path class="admin-cross-line1" d="M17 17 L35 35" />
            <path class="admin-cross-line2" d="M35 17 L17 35" />
          </svg>
          <div>
            <p class="admin-kicker" style="color:var(--red);margin:0">${esc(kicker || "00 / DANGER ZONE")}</p>
            <h2 id="admin-modal-title" style="margin:4px 0 0;font-size:clamp(22px, 3vw, 32px);color:var(--red)">DELETE ${esc(type.toUpperCase())}?<span class="red-stop">.</span></h2>
          </div>
        </div>
        <p style="margin-top:12px;font-size:14px;line-height:1.5">
          You are about to permanently delete <strong>"${esc(title)}"</strong>.
          This action will remove the ${esc(type)} file from the repository and trigger a public site redeploy.
        </p>
        <div class="sudo-delete-box">
          <label for="sudo-delete-input">To confirm deletion, please type <code>sudo delete</code> below:</label>
          <input type="text" id="sudo-delete-input" class="sudo-delete-input" placeholder="sudo delete" autocomplete="off" spellcheck="false" />
        </div>
        <div class="admin-actions" style="margin-top:20px">
          <button type="button" class="admin-btn" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn admin-btn-danger" id="confirm-sudo-delete-btn" disabled>DELETE PERMANENTLY</button>
        </div>
      </div>`;

    const inputEl = root.querySelector("#sudo-delete-input");
    const confirmBtn = root.querySelector("#confirm-sudo-delete-btn");

    inputEl?.addEventListener("input", () => {
      const val = inputEl.value.trim();
      if (val === "sudo delete") {
        confirmBtn.removeAttribute("disabled");
        inputEl.classList.add("valid");
      } else {
        confirmBtn.setAttribute("disabled", "true");
        inputEl.classList.remove("valid");
      }
    });

    const close = () => {
      document.removeEventListener("keydown", onKey);
      root.remove();
    };

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-dismiss]")) {
        close();
      } else if (event.target.closest("#confirm-sudo-delete-btn")) {
        if (inputEl.value.trim() === "sudo delete") {
          close();
          onConfirm();
        }
      }
    });

    document.addEventListener("keydown", onKey);
    document.body.appendChild(root);
    setTimeout(() => inputEl?.focus(), 100);
  }

  function ensureSections(item, defaultSections = []) {
    if (Array.isArray(item.sections) && item.sections.length > 0) {
      return item.sections;
    }
    if (item.body && typeof item.body === "string" && item.body.includes("## ")) {
      const parsed = [];
      const blocks = item.body.split(/(?=^##\s+)/m);
      blocks.forEach((block, idx) => {
        const match = block.match(/^##\s+(?:(\d+\s*\/[^\n]*?)\n+)?([^\n]+)\n?([\s\S]*)$/);
        if (match) {
          const label = match[1] ? match[1].trim() : `0${idx + 1} / SECTION`;
          const heading = match[2] ? match[2].trim() : "";
          const body = match[3] ? match[3].trim() : "";
          parsed.push({ label, heading, body });
        } else if (block.trim()) {
          parsed.push({ label: `0${idx + 1} / SECTION`, heading: "", body: block.trim() });
        }
      });
      if (parsed.length > 0) return parsed;
    }
    if (item.body && typeof item.body === "string" && item.body.trim()) {
      return [{ label: "01 / SECTION", heading: "MAIN CONTENT", body: item.body.trim() }];
    }
    return defaultSections.length > 0 ? defaultSections : [{ label: "01 / PROBLEM", heading: "THE QUESTION", body: "" }];
  }

  function renderSection(sectionData, index) {
    const labelVal = sectionData.label || `0${index + 1} / SECTION`;
    const headingVal = sectionData.heading || "";
    const bodyVal = sectionData.body || "";
    return `
      <div class="section-card" data-section-index="${index}">
        <div class="section-card-header">
          <div class="section-card-title-group">
            <span class="section-drag-handle" title="Section handle">⋮⋮</span>
            <span class="section-number-badge">SECTION 0${index + 1}</span>
            <input type="text" class="section-label-input" name="section-label" value="${esc(labelVal)}" placeholder="e.g. 01 / THE PROBLEM" style="width:160px;font:11px var(--mono)">
            <input type="text" class="section-heading-input" name="section-heading" value="${esc(headingVal)}" placeholder="Section Heading (e.g. THE QUESTION)" style="flex:1;font-weight:700">
          </div>
          <div class="section-card-actions">
            <button type="button" class="wysiwyg-tab section-collapse-btn" data-act="section-collapse" title="Collapse/Expand">▼</button>
            <button type="button" class="wysiwyg-tab" data-act="section-move-up" title="Move Up">▲</button>
            <button type="button" class="wysiwyg-tab" data-act="section-move-down" title="Move Down">▼</button>
            <button type="button" class="wysiwyg-tab" data-act="section-duplicate" title="Duplicate Section">📋 DUPLICATE</button>
            <button type="button" class="wysiwyg-tab section-delete-btn" data-act="section-delete" title="Delete Section" style="color:var(--accent-red,#e03c31)">🗑️</button>
          </div>
        </div>
        <div class="section-card-body">
          ${wysiwygField("", "section-body", bodyVal)}
        </div>
      </div>`;
  }

  function renderSectionListContainer(sectionsArray) {
    return `
      <div class="section-editor-workspace">
        <div class="section-workspace-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line)">
          <h3 style="margin:0;font:11px var(--mono);letter-spacing:0.1em;text-transform:uppercase">EDITORIAL CONTENT SECTIONS (<span class="section-count-tag">${sectionsArray.length}</span>)</h3>
          <button type="button" class="admin-btn primary add-section-btn" data-act="add-section" style="font-size:11px">+ ADD SECTION <b>→</b></button>
        </div>
        <div class="sections-list-container" id="sections-list-container">
          ${sectionsArray.map((sec, i) => renderSection(sec, i)).join("")}
        </div>
        <div style="margin-top:16px;text-align:center;padding:16px;border:1px dashed var(--line);background:#faf8f2">
          <button type="button" class="admin-btn primary add-section-btn" data-act="add-section">+ ADD NEW SECTION <b>→</b></button>
        </div>
      </div>`;
  }

  function reindexSections(container) {
    if (!container) return;
    const cards = container.querySelectorAll(".section-card");
    cards.forEach((card, idx) => {
      card.setAttribute("data-section-index", idx);
      const badge = card.querySelector(".section-number-badge");
      if (badge) badge.textContent = `SECTION 0${idx + 1}`;
    });
    const countTag = container.closest(".section-editor-workspace")?.querySelector(".section-count-tag");
    if (countTag) countTag.textContent = cards.length;
  }

  function projectForm(item, isNew) {
    const today = new Date().toISOString().slice(0, 10);
    const sections = ensureSections(item, [
      { label: "01 / PROBLEM", heading: "THE QUESTION", body: "" },
      { label: "02 / DATA", heading: "THE EVIDENCE", body: "" },
      { label: "03 / METHODOLOGY", heading: "THE METHOD", body: "" },
      { label: "04 / RESULTS", heading: "THE OUTCOME", body: "METRIC TBD — Add only results supported by the real project record." }
    ]);
    return chrome(
      isNew ? "03 / NEW PROJECT" : "03 / EDIT PROJECT",
      `
      <div class="admin-sticky-bar">
        <div class="admin-sticky-title">
          <a href="#/projects" class="admin-btn" style="padding:4px 10px;font-size:10px">← BACK</a>
          <span class="admin-status-badge ${item.published ? 'published' : 'draft'}">${item.published ? 'PUBLISHED' : 'DRAFT'}</span>
          <h2 style="margin:0;font-size:16px;font-weight:800;font-family:var(--mono)">${esc(item.title || "NEW CASE STUDY")}</h2>
        </div>
        <div class="admin-actions" style="margin:0;gap:8px">
          <button class="admin-btn" type="submit" form="project-editor-form" data-publish="false">SAVE DRAFT <b>→</b></button>
          <button class="admin-btn" type="button" data-act="preview-project">PREVIEW <b>→</b></button>
          <button class="admin-btn primary" type="submit" form="project-editor-form" data-publish="true">PUBLISH <b>→</b></button>
        </div>
      </div>

      <form class="admin-form" id="project-editor-form" data-form="project" data-new="${isNew ? "1" : ""}">
        <details class="collapsible-details-panel">
          <summary class="collapsible-details-summary">
            <span>01 / CASE STUDY METADATA & MEDIA SETTINGS</span>
            <span style="font-size:10px;color:#777">CLICK TO TOGGLE</span>
          </summary>
          <div class="collapsible-details-content">
            ${input("TITLE", "title", item.title || "", "", true)}
            ${input("SLUG", "slug", item.slug || "")}
            ${input("NUMBER", "number", item.number || "")}
            ${input("DATE", "date", item.date || today, 'type="date"', true)}
            ${input("YEAR", "year", item.year || "")}
            ${input("CATEGORY", "category", item.category || "", "", true)}
            ${area("DESCRIPTION", "description", item.description || "", "", true)}
            ${area("SUMMARY", "summary", item.summary || "")}
            ${area("TECHNOLOGIES (ONE PER LINE)", "technologies", (item.technologies || []).join("\n"), "", true)}
            ${area("HEADLINE (ONE LINE PER BREAK)", "headline", (item.headline || []).join("\n"))}
            ${sel("ART VISUALIZATION STYLE", "art", item.art || "dots", [
              { value: "dots", label: "01 — ORBITAL DOTS / CONSTELLATION" },
              { value: "architecture", label: "02 — SYSTEM MESH / ARCHITECTURE" },
              { value: "chart", label: "03 — TREND LINE / ANALYTICAL CHART" },
              { value: "bars", label: "04 — SPECTRAL BARS / FREQUENCY" },
              { value: "scatter", label: "05 — CORRELATION CLUSTER / SCATTER" },
              { value: "waves", label: "06 — SINE WAVES / HARMONIC DYNAMICS" },
              { value: "matrix", label: "07 — NEURAL MATRIX / BINARY FIELD" },
              { value: "geometric", label: "08 — VORONOI MESH / GEOMETRIC" },
              { value: "circuit", label: "09 — QUANTUM CIRCUIT / LOGIC NODES" },
              { value: "radial", label: "10 — RADIAL BURST / PHASOR VECTOR" },
              { value: "heatmap", label: "11 — DENSITY MATRIX / HEATMAP" },
              { value: "custom", label: "12 — CUSTOM IMAGE / UPLOADED ARTWORK ↗" }
            ])}
            ${input("CUSTOM ART IMAGE/SVG PATH", "customArt", item.customArt || "", 'id="field-customArt"')}
            <div style="margin:-8px 0 16px;display:flex;gap:10px">
              <button type="button" class="admin-btn" data-act="pick-custom-art">CHOOSE / UPLOAD CUSTOM ARTWORK ↗</button>
            </div>
            ${input("ART CAPTION / LABEL", "artLabel", item.artLabel || "")}
            ${input("COVER PATH", "cover", item.cover || "", 'id="field-cover"')}
            <div style="margin:-8px 0 16px;display:flex;gap:10px">
              <button type="button" class="admin-btn" data-act="pick-cover">CHOOSE COVER IMAGE ↗</button>
            </div>
            ${input("GITHUB URL", "github", item.github || "")}
            ${input("LIVE URL", "live", item.live || "")}
            ${check("FEATURED", "featured", item.featured)}
            ${check("PUBLISHED", "published", item.published)}
          </div>
        </details>

        ${renderSectionListContainer(sections)}

        <div class="admin-actions" style="margin-top:24px">
          <button class="admin-btn" type="submit" data-publish="false">SAVE DRAFT <b>→</b></button>
          <button class="admin-btn" type="button" data-act="preview-project">PREVIEW <b>→</b></button>
          <button class="admin-btn primary" type="submit" data-publish="true">PUBLISH <b>→</b></button>
          ${!isNew ? `<button class="admin-btn admin-btn-danger" type="button" data-act="delete-project" data-slug="${esc(item.slug)}" data-title="${esc(item.title)}">DELETE PROJECT</button>` : ""}
        </div>
      </form>`
    );
  }

  function blogForm(item, isNew) {
    const today = new Date().toISOString().slice(0, 10);
    const sections = ensureSections(item, [
      { label: "01 / INTRODUCTION", heading: "THE CONTEXT", body: "" },
      { label: "02 / ANALYSIS", heading: "THE FINDINGS", body: "" },
      { label: "03 / CONCLUSION", heading: "THE TAKEAWAY", body: "" }
    ]);
    return chrome(
      isNew ? "04 / NEW ARTICLE" : "04 / EDIT ARTICLE",
      `
      <div class="admin-sticky-bar">
        <div class="admin-sticky-title">
          <a href="#/blog" class="admin-btn" style="padding:4px 10px;font-size:10px">← BACK</a>
          <span class="admin-status-badge ${item.published ? 'published' : 'draft'}">${item.published ? 'PUBLISHED' : 'DRAFT'}</span>
          <h2 style="margin:0;font-size:16px;font-weight:800;font-family:var(--mono)">${esc(item.title || "NEW ARTICLE")}</h2>
        </div>
        <div class="admin-actions" style="margin:0;gap:8px">
          <button class="admin-btn" type="submit" form="blog-editor-form" data-publish="false">SAVE DRAFT <b>→</b></button>
          <button class="admin-btn" type="button" data-act="preview-blog">PREVIEW <b>→</b></button>
          <button class="admin-btn primary" type="submit" form="blog-editor-form" data-publish="true">PUBLISH <b>→</b></button>
        </div>
      </div>

      <form class="admin-form" id="blog-editor-form" data-form="blog" data-new="${isNew ? "1" : ""}">
        <details class="collapsible-details-panel">
          <summary class="collapsible-details-summary">
            <span>01 / ARTICLE METADATA & MEDIA SETTINGS</span>
            <span style="font-size:10px;color:#777">CLICK TO TOGGLE</span>
          </summary>
          <div class="collapsible-details-content">
            ${input("TITLE", "title", item.title || "", "", true)}
            ${input("SLUG", "slug", item.slug || "")}
            ${input("DATE", "date", item.date || today, 'type="date"', true)}
            ${input("CATEGORY", "category", item.category || "", "", true)}
            ${area("TAGS (ONE PER LINE)", "tags", (item.tags || []).join("\n"))}
            ${area("DESCRIPTION", "description", item.description || "", "", true)}
            ${area("HEADLINE (ONE LINE PER BREAK)", "headline", (item.headline || []).join("\n"))}
            ${sel("RELATED PROJECT", "relatedProject", item.relatedProject || "", [{ value: "", label: "NONE" }].concat((state.content.projects || []).map((p) => ({ value: p.slug, label: p.title }))))}
            ${input("COVER PATH", "cover", item.cover || "")}
            ${check("FEATURED", "featured", item.featured)}
            ${check("PUBLISHED", "published", item.published)}
          </div>
        </details>

        ${renderSectionListContainer(sections)}

        <div class="admin-actions" style="margin-top:24px">
          <button class="admin-btn" type="submit" data-publish="false">SAVE DRAFT <b>→</b></button>
          <button class="admin-btn" type="button" data-act="preview-blog">PREVIEW <b>→</b></button>
          <button class="admin-btn primary" type="submit" data-publish="true">PUBLISH <b>→</b></button>
          ${!isNew ? `<button class="admin-btn admin-btn-danger" type="button" data-act="delete-blog" data-slug="${esc(item.slug)}" data-title="${esc(item.title)}">DELETE ARTICLE</button>` : ""}
        </div>
      </form>`
    );
  }

  function noteForm(item, isNew) {
    const today = new Date().toISOString().slice(0, 10);
    const sections = ensureSections(item, [
      { label: "01 / NOTE CONTENT", heading: "THE RESEARCH NOTE", body: item.body || "" }
    ]);
    return chrome(
      isNew ? "06 / NEW NOTE" : "06 / EDIT NOTE",
      `
      <div class="admin-sticky-bar">
        <div class="admin-sticky-title">
          <a href="#/notes" class="admin-btn" style="padding:4px 10px;font-size:10px">← BACK</a>
          <span class="admin-status-badge ${item.published !== false ? 'published' : 'draft'}">${item.published !== false ? 'PUBLISHED' : 'DRAFT'}</span>
          <h2 style="margin:0;font-size:16px;font-weight:800;font-family:var(--mono)">${esc(item.title || "NEW NOTE")}</h2>
        </div>
        <div class="admin-actions" style="margin:0;gap:8px">
          <button class="admin-btn primary" type="submit" form="note-editor-form" data-publish="false">SAVE NOTE <b>→</b></button>
        </div>
      </div>

      <form class="admin-form" id="note-editor-form" data-form="note" data-slug="${esc(item.slug || "")}" data-new="${isNew ? "1" : ""}">
        <details class="collapsible-details-panel">
          <summary class="collapsible-details-summary">
            <span>01 / NOTE METADATA</span>
            <span style="font-size:10px;color:#777">CLICK TO TOGGLE</span>
          </summary>
          <div class="collapsible-details-content">
            ${input("TITLE", "title", item.title || "", "", true)}
            ${input("SLUG", "slug", item.slug || "")}
            ${input("DATE", "date", item.date || today, 'type="date"', true)}
            ${input("TAGS (COMMA SEPARATED)", "tags", (item.tags || []).join(", "))}
            ${check("PUBLISHED", "published", item.published !== false)}
          </div>
        </details>

        ${renderSectionListContainer(sections)}

        <div class="admin-actions" style="margin-top:24px">
          <button class="admin-btn primary" type="submit" data-publish="false">SAVE NOTE <b>→</b></button>
          ${!isNew ? `<button class="admin-btn" type="button" data-act="promote-note" data-target="blog">PROMOTE TO BLOG <b>→</b></button>
          <button class="admin-btn" type="button" data-act="promote-note" data-target="project">PROMOTE TO PROJECT <b>→</b></button>
          <button class="admin-btn admin-btn-danger" type="button" data-act="delete-note">DELETE NOTE</button>` : ""}
        </div>
      </form>`
    );
  }

  function journalForm(item, isNew) {
    const today = new Date().toISOString().slice(0, 10);
    const defaultSections = [
      { label: "01 / WHAT I DID", heading: "THE WORK", body: item.did || "" },
      { label: "02 / WHAT I LEARNED", heading: "THE INSIGHT", body: item.learned || "" },
      { label: "03 / NEXT", heading: "THE FOLLOW-UP", body: item.next || "" }
    ];
    const sections = ensureSections(item, defaultSections);
    return chrome(
      isNew ? "05 / NEW NOTE" : "05 / EDIT NOTE",
      `
      <div class="admin-sticky-bar">
        <div class="admin-sticky-title">
          <a href="#/journal" class="admin-btn" style="padding:4px 10px;font-size:10px">← BACK</a>
          <span class="admin-status-badge ${item.published ? 'published' : 'draft'}">${item.published ? 'PUBLISHED' : 'DRAFT'}</span>
          <h2 style="margin:0;font-size:16px;font-weight:800;font-family:var(--mono)">${esc(item.title || "DAILY JOURNAL")}</h2>
        </div>
        <div class="admin-actions" style="margin:0;gap:8px">
          <button class="admin-btn" type="submit" form="journal-editor-form" data-publish="false">SAVE ENTRY <b>→</b></button>
          <button class="admin-btn" type="button" data-act="preview-journal">PREVIEW <b>→</b></button>
          <button class="admin-btn primary" type="submit" form="journal-editor-form" data-publish="true">PUBLISH <b>→</b></button>
        </div>
      </div>

      <form class="admin-form" id="journal-editor-form" data-form="journal" data-id="${esc(item.id || "")}" data-new="${isNew ? "1" : ""}">
        <details class="collapsible-details-panel">
          <summary class="collapsible-details-summary">
            <span>01 / JOURNAL METADATA & LINKS</span>
            <span style="font-size:10px;color:#777">CLICK TO TOGGLE</span>
          </summary>
          <div class="collapsible-details-content">
            ${input("DATE", "date", item.date || today, 'type="date"', true)}
            ${input("TITLE", "title", item.title || "", "", true)}
            ${area("HEADLINE (ONE LINE PER BREAK)", "headline", (item.headline || []).join("\n"))}
            ${sel("RELATED PROJECT", "project", item.project || "", [{ value: "", label: "NONE" }].concat((state.content.projects || []).map((p) => ({ value: p.slug, label: p.title }))))}
            ${input("SUMMARY", "summary", item.summary || "")}
            ${input("DATA", "data", item.data || "")}
            ${input("METHOD", "method", item.method || "")}
            ${input("RESULT", "result", item.result || "")}
            ${input("TOOLS", "tools", item.tools || "")}
            ${check("PUBLISHED", "published", item.published)}
          </div>
        </details>

        ${renderSectionListContainer(sections)}

        <div class="admin-actions" style="margin-top:24px">
          <button class="admin-btn" type="submit" data-publish="false">SAVE DRAFT <b>→</b></button>
          <button class="admin-btn" type="button" data-act="preview-journal">PREVIEW <b>→</b></button>
          <button class="admin-btn primary" type="submit" data-publish="true">PUBLISH <b>→</b></button>
          ${!isNew ? `<button class="admin-btn admin-btn-danger" type="button" data-act="delete-journal" data-id="${esc(item.id)}" data-title="${esc(item.title)}">DELETE ENTRY</button>` : ""}
        </div>
      </form>`
    );
  }

  function aboutForm(about) {
    const principles = (about.principles || []).concat([{ title: "", home: "", page: "" }, { title: "", home: "", page: "" }, { title: "", home: "", page: "" }, { title: "", home: "", page: "" }]).slice(0, 4).map((item, i) => `
      ${input(`PRINCIPLE ${i + 1} TITLE`, `p-title-${i}`, item.title || "")}
      ${input("HOME LINE", `p-home-${i}`, item.home || "")}
      ${input("PAGE LINE", `p-page-${i}`, item.page || "")}
    `).join("");
    const portraitPath = about.portrait || "";
    return chrome(
      "02 / ABOUT",
      `<h1>ABOUT COPY<span class="red-stop">.</span></h1>
      <form class="admin-form" data-form="about">
        ${input("TITLE", "title", about.title || "", "", true)}
        ${area("HEADLINE", "headline", (about.headline || []).join("\n"))}
        ${area("HOME HEADLINE", "homeHeadline", (about.homeHeadline || []).join("\n"))}
        ${area("INTRO (ABOUT PAGE AND HOMEPAGE)", "intro", about.intro || "", "", true)}
        ${area("HOMEPAGE BIO OVERRIDE (OPTIONAL)", "homeSummary", about.homeSummary || "")}
        ${input("APPROACH EYEBROW", "approachEyebrow", about.approachEyebrow || "")}
        ${area("APPROACH HEADLINE", "approachHeadline", (about.approachHeadline || []).join("\n"))}
        ${area("APPROACH", "approach", about.approach || "")}
        ${area("MARGIN NOTE", "marginNote", (about.marginNote || []).join("\n"))}

        <!-- RECODED EDITORIAL PORTRAIT MANAGER -->
        <div class="portrait-studio-container">
          <div class="portrait-studio-header">
            <h3>EDITORIAL PORTRAIT MANAGER</h3>
            <span class="studio-badge">CLOUDFLARE R2 & STUDIO FILTERS</span>
          </div>
          <div class="portrait-studio-body">
            <div class="portrait-plate-preview" id="portrait-studio-preview-box">
              ${portraitPath 
                ? `<img id="portrait-studio-active-img" src="${portraitPath}" alt="Portrait Preview">`
                : `<div class="portrait-placeholder-box"><span>PORTRAIT<br>PLACEHOLDER</span></div>`
              }
              <b></b>
            </div>
            <div class="portrait-studio-controls-area">
              <div style="margin-bottom:12px">
                <label class="admin-kicker" style="margin-bottom:4px;display:block">PORTRAIT PATH / IMAGE URL</label>
                <input type="text" name="portrait" id="portrait-path-input" class="admin-input" value="${portraitPath}" placeholder="/assets/images/about/portrait.webp">
              </div>
              <div class="portrait-studio-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <input type="file" id="portrait-direct-upload-input" accept="image/*" style="display:none">
                <button type="button" class="admin-btn primary" id="portrait-direct-upload-btn" style="min-width:0;justify-content:center">
                  📤 UPLOAD NEW FILE <b>→</b>
                </button>
                <button type="button" class="admin-btn secondary" id="pick-library-portrait-btn" style="min-width:0;justify-content:center">
                  🖼️ CHOOSE FROM LIBRARY <b>→</b>
                </button>
                <button type="button" class="admin-btn" id="open-portrait-studio-btn" style="min-width:0;justify-content:center">
                  🎨 CROP & FILTER STUDIO <b>→</b>
                </button>
                ${portraitPath ? `<button type="button" class="admin-btn danger" id="clear-portrait-btn" style="min-width:0;justify-content:center">❌ REMOVE</button>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- RESUME DOCUMENT UPLOADER -->
        <div class="portrait-studio-container" style="margin-top:24px">
          <div class="portrait-studio-header">
            <h3>RESUME DOCUMENT (PDF)</h3>
            <span class="studio-badge">PUBLIC DOWNLOAD ASSET</span>
          </div>
          <div style="padding:20px;font-family:var(--sans)">
            <p style="font-size:13px;line-height:1.5;color:#555;margin:0 0 16px">Upload your updated resume PDF file here. It will automatically replace <code>/assets/Abantika_Resume.pdf</code> and update all Download Resume buttons on the live site.</p>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
              <input type="file" id="resume-pdf-input" accept="application/pdf" class="admin-input" style="max-width:320px;padding:8px" />
              <button type="button" class="admin-btn primary" id="upload-resume-btn">📄 UPLOAD NEW RESUME PDF <b>↗</b></button>
            </div>
            <div id="resume-upload-msg" style="margin-top:12px;font:11px var(--mono)"></div>
          </div>
        </div>

        ${principles}
        <div class="admin-actions"><button class="admin-btn primary" type="submit">SAVE ABOUT <b>→</b></button></div>
      </form>`
    );
  }

  function settingsForm() {
    const settings = state.content.settings || {};
    const skills = {};
    (state.content.skills || []).forEach((group) => {
      skills[group.key] = (group.items || []).join("\n");
    });
    return chrome(
      "07 / SETTINGS",
      `<h1>SITE SETTINGS<span class="red-stop">.</span></h1>
      <form class="admin-form" data-form="settings">
        ${input("NAME", "name", settings.name || "", "", true)}
        ${input("ROLE", "role", settings.role || "")}
        ${input("SITE TITLE", "siteTitle", settings.siteTitle || "", "", true)}
        ${input("URL", "url", settings.url || "", "", true)}
        ${input("EMAIL", "email", settings.email || "", "", true)}
        ${input("LINKEDIN", "linkedin", settings.linkedin || "")}
        ${input("GITHUB", "github", settings.github || "")}
        ${area("DESCRIPTION", "description", settings.description || "")}
        ${area("HERO LEDE", "heroLede", settings.heroLede || "")}
        ${area("CONTACT BLURB", "contactBlurb", settings.contactBlurb || "")}
        ${area("AVAILABILITY", "availability", (settings.availability || []).join("\n"))}
        ${input("FOOTER NOTE", "footerNote", settings.footerNote || "")}
        ${input("COPYRIGHT YEAR", "copyrightYear", settings.copyrightYear || "")}
        <div class="admin-actions"><button class="admin-btn primary" type="submit">SAVE SETTINGS <b>→</b></button></div>
      </form>
      <p class="admin-kicker" style="margin-top:48px">SKILLS</p>
      <form class="admin-form" data-form="skills">
        ${area("DATA ANALYSIS", "dataAnalysis", skills.dataAnalysis || "")}
        ${area("STATISTICS", "statistics", skills.statistics || "")}
        ${area("MACHINE LEARNING", "machineLearning", skills.machineLearning || "")}
        ${area("VISUALIZATION", "visualization", skills.visualization || "")}
        ${area("OTHER", "other", skills.other || "")}
        <div class="admin-actions"><button class="admin-btn primary" type="submit">SAVE SKILLS <b>→</b></button></div>
      </form>`
    );
  }

  async function showMediaSelectModal(onSelect) {
    document.querySelector(".admin-modal-root")?.remove();
    let mediaFiles = [];
    try {
      const res = await api("/api/media");
      mediaFiles = Array.isArray(res) ? res : (Array.isArray(state.content?.media) ? state.content.media : []);
    } catch(e) {
      mediaFiles = Array.isArray(state.content?.media) ? state.content.media : [];
    }

    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal image-picker-modal" role="dialog" aria-modal="true" style="width:min(680px, 100%)">
        <p class="admin-kicker">07 / ARTWORK & MEDIA PICKER</p>
        <h2 style="margin-bottom:12px">SELECT OR UPLOAD ARTWORK<span class="red-stop">.</span></h2>
        
        <div class="image-picker-tabs" style="display:flex;gap:6px;margin-bottom:14px">
          <button type="button" class="wysiwyg-tab active" data-img-tab="library">SELECT FROM MEDIA LIBRARY</button>
          <button type="button" class="wysiwyg-tab" data-img-tab="upload">UPLOAD NEW ART / IMAGE</button>
        </div>

        <div class="image-picker-pane" id="img-pane-library">
          <div class="admin-media-grid-picker" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:10px;max-height:220px;overflow-y:auto;border:1px solid var(--line);padding:10px">
            ${mediaFiles.length ? mediaFiles.map((f) => `
              <div class="picker-item" data-path="${esc(f.path)}" style="border:1px solid var(--line);padding:6px;cursor:pointer;background:#f7f5ef">
                <img src="${esc(f.path)}" alt="${esc(f.name)}" style="width:100%;height:70px;object-fit:cover">
                <span style="font:9px var(--mono);display:block;margin-top:4px;word-break:break-all">${esc(f.name)}</span>
              </div>
            `).join("") : `<p style="font:11px var(--mono)">No images in library yet.</p>`}
          </div>
        </div>

        <div class="image-picker-pane" id="img-pane-upload" style="display:none">
          <label style="display:block;margin-bottom:10px;font:10px var(--mono)">FOLDER
            <select id="picker-folder"><option>projects</option><option>blog</option><option>journal</option><option>about</option></select>
          </label>
          <label style="display:block;margin-bottom:10px;font:10px var(--mono)">CHOOSE ART / IMAGE FILE (SVG / PNG / JPG / WEBP)
            <input type="file" id="picker-file" accept="image/*,.svg">
          </label>
          <button type="button" class="admin-btn" id="picker-upload-btn">UPLOAD TO LIBRARY <b>→</b></button>
        </div>

        <div style="margin-top:16px">
          <label style="font:10px var(--mono)">SELECTED ART / IMAGE PATH
            <input type="text" id="picker-selected-path" placeholder="/assets/images/projects/art.svg">
          </label>
        </div>

        <div class="admin-actions" style="margin-top:20px">
          <button type="button" class="admin-btn" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn primary" id="picker-select-btn">USE THIS ARTWORK <b>→</b></button>
        </div>
      </div>`;

    document.body.appendChild(root);

    let selectedPath = "";

    const bindPickerItems = () => {
      root.querySelectorAll(".picker-item").forEach((item) => {
        item.addEventListener("click", () => {
          root.querySelectorAll(".picker-item").forEach((i) => (i.style.borderColor = "var(--line)"));
          item.style.borderColor = "var(--red)";
          selectedPath = item.getAttribute("data-path");
          root.querySelector("#picker-selected-path").value = selectedPath;
        });
      });
    };
    bindPickerItems();

    root.querySelectorAll("[data-img-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.querySelectorAll("[data-img-tab]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.getAttribute("data-img-tab");
        root.querySelector("#img-pane-library").style.display = tab === "library" ? "block" : "none";
        root.querySelector("#img-pane-upload").style.display = tab === "upload" ? "block" : "none";
      });
    });

    root.querySelector("#picker-upload-btn")?.addEventListener("click", async () => {
      const fileInput = root.querySelector("#picker-file");
      const folderSelect = root.querySelector("#picker-folder");
      const file = fileInput.files[0];
      if (!file) { alert("Select a file first."); return; }
      try {
        let payload;
        if (file.type && file.type.includes("svg")) {
          const text = await file.text();
          const base64 = btoa(unescape(encodeURIComponent(text)));
          payload = { folder: folderSelect.value, filename: file.name, data: `data:image/svg+xml;base64,${base64}` };
        } else {
          const { dataUrl, filename } = await convertToWebp(file);
          payload = { folder: folderSelect.value, filename, data: dataUrl };
        }
        const res = await api("/api/media", { method: "POST", body: payload });
        selectedPath = res.path;
        root.querySelector("#picker-selected-path").value = selectedPath;
        alert("Artwork uploaded successfully!");
      } catch (err) {
        alert("Upload failed: " + err.message);
      }
    });

    root.querySelector("#picker-select-btn")?.addEventListener("click", () => {
      const pathVal = root.querySelector("#picker-selected-path").value.trim() || selectedPath;
      if (pathVal) {
        root.remove();
        onSelect(pathVal);
      } else {
        alert("Please select or upload an image first.");
      }
    });

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-dismiss]")) root.remove();
    });
  }

  async function showImagePickerModal(wrapper) {
    document.querySelector(".admin-modal-root")?.remove();
    let mediaFiles = [];
    try {
      const res = await api("/api/media");
      mediaFiles = Array.isArray(res) ? res : (Array.isArray(state.content?.media) ? state.content.media : []);
    } catch(e) {
      mediaFiles = Array.isArray(state.content?.media) ? state.content.media : [];
    }

    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal image-picker-modal" role="dialog" aria-modal="true" style="width:min(680px, 100%)">
        <p class="admin-kicker">07 / MEDIA INSERT</p>
        <h2 style="margin-bottom:12px">INSERT IMAGE<span class="red-stop">.</span></h2>
        
        <div class="image-picker-tabs" style="display:flex;gap:6px;margin-bottom:14px">
          <button type="button" class="wysiwyg-tab active" data-img-tab="library">SELECT FROM MEDIA LIBRARY</button>
          <button type="button" class="wysiwyg-tab" data-img-tab="upload">UPLOAD NEW IMAGE</button>
        </div>

        <div class="image-picker-pane" id="img-pane-library">
          <div class="admin-media-grid-picker" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:10px;max-height:220px;overflow-y:auto;border:1px solid var(--line);padding:10px">
            ${mediaFiles.length ? mediaFiles.map((f) => `
              <div class="picker-item" data-path="${esc(f.path)}" style="border:1px solid var(--line);padding:6px;cursor:pointer;background:#f7f5ef">
                <img src="${esc(f.path)}" alt="${esc(f.name)}" style="width:100%;height:70px;object-fit:cover">
                <span style="font:9px var(--mono);display:block;margin-top:4px;word-break:break-all">${esc(f.name)}</span>
              </div>
            `).join("") : `<p style="font:11px var(--mono)">No images in library yet.</p>`}
          </div>
        </div>

        <div class="image-picker-pane" id="img-pane-upload" style="display:none">
          <label style="display:block;margin-bottom:10px;font:10px var(--mono)">FOLDER
            <select id="picker-folder"><option>projects</option><option>blog</option><option>journal</option><option>about</option></select>
          </label>
          <label style="display:block;margin-bottom:10px;font:10px var(--mono)">CHOOSE IMAGE FILE
            <input type="file" id="picker-file" accept="image/*">
          </label>
          <button type="button" class="admin-btn" id="picker-upload-btn">UPLOAD TO LIBRARY <b>→</b></button>
        </div>

        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label style="grid-column:1/-1;font:10px var(--mono)">SELECTED IMAGE PATH
            <input type="text" id="picker-selected-path" placeholder="/assets/images/projects/photo.jpg" readonly>
          </label>
          <label style="font:10px var(--mono)">ALT TEXT (ACCESSIBILITY)
            <input type="text" id="picker-alt" placeholder="Descriptive alt text">
          </label>
          <label style="font:10px var(--mono)">CAPTION (OPTIONAL)
            <input type="text" id="picker-caption" placeholder="Plate caption">
          </label>
        </div>

        <div class="admin-actions" style="margin-top:20px">
          <button type="button" class="admin-btn" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn primary" id="picker-insert-btn">INSERT IMAGE <b>→</b></button>
        </div>
      </div>`;

    document.body.appendChild(root);

    let selectedPath = "";

    const bindPickerItems = () => {
      root.querySelectorAll(".picker-item").forEach((item) => {
        item.addEventListener("click", () => {
          root.querySelectorAll(".picker-item").forEach((i) => (i.style.borderColor = "var(--line)"));
          item.style.borderColor = "var(--red)";
          selectedPath = item.getAttribute("data-path");
          root.querySelector("#picker-selected-path").value = selectedPath;
        });
      });
    };
    bindPickerItems();

    root.querySelectorAll("[data-img-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.querySelectorAll("[data-img-tab]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.getAttribute("data-img-tab");
        root.querySelector("#img-pane-library").style.display = tab === "library" ? "block" : "none";
        root.querySelector("#img-pane-upload").style.display = tab === "upload" ? "block" : "none";
      });
    });

    root.querySelector("#picker-upload-btn")?.addEventListener("click", async () => {
      const fileInput = root.querySelector("#picker-file");
      const folderSelect = root.querySelector("#picker-folder");
      const file = fileInput.files[0];
      if (!file) { alert("Select a file first."); return; }
      try {
        const { dataUrl, filename } = await convertToWebp(file);
        const res = await api("/api/media", {
          method: "POST",
          body: { folder: folderSelect.value, filename, data: dataUrl }
        });
        selectedPath = res.path;
        root.querySelector("#picker-selected-path").value = selectedPath;
        state.content = null;

        const updatedMedia = await api("/api/media").catch(() => []);
        const grid = root.querySelector(".admin-media-grid-picker");
        if (grid && updatedMedia.length) {
          grid.innerHTML = updatedMedia.map((f) => `
            <div class="picker-item" data-path="${esc(f.path)}" style="border:${f.path === selectedPath ? "1px solid var(--red)" : "1px solid var(--line)"};padding:6px;cursor:pointer;background:#f7f5ef">
              <img src="${esc(f.path)}" alt="${esc(f.name)}" style="width:100%;height:70px;object-fit:cover">
              <span style="font:9px var(--mono);display:block;margin-top:4px;word-break:break-all">${esc(f.name)}</span>
            </div>
          `).join("");
          bindPickerItems();
        }

        root.querySelectorAll("[data-img-tab]").forEach((b) => b.classList.remove("active"));
        root.querySelector("[data-img-tab='library']")?.classList.add("active");
        root.querySelector("#img-pane-library").style.display = "block";
        root.querySelector("#img-pane-upload").style.display = "none";

        alert("Image converted to WebP & uploaded successfully!");
      } catch(e) { alert(e.message); }
    });

    root.querySelector("#picker-insert-btn")?.addEventListener("click", () => {
      const pathVal = root.querySelector("#picker-selected-path").value.trim();
      const altVal = root.querySelector("#picker-alt").value.trim() || "Image";
      const capVal = root.querySelector("#picker-caption").value.trim();
      if (!pathVal) { alert("Please select or upload an image first."); return; }

      const markdownImg = capVal ? `\n![${altVal}](${pathVal} "${capVal}")\n` : `\n![${altVal}](${pathVal})\n`;

      const activeTab = wrapper.querySelector(".wysiwyg-tab.active");
      const mode = activeTab ? activeTab.getAttribute("data-wysiwyg-mode") : "edit";

      if (mode === "source") {
        const source = wrapper.querySelector(".wysiwyg-source");
        const start = source.selectionStart || source.value.length;
        const end = source.selectionEnd || source.value.length;
        source.value = source.value.substring(0, start) + markdownImg + source.value.substring(end);
      } else {
        const editable = wrapper.querySelector(".wysiwyg-editable");
        editable.focus();
        document.execCommand("insertText", false, markdownImg);
        syncWysiwyg(wrapper);
      }
      root.remove();
    });

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-dismiss]")) root.remove();
    });
  }

  function insertIntoTextarea(textarea, prefix, suffix = "", defaultText = "") {
    textarea.focus();
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const selText = textarea.value.substring(start, end) || defaultText;
    const replacement = prefix + selText + suffix;
    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.selectionStart = start + prefix.length;
    textarea.selectionEnd = start + prefix.length + selText.length;
  }

  function showMathPickerModal(target) {
    document.querySelector(".admin-modal-root")?.remove();

    const presets = [
      { label: "Inline E = mc²", code: "$ E = mc^2 $", isBlock: false },
      { label: "Quadratic Formula", code: "$$ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} $$", isBlock: true },
      { label: "Summation Series", code: "$$ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} $$", isBlock: true },
      { label: "Definite Integral", code: "$$ \\int_{a}^{b} f(x) \\, dx $$", isBlock: true },
      { label: "2x2 Matrix", code: "$$ \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} $$", isBlock: true },
      { label: "Limit", code: "$$ \\lim_{x \\to \\infty} \\frac{1}{x} = 0 $$", isBlock: true },
      { label: "Euler's Identity", code: "$$ e^{i\\pi} + 1 = 0 $$", isBlock: true }
    ];

    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal math-picker-modal" role="dialog" aria-modal="true" style="width:min(620px, 100%)">
        <p class="admin-kicker">08 / LATEX MATHEMATICS</p>
        <h2 style="margin-bottom:12px">INSERT LATEX MATH<span class="red-stop">.</span></h2>

        <div style="margin-bottom:12px">
          <label style="display:block;font:11px var(--mono);margin-bottom:6px;font-weight:700">CHOOSE PRESET TEMPLATE</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
            ${presets.map((p, idx) => `
              <button type="button" class="wysiwyg-tab math-preset-btn" data-preset-idx="${idx}" style="font-size:11px">${esc(p.label)}</button>
            `).join("")}
          </div>
        </div>

        <label style="display:block;margin-bottom:12px;font:11px var(--mono);font-weight:700">EDIT LATEX EQUATION
          <textarea id="math-modal-input" style="width:100%;height:80px;font-family:var(--mono);font-size:13px;padding:8px;margin-top:4px;border:1px solid var(--line);background:#faf9f5">${esc(presets[0].code)}</textarea>
        </label>

        <div style="margin-bottom:16px">
          <label style="display:block;font:11px var(--mono);margin-bottom:4px;font-weight:700">LIVE MATHEMATICAL PREVIEW</label>
          <div id="math-modal-preview" style="min-height:55px;padding:12px;background:#ffffff;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;font-size:15px;overflow-x:auto"></div>
        </div>

        <div class="image-picker-actions" style="display:flex;justify-content:space-between;align-items:center;margin-top:14px">
          <button type="button" class="admin-btn secondary" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn" id="math-modal-insert-btn">INSERT FORMULA <b>→</b></button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const input = root.querySelector("#math-modal-input");
    const preview = root.querySelector("#math-modal-preview");
    const insertBtn = root.querySelector("#math-modal-insert-btn");

    function updatePreview() {
      const val = input.value.trim();
      preview.innerHTML = val ? esc(val) : '<span style="color:#888;font-size:12px">Type equation above...</span>';
      if (window.renderMathInElement) {
        window.renderMathInElement(preview, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '\\[', right: '\\]', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false
        });
      }
    }

    input.addEventListener("input", updatePreview);
    updatePreview();

    root.addEventListener("click", (e) => {
      const presetBtn = e.target.closest(".math-preset-btn");
      if (presetBtn) {
        const idx = parseInt(presetBtn.getAttribute("data-preset-idx"), 10);
        if (presets[idx]) {
          input.value = presets[idx].code;
          updatePreview();
        }
        return;
      }

      if (e.target.getAttribute("data-dismiss") === "true") {
        root.remove();
        return;
      }
    });

    insertBtn.addEventListener("click", () => {
      const mathCode = input.value.trim();
      if (!mathCode) return;

      if (target instanceof HTMLTextAreaElement) {
        insertIntoTextarea(target, mathCode);
      } else if (target && target.querySelector) {
        const wrapper = target;
        const editable = wrapper.querySelector(".wysiwyg-editable");
        const source = wrapper.querySelector(".wysiwyg-source");
        const activeTab = wrapper.querySelector(".wysiwyg-tab.active");
        const mode = activeTab ? activeTab.getAttribute("data-wysiwyg-mode") : "edit";

        if (mode === "source") {
          insertIntoTextarea(source, mathCode);
        } else {
          editable.focus();
          document.execCommand("insertText", false, mathCode + " ");
        }
        syncWysiwyg(wrapper);
      }
      root.remove();
    });
  }

  // --- EDITORIAL PORTRAIT PHOTO STUDIO ENGINE ---
  let portraitStudioState = {
    activeImg: null,
    zoom: 100,
    panX: 0,
    panY: 0,
    rotation: 0,
    aspectRatio: "3:4",
    filter: "normal",
    brightness: 0,
    contrast: 0,
    saturation: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
  };

  function renderPortraitStudioModalHtml() {
    return `
    <div class="portrait-editor-modal" id="portrait-editor-modal" style="display:none">
      <div class="portrait-editor-dialog">
        <div class="portrait-editor-head">
          <div>
            <h2>PORTRAIT PHOTO STUDIO</h2>
            <p class="editor-subtitle">Crop, frame, and apply Canva-Noir & Duotone filters</p>
          </div>
          <button type="button" class="editor-close-btn" id="close-portrait-studio-modal-btn">✕</button>
        </div>

        <div class="portrait-editor-content">
          <!-- Stage / Canvas area -->
          <div class="editor-canvas-stage">
            <div class="stage-wrapper">
              <canvas id="portrait-studio-canvas" width="600" height="800"></canvas>
            </div>
            <div class="stage-controls">
              <button type="button" class="studio-mini-btn" id="ps-rotate-btn">↻ ROTATE 90°</button>
              <button type="button" class="studio-mini-btn" id="ps-reset-btn">↺ RESET FRAME</button>
            </div>
          </div>

          <!-- Toolset controls area -->
          <div class="editor-toolset">
            
            <div class="editor-section">
              <label class="editor-label">1. CHOOSE IMAGE SOURCE</label>
              <div class="editor-file-drop">
                <input type="file" id="ps-file-input" accept="image/*" style="display:none">
                <button type="button" class="admin-btn secondary" id="ps-trigger-file-btn">SELECT IMAGE FILE <b>↑</b></button>
              </div>
            </div>

            <div class="editor-section">
              <label class="editor-label">2. CROP & FRAMING</label>
              <div class="control-row">
                <span>ZOOM / SCALE</span>
                <input type="range" id="ps-zoom-slider" min="100" max="300" value="100" step="1">
                <b id="ps-zoom-val">1.0x</b>
              </div>
              <div class="control-row">
                <span>POSITION X</span>
                <input type="range" id="ps-panx-slider" min="-250" max="250" value="0" step="1">
                <b id="ps-panx-val">0px</b>
              </div>
              <div class="control-row">
                <span>POSITION Y</span>
                <input type="range" id="ps-pany-slider" min="-250" max="250" value="0" step="1">
                <b id="ps-pany-val">0px</b>
              </div>
              <div class="ratio-presets">
                <span>ASPECT RATIO:</span>
                <button type="button" class="ratio-btn active" data-ratio="3:4">3:4 PORTRAIT</button>
                <button type="button" class="ratio-btn" data-ratio="1:1">1:1 SQUARE</button>
                <button type="button" class="ratio-btn" data-ratio="4:5">4:5 EDITORIAL</button>
              </div>
            </div>

            <div class="editor-section">
              <label class="editor-label">3. EDITORIAL FILTERS (CANVA STYLE)</label>
              <div class="filter-presets-grid">
                <button type="button" class="filter-chip active" data-filter="normal">
                  <span class="chip-swatch filter-normal"></span>
                  <b>NORMAL</b>
                  <small>Original</small>
                </button>
                <button type="button" class="filter-chip" data-filter="canva-noir">
                  <span class="chip-swatch filter-noir"></span>
                  <b>CANVA-NOIR</b>
                  <small>Editorial B&W</small>
                </button>
                <button type="button" class="filter-chip" data-filter="canva-duotone">
                  <span class="chip-swatch filter-duotone"></span>
                  <b>CANVA-DUOTONE</b>
                  <small>Bauhaus Red</small>
                </button>
                <button type="button" class="filter-chip" data-filter="canva-duotone-cream">
                  <span class="chip-swatch filter-cream"></span>
                  <b>DUOTONE WARM</b>
                  <small>Cream & Ink</small>
                </button>
                <button type="button" class="filter-chip" data-filter="vivid-ink">
                  <span class="chip-swatch filter-vivid"></span>
                  <b>VIVID INK</b>
                  <small>Rich Detail</small>
                </button>
                <button type="button" class="filter-chip" data-filter="silver-mono">
                  <span class="chip-swatch filter-silver"></span>
                  <b>SILVER MONO</b>
                  <small>Soft B&W</small>
                </button>
                <button type="button" class="filter-chip" data-filter="warm-sepia">
                  <span class="chip-swatch filter-sepia"></span>
                  <b>WARM SEPIA</b>
                  <small>Vintage Tones</small>
                </button>
              </div>
            </div>

            <div class="editor-section">
              <label class="editor-label">4. FINE TUNING</label>
              <div class="control-row">
                <span>BRIGHTNESS</span>
                <input type="range" id="ps-brightness-slider" min="-50" max="50" value="0" step="1">
                <b id="ps-brightness-val">0</b>
              </div>
              <div class="control-row">
                <span>CONTRAST</span>
                <input type="range" id="ps-contrast-slider" min="-50" max="50" value="0" step="1">
                <b id="ps-contrast-val">0</b>
              </div>
              <div class="control-row">
                <span>SATURATION</span>
                <input type="range" id="ps-saturation-slider" min="-100" max="100" value="0" step="1">
                <b id="ps-saturation-val">0</b>
              </div>
            </div>

            <div class="editor-footer">
              <button type="button" class="admin-btn primary large" id="ps-apply-save-btn">
                💾 APPLY & SAVE PORTRAIT <b>→</b>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
    `;
  }

  function openPortraitStudio(initialImageUrl) {
    let modal = document.getElementById("portrait-editor-modal");
    if (!modal) {
      document.body.insertAdjacentHTML("beforeend", renderPortraitStudioModalHtml());
      modal = document.getElementById("portrait-editor-modal");
      bindPortraitStudioEvents();
    }

    modal.style.display = "flex";

    portraitStudioState = {
      activeImg: null,
      zoom: 100,
      panX: 0,
      panY: 0,
      rotation: 0,
      aspectRatio: "3:4",
      filter: "normal",
      brightness: 0,
      contrast: 0,
      saturation: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0
    };

    updateStudioUiControls();

    if (initialImageUrl) {
      loadImgIntoStudio(initialImageUrl);
    } else {
      drawPortraitStudioCanvas();
    }
  }

  function loadImgIntoStudio(src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      portraitStudioState.activeImg = img;
      portraitStudioState.zoom = 100;
      portraitStudioState.panX = 0;
      portraitStudioState.panY = 0;
      updateStudioUiControls();
      drawPortraitStudioCanvas();
    };
    img.onerror = async () => {
      try {
        const resp = await fetch(src);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            portraitStudioState.activeImg = fallbackImg;
            portraitStudioState.zoom = 100;
            portraitStudioState.panX = 0;
            portraitStudioState.panY = 0;
            updateStudioUiControls();
            drawPortraitStudioCanvas();
          };
          fallbackImg.src = reader.result;
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        drawPortraitStudioCanvas();
      }
    };
    img.src = src;
  }

  function drawPortraitStudioCanvas() {
    const canvas = document.getElementById("portrait-studio-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const ratio = portraitStudioState.aspectRatio;
    const targetW = 600;
    const targetH = ratio === "1:1" ? 600 : ratio === "4:5" ? 750 : 800;

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.clearRect(0, 0, targetW, targetH);

    if (!portraitStudioState.activeImg) {
      ctx.fillStyle = "#1c1c1c";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.font = "14px monospace";
      ctx.fillStyle = "#888";
      ctx.textAlign = "center";
      ctx.fillText("NO IMAGE LOADED", targetW / 2, targetH / 2 - 10);
      ctx.font = "11px monospace";
      ctx.fillText("Click 'SELECT IMAGE FILE' to begin", targetW / 2, targetH / 2 + 15);
      return;
    }

    const img = portraitStudioState.activeImg;
    ctx.save();

    const centerX = targetW / 2 + portraitStudioState.panX;
    const centerY = targetH / 2 + portraitStudioState.panY;

    ctx.translate(centerX, centerY);
    ctx.rotate((portraitStudioState.rotation * Math.PI) / 180);

    const imgRatio = img.width / img.height;
    const canvasRatio = targetW / targetH;
    let drawW, drawH;

    if (imgRatio > canvasRatio) {
      drawH = targetH * (portraitStudioState.zoom / 100);
      drawW = drawH * imgRatio;
    } else {
      drawW = targetW * (portraitStudioState.zoom / 100);
      drawH = drawW / imgRatio;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    applyPixelFilters(
      imgData.data,
      targetW,
      targetH,
      portraitStudioState.filter,
      portraitStudioState.brightness,
      portraitStudioState.contrast,
      portraitStudioState.saturation
    );
    ctx.putImageData(imgData, 0, 0);
  }

  function applyPixelFilters(data, width, height, filterName, brightness, contrast, saturation) {
    const bMult = 1 + brightness / 100;
    const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const satMult = 1 + saturation / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (filterName === "canva-noir") {
        let lum = 0.299 * r + 0.587 * g + 0.114 * b;
        let norm = lum / 255;
        norm = (norm - 0.5) * 1.4 + 0.5;
        norm = Math.max(0, Math.min(1, norm));
        r = g = b = norm * 255;
      } else if (filterName === "canva-duotone") {
        let norm = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        r = 17 + norm * (239 - 17);
        g = 17 + norm * (50 - 17);
        b = 17 + norm * (31 - 17);
      } else if (filterName === "canva-duotone-cream") {
        let norm = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        r = 28 + norm * (242 - 28);
        g = 26 + norm * (240 - 26);
        b = 23 + norm * (234 - 23);
      } else if (filterName === "silver-mono") {
        let lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = lum;
      } else if (filterName === "warm-sepia") {
        let sr = r * 0.393 + g * 0.769 + b * 0.189;
        let sg = r * 0.349 + g * 0.686 + b * 0.168;
        let sb = r * 0.272 + g * 0.534 + b * 0.131;
        r = sr; g = sg; b = sb;
      } else if (filterName === "vivid-ink") {
        r = (r - 128) * 1.25 + 128;
        g = (g - 128) * 1.25 + 128;
        b = (b - 128) * 1.25 + 128;
      }

      if (brightness !== 0) {
        r *= bMult;
        g *= bMult;
        b *= bMult;
      }

      if (contrast !== 0) {
        r = cFactor * (r - 128) + 128;
        g = cFactor * (g - 128) + 128;
        b = cFactor * (b - 128) + 128;
      }

      if (saturation !== 0 && !["canva-noir", "canva-duotone", "canva-duotone-cream", "silver-mono"].includes(filterName)) {
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + satMult * (r - gray);
        g = gray + satMult * (g - gray);
        b = gray + satMult * (b - gray);
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
  }

  function bindPortraitStudioEvents() {
    const modal = document.getElementById("portrait-editor-modal");
    if (!modal) return;

    document.getElementById("close-portrait-studio-modal-btn")?.addEventListener("click", () => {
      modal.style.display = "none";
    });

    document.getElementById("ps-trigger-file-btn")?.addEventListener("click", () => {
      document.getElementById("ps-file-input")?.click();
    });

    document.getElementById("ps-file-input")?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        loadImgIntoStudio(url);
      }
    });

    document.getElementById("ps-zoom-slider")?.addEventListener("input", (e) => {
      portraitStudioState.zoom = parseInt(e.target.value, 10);
      document.getElementById("ps-zoom-val").textContent = (portraitStudioState.zoom / 100).toFixed(1) + "x";
      drawPortraitStudioCanvas();
    });

    document.getElementById("ps-panx-slider")?.addEventListener("input", (e) => {
      portraitStudioState.panX = parseInt(e.target.value, 10);
      document.getElementById("ps-panx-val").textContent = portraitStudioState.panX + "px";
      drawPortraitStudioCanvas();
    });

    document.getElementById("ps-pany-slider")?.addEventListener("input", (e) => {
      portraitStudioState.panY = parseInt(e.target.value, 10);
      document.getElementById("ps-pany-val").textContent = portraitStudioState.panY + "px";
      drawPortraitStudioCanvas();
    });

    document.getElementById("ps-brightness-slider")?.addEventListener("input", (e) => {
      portraitStudioState.brightness = parseInt(e.target.value, 10);
      document.getElementById("ps-brightness-val").textContent = portraitStudioState.brightness;
      drawPortraitStudioCanvas();
    });

    document.getElementById("ps-contrast-slider")?.addEventListener("input", (e) => {
      portraitStudioState.contrast = parseInt(e.target.value, 10);
      document.getElementById("ps-contrast-val").textContent = portraitStudioState.contrast;
      drawPortraitStudioCanvas();
    });

    document.getElementById("ps-saturation-slider")?.addEventListener("input", (e) => {
      portraitStudioState.saturation = parseInt(e.target.value, 10);
      document.getElementById("ps-saturation-val").textContent = portraitStudioState.saturation;
      drawPortraitStudioCanvas();
    });

    document.getElementById("ps-rotate-btn")?.addEventListener("click", () => {
      portraitStudioState.rotation = (portraitStudioState.rotation + 90) % 360;
      drawPortraitStudioCanvas();
    });

    document.getElementById("ps-reset-btn")?.addEventListener("click", () => {
      portraitStudioState.zoom = 100;
      portraitStudioState.panX = 0;
      portraitStudioState.panY = 0;
      portraitStudioState.rotation = 0;
      portraitStudioState.brightness = 0;
      portraitStudioState.contrast = 0;
      portraitStudioState.saturation = 0;
      updateStudioUiControls();
      drawPortraitStudioCanvas();
    });

    modal.querySelectorAll(".ratio-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.querySelectorAll(".ratio-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        portraitStudioState.aspectRatio = btn.getAttribute("data-ratio");
        drawPortraitStudioCanvas();
      });
    });

    modal.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        modal.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        portraitStudioState.filter = chip.getAttribute("data-filter");
        drawPortraitStudioCanvas();
      });
    });

    const canvas = document.getElementById("portrait-studio-canvas");
    canvas?.addEventListener("mousedown", (e) => {
      if (!portraitStudioState.activeImg) return;
      portraitStudioState.isDragging = true;
      portraitStudioState.dragStartX = e.clientX - portraitStudioState.panX;
      portraitStudioState.dragStartY = e.clientY - portraitStudioState.panY;
      canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!portraitStudioState.isDragging) return;
      portraitStudioState.panX = Math.max(-250, Math.min(250, e.clientX - portraitStudioState.dragStartX));
      portraitStudioState.panY = Math.max(-250, Math.min(250, e.clientY - portraitStudioState.dragStartY));
      const px = document.getElementById("ps-panx-slider");
      const py = document.getElementById("ps-pany-slider");
      if (px) px.value = portraitStudioState.panX;
      if (py) py.value = portraitStudioState.panY;
      document.getElementById("ps-panx-val").textContent = portraitStudioState.panX + "px";
      document.getElementById("ps-pany-val").textContent = portraitStudioState.panY + "px";
      drawPortraitStudioCanvas();
    });

    window.addEventListener("mouseup", () => {
      if (portraitStudioState.isDragging) {
        portraitStudioState.isDragging = false;
        if (canvas) canvas.style.cursor = "grab";
      }
    });

    document.getElementById("ps-apply-save-btn")?.addEventListener("click", async () => {
      if (!portraitStudioState.activeImg) {
        alert("Please choose an image file first.");
        return;
      }

      const saveBtn = document.getElementById("ps-apply-save-btn");
      saveBtn.disabled = true;
      saveBtn.innerHTML = "PROCESSING & SAVING PORTRAIT... <b>⏳</b>";

      try {
        const cvs = document.getElementById("portrait-studio-canvas");
        const webpDataUrl = cvs.toDataURL("image/webp", 0.92);
        const filename = `portrait-${Date.now()}.webp`;

        const uploadRes = await api("/api/media", {
          method: "POST",
          body: {
            folder: "about",
            filename: filename,
            data: webpDataUrl
          }
        });

        const savedPath = uploadRes.path || `/assets/images/about/${filename}`;
        const pathInput = document.getElementById("portrait-path-input");
        if (pathInput) pathInput.value = savedPath;

        const previewBox = document.getElementById("portrait-studio-preview-box");
        if (previewBox) {
          previewBox.innerHTML = `<img id="portrait-studio-active-img" src="${savedPath}" alt="Portrait Preview"><b></b>`;
        }

        if (state.content && state.content.about) {
          state.content.about.portrait = savedPath;
        }

        modal.style.display = "none";

        // Auto-submit the About form to persist portrait path to content/about.md and rebuild public site
        const aboutFormEl = document.querySelector('form[data-form="about"]');
        if (aboutFormEl) {
          const savedData = await onSubmit(aboutFormEl, "true");
          if (state.content && savedData && typeof savedData === "object") {
            state.content.about = { ...savedData, portrait: savedPath };
          }
          showAdminMsg("Filtered editorial portrait saved and published to public site!");
        } else {
          alert("Editorial portrait successfully cropped, filtered & saved!");
        }
      } catch (err) {
        alert(`Save failed: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "💾 APPLY & SAVE PORTRAIT <b>→</b>";
      }
    });
  }

  function updateStudioUiControls() {
    const modal = document.getElementById("portrait-editor-modal");
    if (!modal) return;
    const z = document.getElementById("ps-zoom-slider");
    if (z) z.value = portraitStudioState.zoom;
    const zv = document.getElementById("ps-zoom-val");
    if (zv) zv.textContent = (portraitStudioState.zoom / 100).toFixed(1) + "x";
    const px = document.getElementById("ps-panx-slider");
    if (px) px.value = portraitStudioState.panX;
    const pxv = document.getElementById("ps-panx-val");
    if (pxv) pxv.textContent = portraitStudioState.panX + "px";
    const py = document.getElementById("ps-pany-slider");
    if (py) py.value = portraitStudioState.panY;
    const pyv = document.getElementById("ps-pany-val");
    if (pyv) pyv.textContent = portraitStudioState.panY + "px";
    const br = document.getElementById("ps-brightness-slider");
    if (br) br.value = portraitStudioState.brightness;
    const brv = document.getElementById("ps-brightness-val");
    if (brv) brv.textContent = portraitStudioState.brightness;
    const ct = document.getElementById("ps-contrast-slider");
    if (ct) ct.value = portraitStudioState.contrast;
    const ctv = document.getElementById("ps-contrast-val");
    if (ctv) ctv.textContent = portraitStudioState.contrast;
    const st = document.getElementById("ps-saturation-slider");
    if (st) st.value = portraitStudioState.saturation;
    const stv = document.getElementById("ps-saturation-val");
    if (stv) stv.textContent = portraitStudioState.saturation;
  }

  async function showImagePickerModalForPortrait() {
    document.querySelector(".admin-modal-root")?.remove();
    let mediaFiles = [];
    try {
      const res = await api("/api/media");
      mediaFiles = Array.isArray(res) ? res : (Array.isArray(state.content?.media) ? state.content.media : []);
    } catch(e) {
      mediaFiles = Array.isArray(state.content?.media) ? state.content.media : [];
    }

    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal image-picker-modal" role="dialog" aria-modal="true" style="width:min(680px, 100%)">
        <p class="admin-kicker">02 / PORTRAIT SELECTOR</p>
        <h2 style="margin-bottom:12px">CHOOSE PORTRAIT IMAGE<span class="red-stop">.</span></h2>

        <div class="image-picker-pane">
          <div class="admin-media-grid-picker" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:10px;max-height:280px;overflow-y:auto;border:1px solid var(--line);padding:10px">
            ${mediaFiles.length ? mediaFiles.map((f) => `
              <div class="portrait-picker-item" data-path="${esc(f.path)}" style="border:1px solid var(--line);padding:6px;cursor:pointer;background:#f7f5ef">
                <img src="${esc(f.path)}" alt="${esc(f.name)}" style="width:100%;height:80px;object-fit:cover">
                <span style="font:9px var(--mono);display:block;margin-top:4px;word-break:break-all">${esc(f.name)}</span>
              </div>
            `).join("") : `<p style="font:11px var(--mono)">No images in library yet.</p>`}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    root.querySelectorAll(".portrait-picker-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const chosenPath = item.getAttribute("data-path");

        // 1. Update the form input and preview in-place BEFORE the modal is removed
        const pathInput = document.getElementById("portrait-path-input");
        if (pathInput) pathInput.value = chosenPath;
        const previewBox = document.getElementById("portrait-studio-preview-box");
        if (previewBox) {
          previewBox.innerHTML = `<img id="portrait-studio-active-img" src="${esc(chosenPath)}" alt="Portrait Preview"><b></b>`;
        }
        // 2. Update in-memory state immediately
        if (state.content && state.content.about) {
          state.content.about.portrait = chosenPath;
        }
        // 3. Close the modal
        root.remove();

        // 4. Persist to server — do NOT call render() afterward; the DOM is already correct
        const aboutFormEl = document.querySelector('form[data-form="about"]');
        if (aboutFormEl) {
          // Show saving indicator inline
          showAdminMsg("Saving portrait…");
          try {
            const savedData = await onSubmit(aboutFormEl, "true");
            // Merge only known about fields back into state, preserving the chosen path
            if (state.content && savedData && typeof savedData === "object") {
              state.content.about = { ...savedData, portrait: chosenPath };
            }
            showAdminMsg("Portrait updated from library and saved!");
          } catch(err) {
            console.error("Auto-save about portrait failed:", err);
            showAdminMsg("Save failed: " + err.message, true);
          }
        }
      });
    });

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-dismiss]")) root.remove();
    });
  }

  function mediaView() {
    const files = Array.isArray(state.content?.media) ? state.content.media : [];
    state.mediaPreviewCache = state.mediaPreviewCache || {};
    const fallbackSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='140' viewBox='0 0 200 140'%3E%3Crect width='100%25' height='100%25' fill='%23edebe6'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' font-size='10' font-family='monospace' fill='%23888'%3E%5B SYNCING ASSET %5D%3C/text%3E%3Ctext x='50%25' y='65%25' dominant-baseline='middle' text-anchor='middle' font-size='8' font-family='monospace' fill='%23e03c31'%3EVERCEL DEPLOYING...%3C/text%3E%3C/svg%3E";

    return chrome(
      "07 / MEDIA",
      `<div class="admin-toolbar"><h1>IMAGES & MEDIA<span class="red-stop">.</span></h1>
        <form data-form="media-upload" class="admin-form" style="grid-template-columns:1fr 1fr auto;align-items:end;max-width:none">
          <label>FOLDER<select name="folder"><option>projects</option><option>blog</option><option>journal</option><option>about</option></select></label>
          <label>FILE<input type="file" name="file" accept="image/*,application/pdf,video/mp4,.pdf,.mp4"></label>
          <button class="admin-btn primary" type="submit">UPLOAD <b>→</b></button>
        </form>
      </div>
      <div class="admin-media">${files.length ? files.map((file) => {
        const refs = file.references || [];
        const refCount = refs.length;
        const previewSrc = state.mediaPreviewCache[file.path] || file.path;
        const refBadge = refCount > 0 
          ? `<span class="admin-badge published" style="display:block;margin:6px 0;white-space:normal;word-break:break-all">USED IN ${refCount} DOC(S)</span>`
          : `<span class="admin-badge draft" style="display:block;margin:6px 0">UNUSED</span>`;
        const ext = String(file.name || "").split(".").pop().toLowerCase();
        let previewHtml = `<img src="${esc(previewSrc)}" alt="${esc(file.name)}" onerror="this.onerror=null;this.src='${fallbackSvg}'">`;
        if (ext === "pdf") {
          previewHtml = `<div style="height:140px;background:#171717;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font:11px var(--mono)"><span style="font-size:32px;margin-bottom:6px">📄</span><b>PDF DOCUMENT</b></div>`;
        } else if (ext === "mp4") {
          previewHtml = `<video src="${esc(previewSrc)}" controls style="width:100%;height:140px;object-fit:cover;background:#000"></video>`;
        }
        return `
        <article class="admin-file">
          ${previewHtml}
          <p><b>${esc(file.name)}</b></p>
          <p style="color:#666;font-size:10px;word-break:break-all">${esc(file.path)}</p>
          ${refBadge}
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="admin-btn" type="button" data-copy="${esc(file.path)}">COPY PATH</button>
            <button class="admin-btn" type="button" data-del-folder="${esc(file.folder)}" data-del-name="${esc(file.name)}" data-ref-count="${refCount}">REMOVE</button>
          </div>
        </article>`;
      }).join("") : "<p>No images yet.</p>"}</div>`
    );
  }

  function collectSections(form) {
    if (!form) return [];
    syncAllWysiwyg(form);
    const cards = form.querySelectorAll(".section-card");
    const sections = [];
    cards.forEach((card) => {
      const labelInput = card.querySelector(".section-label-input");
      const headingInput = card.querySelector(".section-heading-input");
      const bodySource = card.querySelector(".wysiwyg-source");

      const label = labelInput ? labelInput.value.trim() : "";
      const heading = headingInput ? headingInput.value.trim() : "";
      const body = bodySource ? bodySource.value.trim() : "";

      if (label || heading || body) {
        sections.push({ label, heading, body });
      }
    });
    return sections;
  }

  function serializeSectionsToMarkdown(sections) {
    if (!Array.isArray(sections) || !sections.length) return "";
    return sections
      .map((sec) => {
        const parts = [];
        if (sec.heading) {
          parts.push(`## ${sec.heading}`);
        } else if (sec.label) {
          parts.push(`## ${sec.label}`);
        }
        if (sec.body) {
          parts.push(sec.body);
        }
        return parts.join("\n\n");
      })
      .join("\n\n");
  }

  function previewFrame(html) {
    const box = document.createElement("div");
    box.className = "admin-preview";
    box.innerHTML = `<button class="admin-btn" type="button" data-act="close-preview">CLOSE PREVIEW</button><iframe title="Preview"></iframe>`;
    app.appendChild(box);
    const doc = box.querySelector("iframe").contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><link rel="stylesheet" href="/assets/styles.css"></head><body>${html}</body></html>`);
    doc.close();
  }

  function projectPreview(form) {
    const title = esc(formValue(form, "title"));
    const sections = collectSections(form);
    const sectionsHtml = sections
      .map(
        (section) => `
        <section>
          <p class="case-num">${esc(section.label)}</p>
          <h2>${esc(section.heading)}</h2>
          <div>${markdownToHtml(section.body)}</div>
        </section>`
      )
      .join("");
    previewFrame(`<main class="case-study"><header class="case-header"><p class="eyebrow">PROJECT PREVIEW</p><h1>${title}<span class="red-stop">.</span></h1><p>${esc(formValue(form, "description"))}</p></header><article class="case-body">${sectionsHtml}</article></main>`);
  }

  function blogPreview(form) {
    const title = esc(formValue(form, "title"));
    const sections = collectSections(form);
    const bodyMd = serializeSectionsToMarkdown(sections);
    const html = markdownToHtml(bodyMd);
    previewFrame(`<main class="article-page"><header class="case-header"><p class="eyebrow">BLOG PREVIEW</p><h1>${title}<span class="red-stop">.</span></h1><p>${esc(formValue(form, "description"))}</p></header><article class="case-body article-body">${html}</article></main>`);
  }

  function journalPreview(form) {
    const title = esc(formValue(form, "title"));
    const sections = collectSections(form);
    const sectionsHtml = sections
      .map(
        (section, idx) => `
        <section>
          <p class="case-num">${esc(section.label || `0${idx + 1} / SECTION`)}</p>
          <h2>${esc(section.heading || "")}</h2>
          <div>${markdownToHtml(section.body)}</div>
        </section>`
      )
      .join("");
    previewFrame(`<main class="note-page"><header class="note-header"><p class="eyebrow">04 / JOURNAL</p><h1>${title}<span class="red-stop">.</span></h1></header><article class="case-body">${sectionsHtml}</article></main>`);
  }

  async function loadContent() {
    state.content = await api("/api/content");
  }

  async function render() {
    state.error = "";
    try {
      state.config = await api("/api/auth/config");
      const session = await api("/api/session");
      state.user = session.login ? session : null;
    } catch (err) {
      app.innerHTML = `<div class="admin-gate"><h1>ADMIN SERVER REQUIRED<span class="red-stop">.</span></h1><p>Open the admin origin instead of the public Eleventy port. From the project folder run <code>npm.cmd run admin</code> and go to <a href="http://localhost:8787/admin/">http://localhost:8787/admin/</a>.</p><p class="admin-msg error">${esc(err.message)}</p></div>`;
      return;
    }
    if (!state.user) {
      app.innerHTML = gate();
      return;
    }
    if (!state.content) await loadContent();
    const path = hash();
    const parts = path.split("/").filter(Boolean);
    if (path === "/") {
      const overview = await api("/api/overview");
      app.innerHTML = dashboard(overview);
    } else if (path === "/projects") {
      app.innerHTML = chrome("03 / PROJECTS", `<div class="admin-toolbar"><h1>CASE STUDIES<span class="red-stop">.</span></h1><a class="admin-btn primary" href="#/projects/new">NEW PROJECT <b>→</b></a></div>${rows(state.content.projects, (item) => `#/projects/${item.slug}`, "project")}`);
    } else if (path === "/projects/new") {
      app.innerHTML = projectForm({}, true);
    } else if (parts[0] === "projects" && parts[1]) {
      const item = state.content.projects.find((p) => p.slug === parts[1]) || {};
      app.innerHTML = projectForm(item, false);
    } else if (path === "/blog") {
      app.innerHTML = chrome("04 / BLOG", `<div class="admin-toolbar"><h1>ARTICLES<span class="red-stop">.</span></h1><a class="admin-btn primary" href="#/blog/new">NEW ARTICLE <b>→</b></a></div>${rows(state.content.blog, (item) => `#/blog/${item.slug}`, "blog")}`);
    } else if (path === "/blog/new") {
      app.innerHTML = blogForm({}, true);
    } else if (parts[0] === "blog" && parts[1]) {
      app.innerHTML = blogForm(state.content.blog.find((p) => p.slug === parts[1]) || {}, false);
    } else if (path === "/journal") {
      app.innerHTML = chrome("05 / JOURNAL", `<div class="admin-toolbar"><h1>FIELD NOTES<span class="red-stop">.</span></h1><a class="admin-btn primary" href="#/journal/new">NEW NOTE <b>→</b></a></div>${rows(state.content.journal, (item) => `#/journal/${item.id}`, "journal")}`);
    } else if (path === "/journal/new") {
      app.innerHTML = journalForm({}, true);
    } else if (parts[0] === "journal" && parts[1]) {
      app.innerHTML = journalForm(state.content.journal.find((p) => p.id === parts[1]) || {}, false);
    } else if (path === "/notes") {
      app.innerHTML = chrome("06 / NOTES", `<div class="admin-toolbar"><h1>RESEARCH NOTES<span class="red-stop">.</span></h1><a class="admin-btn primary" href="#/notes/new">NEW NOTE <b>→</b></a></div>${rows(state.content.notes || [], (item) => `#/notes/${item.slug}`, "note")}`);
    } else if (path === "/notes/new") {
      app.innerHTML = noteForm({}, true);
    } else if (parts[0] === "notes" && parts[1]) {
      const item = (state.content.notes || []).find((n) => n.slug === parts[1]) || {};
      app.innerHTML = noteForm(item, false);
    } else if (path === "/about") {
      app.innerHTML = aboutForm(state.content.about || {});
    } else if (path === "/settings") {
      app.innerHTML = settingsForm();
    } else if (path === "/media") {
      app.innerHTML = mediaView();
    } else {
      app.innerHTML = chrome("MISSING", "<h1>NOT FOUND<span class='red-stop'>.</span></h1>");
    }
  }

  async function onSubmit(form, publishFlag) {
    const type = form.getAttribute("data-form");
    const isNew = form.getAttribute("data-new") === "1";
    if (type === "passcode-login") {
      const passcode = formValue(form, "passcode");
      await api("/api/auth/passcode", { method: "POST", body: { passcode } });
      await render();
      return;
    }
    if (type === "media-upload") {
      const file = form.elements.file.files[0];
      if (!file) throw new Error("Choose a file first.");
      if (file.size > 25 * 1024 * 1024) throw new Error("File exceeds 25MB limit.");

      const folder = formValue(form, "folder") || "about";
      const baseName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-") || `upload-${Date.now()}`;

      let uploadedPath = "";
      try {
        const presigned = await api("/api/r2-presign", {
          method: "POST",
          body: { folder, filename: baseName, contentType: file.type || "application/octet-stream" }
        });
        if (presigned && presigned.uploadUrl) {
          const r2Res = await fetch(presigned.uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "content-type": file.type || "application/octet-stream" }
          });
          if (r2Res.ok) {
            uploadedPath = presigned.publicUrl;
          }
        }
      } catch (err) {
        console.warn("Direct R2 presigned upload error, falling back to API proxy:", err);
      }

      if (!uploadedPath) {
        const { dataUrl, filename } = await convertToWebp(file);
        const CHUNK_SIZE = 1.5 * 1024 * 1024;
        if (dataUrl.length <= CHUNK_SIZE) {
          const res = await api("/api/media", { method: "POST", body: { folder, filename, data: dataUrl } });
          uploadedPath = res.path;
        } else {
          const uploadId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);
          let lastRes = {};
          for (let i = 0; i < totalChunks; i++) {
            const chunkData = dataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            lastRes = await api("/api/media-chunk", {
              method: "POST",
              body: { uploadId, folder, filename, chunkIndex: i, totalChunks, data: chunkData }
            });
          }
          uploadedPath = lastRes.path || `/assets/images/${folder}/${filename}`;
        }
      }

      state.mediaPreviewCache = state.mediaPreviewCache || {};
      state.mediaPreviewCache[uploadedPath] = URL.createObjectURL(file);
      state.message = "Media uploaded successfully to Cloudflare R2.";
      state.content = null;
      return { path: uploadedPath };
    }
    let published = formValue(form, "published");
    if (publishFlag === "true") published = true;
    if (publishFlag === "false" && type !== "journal") published = false;
    if (type === "project") {
      const sections = collectSections(form);
      const payload = {
        title: formValue(form, "title"),
        slug: formValue(form, "slug"),
        number: formValue(form, "number"),
        date: formValue(form, "date"),
        year: formValue(form, "year"),
        category: formValue(form, "category"),
        description: formValue(form, "description"),
        summary: formValue(form, "summary"),
        technologies: formValue(form, "technologies"),
        headline: formValue(form, "headline"),
        art: formValue(form, "art"),
        artLabel: formValue(form, "artLabel"),
        customArt: formValue(form, "customArt"),
        cover: formValue(form, "cover"),
        github: formValue(form, "github"),
        live: formValue(form, "live"),
        body: serializeSectionsToMarkdown(sections),
        featured: formValue(form, "featured"),
        published,
        sections: sections
      };
      let res;
      if (isNew) res = await api("/api/projects", { method: "POST", body: payload });
      else res = await api("/api/projects/" + encodeURIComponent(payload.slug), { method: "PUT", body: payload });
      state.message = published
        ? "Project saved. Open VIEW SITE to see it on the website."
        : "Draft saved. It stays off the public site until you publish.";
      state.content = null;
      return res;
    }
    if (type === "blog") {
      const sections = collectSections(form);
      const payload = {
        title: formValue(form, "title"),
        slug: formValue(form, "slug"),
        date: formValue(form, "date"),
        category: formValue(form, "category"),
        tags: formValue(form, "tags"),
        description: formValue(form, "description"),
        headline: formValue(form, "headline"),
        relatedProject: formValue(form, "relatedProject"),
        cover: formValue(form, "cover"),
        body: serializeSectionsToMarkdown(sections),
        featured: formValue(form, "featured"),
        published
      };
      let res;
      if (isNew) res = await api("/api/blog", { method: "POST", body: payload });
      else res = await api("/api/blog/" + encodeURIComponent(payload.slug), { method: "PUT", body: payload });
      state.message = published
        ? "Article saved. Open VIEW SITE to see it on the website."
        : "Draft saved. It stays off the public site until you publish.";
      state.content = null;
      return res;
    }
    if (type === "journal") {
      const sections = collectSections(form);
      let did = "";
      let learned = "";
      let next = "";
      sections.forEach((sec, idx) => {
        const label = (sec.label || "").toLowerCase();
        if (label.includes("did") || idx === 0) did = sec.body;
        else if (label.includes("learned") || idx === 1) learned = sec.body;
        else if (label.includes("next") || idx === 2) next = sec.body;
      });
      const payload = {
        date: formValue(form, "date"),
        title: formValue(form, "title"),
        headline: formValue(form, "headline"),
        project: formValue(form, "project"),
        did: did || formValue(form, "did"),
        learned: learned || formValue(form, "learned"),
        next: next || formValue(form, "next"),
        summary: formValue(form, "summary"),
        data: formValue(form, "data"),
        method: formValue(form, "method"),
        result: formValue(form, "result"),
        tools: formValue(form, "tools"),
        published
      };
      const id = form.getAttribute("data-id");
      let res;
      if (isNew) res = await api("/api/journal", { method: "POST", body: payload });
      else res = await api("/api/journal/" + encodeURIComponent(id), { method: "PUT", body: payload });
      state.message = published
        ? "Note saved. Open VIEW SITE to see it on the website."
        : "Journal entry saved as a draft.";
      state.content = null;
      return res;
    }
    if (type === "note") {
      const sections = collectSections(form);
      const payload = {
        title: formValue(form, "title"),
        slug: formValue(form, "slug"),
        date: formValue(form, "date"),
        tags: formValue(form, "tags"),
        body: serializeSectionsToMarkdown(sections),
        published
      };
      const oldSlug = form.getAttribute("data-slug");
      let res;
      if (isNew || !oldSlug) res = await api("/api/notes", { method: "POST", body: payload });
      else res = await api("/api/notes/" + encodeURIComponent(oldSlug), { method: "PUT", body: payload });
      state.message = "Note saved.";
      state.content = null;
      return res;
    }
    if (type === "about") {
      const principles = [];
      for (let i = 0; i < 4; i += 1) {
        principles.push({
          number: String(i + 1).padStart(2, "0"),
          title: formValue(form, `p-title-${i}`),
          home: formValue(form, `p-home-${i}`),
          page: formValue(form, `p-page-${i}`)
        });
      }
      const res = await api("/api/about", {
        method: "PUT",
        body: {
          title: formValue(form, "title"),
          headline: formValue(form, "headline"),
          homeHeadline: formValue(form, "homeHeadline"),
          intro: formValue(form, "intro"),
          homeSummary: formValue(form, "homeSummary"),
          approachEyebrow: formValue(form, "approachEyebrow"),
          approachHeadline: formValue(form, "approachHeadline"),
          approach: formValue(form, "approach"),
          marginNote: formValue(form, "marginNote"),
          portrait: formValue(form, "portrait"),
          principles
        }
      });
      state.message = "About saved. Open VIEW SITE to see it on the homepage and About page.";
      if (state.content) state.content.about = res;
      return res;
    }
    if (type === "settings") {
      const res = await api("/api/settings", {
        method: "PUT",
        body: {
          name: formValue(form, "name"),
          role: formValue(form, "role"),
          siteTitle: formValue(form, "siteTitle"),
          url: formValue(form, "url"),
          email: formValue(form, "email"),
          linkedin: formValue(form, "linkedin"),
          github: formValue(form, "github"),
          description: formValue(form, "description"),
          heroLede: formValue(form, "heroLede"),
          contactBlurb: formValue(form, "contactBlurb"),
          availability: formValue(form, "availability"),
          footerNote: formValue(form, "footerNote"),
          copyrightYear: formValue(form, "copyrightYear")
        }
      });
      state.message = "Settings saved. Open VIEW SITE to see them.";
      state.content = null;
      return res;
    }
    if (type === "skills") {
      const res = await api("/api/skills", {
        method: "PUT",
        body: {
          groups: {
            dataAnalysis: formValue(form, "dataAnalysis"),
            statistics: formValue(form, "statistics"),
            machineLearning: formValue(form, "machineLearning"),
            visualization: formValue(form, "visualization"),
            other: formValue(form, "other")
          }
        }
      });
      state.message = "Skills saved. Open VIEW SITE to see them.";
      state.content = null;
      return res;
    }
    state.content = null;
  }

  app.addEventListener("click", async (event) => {
    const adminToggleBtn = event.target.closest("#admin-mobile-toggle-btn");
    if (adminToggleBtn) {
      const nav = document.getElementById("admin-nav");
      if (nav) {
        const isOpen = nav.classList.toggle("mobile-open");
        adminToggleBtn.classList.toggle("active", isOpen);
        adminToggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      }
      return;
    }

    const adminNavLink = event.target.closest("#admin-nav a, #admin-nav button");
    if (adminNavLink) {
      const nav = document.getElementById("admin-nav");
      const toggleBtn = document.getElementById("admin-mobile-toggle-btn");
      if (nav) nav.classList.remove("mobile-open");
      if (toggleBtn) {
        toggleBtn.classList.remove("active");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    }

    const act = event.target.closest("[data-act]");
    const copy = event.target.closest("[data-copy]");
    const del = event.target.closest("[data-del-name]");
    const publishBtn = event.target.closest("[data-publish]");
    const tabBtn = event.target.closest("[data-wysiwyg-mode]");
    const cmdBtn = event.target.closest("[data-wysiwyg-cmd]");

    try {
      if (tabBtn) {
        const wrapper = tabBtn.closest(".wysiwyg-wrapper");
        const mode = tabBtn.getAttribute("data-wysiwyg-mode");
        const editable = wrapper.querySelector(".wysiwyg-editable");
        const source = wrapper.querySelector(".wysiwyg-source");
        const previewPane = wrapper.querySelector(".wysiwyg-preview-pane");

        wrapper.querySelectorAll(".wysiwyg-tab").forEach((t) => t.classList.remove("active"));
        tabBtn.classList.add("active");

        if (mode === "edit") {
          editable.style.display = "block";
          source.style.display = "none";
          previewPane.style.display = "none";
          editable.innerHTML = markdownToHtml(source.value);
        } else if (mode === "source") {
          editable.style.display = "none";
          source.style.display = "block";
          previewPane.style.display = "none";
          source.value = htmlToMarkdown(editable).trim();
        } else if (mode === "preview") {
          editable.style.display = "none";
          source.style.display = "none";
          previewPane.style.display = "block";
          syncWysiwyg(wrapper);
          const renderedHtml = markdownToHtml(source.value);
          previewPane.innerHTML = `<div class="case-body content-body" style="font-family:var(--sans);line-height:1.6;padding:16px;background:#ffffff;border:1px solid var(--line);min-height:160px">${renderedHtml}</div>`;
          if (window.renderMathInElement) {
            window.renderMathInElement(previewPane, {
              delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '\\[', right: '\\]', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}
              ],
              throwOnError: false
            });
          }
        }
        return;
      }

      if (cmdBtn) {
        const wrapper = cmdBtn.closest(".wysiwyg-wrapper");
        const editable = wrapper.querySelector(".wysiwyg-editable");
        const source = wrapper.querySelector(".wysiwyg-source");
        const cmd = cmdBtn.getAttribute("data-wysiwyg-cmd");
        const activeTab = wrapper.querySelector(".wysiwyg-tab.active");
        const mode = activeTab ? activeTab.getAttribute("data-wysiwyg-mode") : "edit";

        if (mode === "source") {
          if (cmd === "bold") insertIntoTextarea(source, "**", "**", "bold text");
          else if (cmd === "italic") insertIntoTextarea(source, "*", "*", "italic text");
          else if (cmd === "h1") insertIntoTextarea(source, "# ", "", "Heading 1");
          else if (cmd === "h2") insertIntoTextarea(source, "## ", "", "Heading 2");
          else if (cmd === "h3") insertIntoTextarea(source, "### ", "", "Heading 3");
          else if (cmd === "ul") insertIntoTextarea(source, "- ", "", "list item");
          else if (cmd === "ol") insertIntoTextarea(source, "1. ", "", "list item");
          else if (cmd === "code") insertIntoTextarea(source, "```\n", "\n```", "code block");
          else if (cmd === "quote") insertIntoTextarea(source, "> ", "", "quote");
          else if (cmd === "hr") insertIntoTextarea(source, "\n---\n", "", "");
          else if (cmd === "wikilink") {
            const title = prompt("Enter target document title for Wikilink [[ ... ]]:");
            if (title) {
              const alias = prompt("Optional alias (leave empty for none):");
              const tag = alias ? `[[${title}|${alias}]]` : `[[${title}]]`;
              insertIntoTextarea(source, tag);
            }
          }
          else if (cmd === "image") showImagePickerModal(wrapper);
          else if (cmd === "math") showMathPickerModal(wrapper);
        } else {
          editable.focus();
          if (cmd === "bold") document.execCommand("bold", false, null);
          else if (cmd === "italic") document.execCommand("italic", false, null);
          else if (cmd === "h1") document.execCommand("formatBlock", false, "<h1>");
          else if (cmd === "h2") document.execCommand("formatBlock", false, "<h2>");
          else if (cmd === "h3") document.execCommand("formatBlock", false, "<h3>");
          else if (cmd === "ul") document.execCommand("insertUnorderedList", false, null);
          else if (cmd === "ol") document.execCommand("insertOrderedList", false, null);
          else if (cmd === "code") document.execCommand("formatBlock", false, "<pre>");
          else if (cmd === "quote") document.execCommand("formatBlock", false, "<blockquote>");
          else if (cmd === "hr") document.execCommand("insertHorizontalRule", false, null);
          else if (cmd === "wikilink") {
            const title = prompt("Enter target document title for Wikilink [[ ... ]]:");
            if (title) {
              const alias = prompt("Optional alias (leave empty for none):");
              const tag = alias ? `[[${title}|${alias}]]` : `[[${title}]]`;
              document.execCommand("insertText", false, tag);
            }
          }
          else if (cmd === "image") showImagePickerModal(wrapper);
          else if (cmd === "math") showMathPickerModal(wrapper);
        }
        syncWysiwyg(wrapper);
        return;
      }

      const areaBtn = event.target.closest("[data-area-cmd]");
      if (areaBtn) {
        const wrapper = areaBtn.closest(".area-wrapper");
        const textarea = wrapper ? wrapper.querySelector("textarea") : null;
        if (textarea) showMathPickerModal(textarea);
        return;
      }

      const addSecBtn = event.target.closest("[data-act='add-section']");
      if (addSecBtn) {
        const workspace = addSecBtn.closest(".section-editor-workspace") || document.querySelector(".section-editor-workspace");
        const listContainer = workspace ? workspace.querySelector("#sections-list-container") : null;
        if (listContainer) {
          const count = listContainer.querySelectorAll(".section-card").length;
          const newCardHtml = renderSection({ label: `0${count + 1} / NEW SECTION`, heading: "", body: "" }, count);
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = newCardHtml;
          const newCard = tempDiv.firstElementChild;
          listContainer.appendChild(newCard);
          reindexSections(listContainer);
          newCard.querySelector(".section-heading-input")?.focus();
        }
        return;
      }

      const secMoveUp = event.target.closest("[data-act='section-move-up']");
      if (secMoveUp) {
        const card = secMoveUp.closest(".section-card");
        const prev = card?.previousElementSibling;
        if (card && prev) {
          card.parentNode.insertBefore(card, prev);
          reindexSections(card.parentNode);
        }
        return;
      }

      const secMoveDown = event.target.closest("[data-act='section-move-down']");
      if (secMoveDown) {
        const card = secMoveDown.closest(".section-card");
        const next = card?.nextElementSibling;
        if (card && next) {
          card.parentNode.insertBefore(next, card);
          reindexSections(card.parentNode);
        }
        return;
      }

      const secDuplicate = event.target.closest("[data-act='section-duplicate']");
      if (secDuplicate) {
        const card = secDuplicate.closest(".section-card");
        if (card) {
          const wrapper = card.querySelector(".wysiwyg-wrapper");
          if (wrapper) syncWysiwyg(wrapper);

          const labelVal = card.querySelector(".section-label-input")?.value || "";
          const headingVal = card.querySelector(".section-heading-input")?.value || "";
          const bodyVal = card.querySelector(".wysiwyg-source")?.value || "";

          const dupHtml = renderSection({ label: labelVal + " (COPY)", heading: headingVal, body: bodyVal }, 0);
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = dupHtml;
          const dupCard = tempDiv.firstElementChild;
          card.parentNode.insertBefore(dupCard, card.nextSibling);
          reindexSections(card.parentNode);
        }
        return;
      }

      const secDelete = event.target.closest("[data-act='section-delete']");
      if (secDelete) {
        const card = secDelete.closest(".section-card");
        if (card && confirm("Are you sure you want to delete this section?")) {
          const parent = card.parentNode;
          card.remove();
          reindexSections(parent);
        }
        return;
      }

      const secCollapse = event.target.closest("[data-act='section-collapse']");
      if (secCollapse) {
        const card = secCollapse.closest(".section-card");
        if (card) {
          card.classList.toggle("collapsed");
          secCollapse.textContent = card.classList.contains("collapsed") ? "▶" : "▼";
        }
        return;
      }
      const openStudioBtn = event.target.closest("#open-portrait-studio-btn");
      const pickLibraryBtn = event.target.closest("#pick-library-portrait-btn");
      const clearPortraitBtn = event.target.closest("#clear-portrait-btn");
      const uploadResumeBtn = event.target.closest("#upload-resume-btn");

      if (uploadResumeBtn) {
        const fileInput = document.getElementById("resume-pdf-input");
        const file = fileInput ? fileInput.files[0] : null;
        if (!file) {
          alert("Please select a .pdf file first.");
          return;
        }
        if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
          alert("File must be a .pdf document.");
          return;
        }
        if (file.size > 25 * 1024 * 1024) {
          alert("Resume PDF exceeds 25MB limit.");
          return;
        }
        const prog = showProgressModal({ kicker: "02 / ABOUT", title: "UPLOADING RESUME PDF...", copy: "Processing resume file and updating site." });
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            await api("/api/resume", {
              method: "POST",
              body: { filename: file.name, data: reader.result }
            });
            prog.finish("RESUME UPDATED", "Your resume PDF has been updated and published to the website.");
            const msg = document.getElementById("resume-upload-msg");
            if (msg) msg.innerHTML = '<span style="color:#2a7b4c;font-weight:700">✓ Resume PDF updated successfully! View or download on site.</span>';
          } catch (err) {
            prog.fail(err.message);
          }
        };
        reader.readAsDataURL(file);
        return;
      }

      if (directUploadBtn) {
        document.getElementById("portrait-direct-upload-input")?.click();
        return;
      }

      if (openStudioBtn) {
        const pathVal = document.getElementById("portrait-path-input")?.value.trim() || "";
        openPortraitStudio(pathVal);
        return;
      }

      if (pickLibraryBtn) {
        showImagePickerModalForPortrait();
        return;
      }

      if (clearPortraitBtn) {
        const pathInput = document.getElementById("portrait-path-input");
        if (pathInput) pathInput.value = "";
        const previewBox = document.getElementById("portrait-studio-preview-box");
        if (previewBox) {
          previewBox.innerHTML = `<div class="portrait-placeholder-box"><span>PORTRAIT<br>PLACEHOLDER</span></div><b></b>`;
        }
        if (state.content && state.content.about) {
          state.content.about.portrait = "";
        }
        const aboutFormEl = document.querySelector('form[data-form="about"]');
        if (aboutFormEl) {
          try {
            const savedData = await onSubmit(aboutFormEl, "true");
            if (state.content && savedData && typeof savedData === "object") {
              state.content.about = { ...savedData, portrait: "" };
            }
            showAdminMsg("Portrait removed and saved!");
          } catch(err) {
            console.error("Auto-save removed portrait failed:", err);
            showAdminMsg("Remove portrait failed: " + err.message, true);
          }
        }
        return;
      }

      if (act) {
        const name = act.getAttribute("data-act");
        if (name === "logout") {
          await api("/api/auth/logout", { method: "POST", body: {} });
          state.user = null;
          state.content = null;
          await render();
        }
        if (name === "dev") {
          await api("/api/auth/dev", { method: "POST", body: {} });
          await render();
        }
        if (name === "close-preview") act.closest(".admin-preview").remove();
        if (name === "preview-project") { syncAllWysiwyg(act.closest("form")); projectPreview(act.closest("form")); }
        if (name === "preview-blog") { syncAllWysiwyg(act.closest("form")); blogPreview(act.closest("form")); }
        if (name === "preview-journal") { syncAllWysiwyg(act.closest("form")); journalPreview(act.closest("form")); }
        if (name === "pick-custom-art") {
          showMediaSelectModal((selectedPath) => {
            const input = document.getElementById("field-customArt");
            if (input) input.value = selectedPath;
          });
        }
        if (name === "pick-cover") {
          showMediaSelectModal((selectedPath) => {
            const input = document.getElementById("field-cover");
            if (input) input.value = selectedPath;
          });
        }
        if (name === "delete-project") {
          const form = act.closest("form");
          const slug = act.getAttribute("data-slug") || form?.getAttribute("data-slug");
          const title = act.getAttribute("data-title") || slug || "Project";
          showDeleteConfirmModal({
            kicker: "03 / DELETE PROJECT",
            type: "project",
            title,
            onConfirm: async () => {
              const prog = showProgressModal({ kicker: "03 / PROJECT", title: "DELETING PROJECT...", copy: "Removing project and rebuilding site." });
              try {
                await api(`/api/projects/${encodeURIComponent(slug)}`, { method: "DELETE" });
                state.content = null;
                prog.finish("PROJECT DELETED", `Project "${title}" has been deleted.`);
                go("/projects");
              } catch (e) {
                prog.fail(e.message);
              }
            }
          });
        }
        if (name === "delete-blog") {
          const form = act.closest("form");
          const slug = act.getAttribute("data-slug") || form?.getAttribute("data-slug");
          const title = act.getAttribute("data-title") || slug || "Article";
          showDeleteConfirmModal({
            kicker: "04 / DELETE ARTICLE",
            type: "article",
            title,
            onConfirm: async () => {
              const prog = showProgressModal({ kicker: "04 / BLOG", title: "DELETING ARTICLE...", copy: "Removing article and rebuilding site." });
              try {
                await api(`/api/blog/${encodeURIComponent(slug)}`, { method: "DELETE" });
                state.content = null;
                prog.finish("ARTICLE DELETED", `Article "${title}" has been deleted.`);
                go("/blog");
              } catch (e) {
                prog.fail(e.message);
              }
            }
          });
        }
        if (name === "delete-journal") {
          const form = act.closest("form");
          const id = act.getAttribute("data-id") || form?.getAttribute("data-id");
          const title = act.getAttribute("data-title") || id || "Journal Entry";
          showDeleteConfirmModal({
            kicker: "05 / DELETE JOURNAL",
            type: "journal entry",
            title,
            onConfirm: async () => {
              const prog = showProgressModal({ kicker: "05 / JOURNAL", title: "DELETING JOURNAL ENTRY...", copy: "Removing entry and rebuilding site." });
              try {
                await api(`/api/journal/${encodeURIComponent(id)}`, { method: "DELETE" });
                state.content = null;
                prog.finish("JOURNAL ENTRY DELETED", `Journal entry "${title}" has been deleted.`);
                go("/journal");
              } catch (e) {
                prog.fail(e.message);
              }
            }
          });
        }
        if (name === "delete-note") {
          const form = act.closest("form");
          const slug = act.getAttribute("data-slug") || form?.getAttribute("data-slug");
          const title = act.getAttribute("data-title") || slug || "Note";
          showDeleteConfirmModal({
            kicker: "06 / DELETE NOTE",
            type: "note",
            title,
            onConfirm: async () => {
              const prog = showProgressModal({ kicker: "06 / NOTE", title: "DELETING NOTE...", copy: "Removing note and rebuilding site." });
              try {
                await api(`/api/notes/${encodeURIComponent(slug)}`, { method: "DELETE" });
                state.content = null;
                prog.finish("NOTE DELETED", `Note "${title}" has been deleted.`);
                go("/notes");
              } catch (e) {
                prog.fail(e.message);
              }
            }
          });
        }
        if (name === "promote-note") {
          const form = act.closest("form");
          const slug = form.getAttribute("data-slug");
          const targetType = act.getAttribute("data-target");
          const ok = await askCommit({
            kicker: "06 / PROMOTE NOTE",
            title: `PROMOTE TO ${targetType.toUpperCase()}`,
            copy: `This note will be promoted to a draft ${targetType}.`,
            confirmLabel: "YES, PROMOTE",
            primary: true
          });
          if (!ok) return;
          const prog = showProgressModal({ kicker: "06 / NOTE", title: "PROMOTING NOTE...", copy: "Converting note to content draft." });
          try {
            await api(`/api/notes/${encodeURIComponent(slug)}/promote`, { method: "POST", body: { targetType } });
            state.content = null;
            prog.finish("NOTE PROMOTED", `Note promoted to ${targetType} draft.`);
            go(`/${targetType === "blog" ? "blog" : "projects"}`);
          } catch (e) {
            prog.fail(e.message);
          }
        }
      }
      if (copy) {
        await navigator.clipboard.writeText(copy.getAttribute("data-copy"));
        state.message = "Path copied.";
        await render();
      }
      if (del) {
        const folder = del.getAttribute("data-del-folder");
        const filename = del.getAttribute("data-del-name");
        const refCount = Number(del.getAttribute("data-ref-count") || 0);
        let confirmCopy = "This will delete the file and rebuild the public site.";
        let confirmTitle = "REMOVE IMAGE";
        let confirmKicker = "07 / MEDIA";
        if (refCount > 0) {
          confirmKicker = "07 / SAFE MEDIA DELETION WARNING";
          confirmTitle = "IMAGE IS IN USE!";
          confirmCopy = `WARNING: This image is currently referenced by ${refCount} document(s). Deleting it will cause broken image links on the live site. Are you sure you want to FORCE delete?`;
        }
        const ok = await askCommit({
          kicker: confirmKicker,
          title: confirmTitle,
          copy: confirmCopy,
          confirmLabel: refCount > 0 ? "FORCE REMOVE" : "YES, REMOVE",
          primary: true
        });
        if (!ok) return;
        const prog = showProgressModal({ kicker: "07 / MEDIA", title: "REMOVING IMAGE...", copy: "Deleting file and rebuilding static pages." });
        try {
          await api("/api/media", { method: "DELETE", body: { folder, filename, force: true } });
          state.content = null;
          prog.finish("IMAGE REMOVED", "File has been deleted and site rebuilt.");
        } catch(e) {
          prog.fail(e.message);
        }
      }
      if (publishBtn && publishBtn.tagName === "BUTTON" && publishBtn.type === "submit") {
        publishBtn.form.dataset.nextPublish = publishBtn.getAttribute("data-publish");
      }
    } catch (err) {
      state.error = err.message;
      await render();
    }
  });

  app.addEventListener("input", (event) => {
    const portraitInput = event.target.closest("#portrait-path-input");
    if (portraitInput) {
      const val = portraitInput.value.trim();
      const previewBox = document.getElementById("portrait-studio-preview-box");
      if (previewBox) {
        previewBox.innerHTML = val 
          ? `<img id="portrait-studio-active-img" src="${esc(val)}" alt="Portrait Preview"><b></b>`
          : `<div class="portrait-placeholder-box"><span>PORTRAIT<br>PLACEHOLDER</span></div><b></b>`;
      }
    }
    const editable = event.target.closest(".wysiwyg-editable");
    if (editable) {
      const wrapper = editable.closest(".wysiwyg-wrapper");
      syncWysiwyg(wrapper);
    }
  });

  app.addEventListener("change", async (event) => {
    const directFileInput = event.target.closest("#portrait-direct-upload-input");
    if (directFileInput && directFileInput.files && directFileInput.files[0]) {
      const file = directFileInput.files[0];
      const directBtn = document.getElementById("portrait-direct-upload-btn");
      if (directBtn) {
        directBtn.disabled = true;
        directBtn.innerHTML = "UPLOADING TO R2... ⏳";
      }

      try {
        const folder = "about";
        const baseName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-") || `portrait-${Date.now()}`;
        let uploadedPath = "";

        try {
          const presigned = await api("/api/r2-presign", {
            method: "POST",
            body: { folder, filename: baseName, contentType: file.type || "image/webp" }
          });
          if (presigned && presigned.uploadUrl) {
            const r2Res = await fetch(presigned.uploadUrl, {
              method: "PUT",
              body: file,
              headers: { "content-type": file.type || "image/webp" }
            });
            if (r2Res.ok) {
              uploadedPath = presigned.publicUrl;
            }
          }
        } catch(e) {
          console.warn("R2 presigned error, falling back to API proxy:", e);
        }

        if (!uploadedPath) {
          const { dataUrl, filename } = await convertToWebp(file);
          const res = await api("/api/media", {
            method: "POST",
            body: { folder, filename, data: dataUrl }
          });
          uploadedPath = res.path;
        }

        const pathInput = document.getElementById("portrait-path-input");
        if (pathInput) pathInput.value = uploadedPath;

        const previewBox = document.getElementById("portrait-studio-preview-box");
        if (previewBox) {
          previewBox.innerHTML = `<img id="portrait-studio-active-img" src="${uploadedPath}" alt="Portrait Preview"><b></b>`;
        }

        if (state.content && state.content.about) {
          state.content.about.portrait = uploadedPath;
        }

        const aboutFormEl = document.querySelector('form[data-form="about"]');
        if (aboutFormEl) {
          const savedData = await onSubmit(aboutFormEl, "true");
          if (state.content && savedData && typeof savedData === "object") {
            state.content.about = { ...savedData, portrait: uploadedPath };
          }
          showAdminMsg("New portrait image uploaded and saved to Cloudflare R2!");
        }
      } catch(err) {
        alert("Upload failed: " + err.message);
      } finally {
        if (directBtn) {
          directBtn.disabled = false;
          directBtn.innerHTML = "📤 UPLOAD NEW FILE <b>→</b>";
        }
        directFileInput.value = "";
      }
    }
  });

  app.addEventListener("dragover", (event) => {
    const editable = event.target.closest(".wysiwyg-editable");
    if (editable) {
      event.preventDefault();
      editable.style.borderColor = "var(--red)";
    }
  });

  app.addEventListener("dragleave", (event) => {
    const editable = event.target.closest(".wysiwyg-editable");
    if (editable) {
      editable.style.borderColor = "";
    }
  });

  app.addEventListener("drop", async (event) => {
    const editable = event.target.closest(".wysiwyg-editable");
    if (!editable) return;
    event.preventDefault();
    editable.style.borderColor = "";
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      handleDirectImageUpload(files[0], editable);
    }
  });

  app.addEventListener("paste", async (event) => {
    const editable = event.target.closest(".wysiwyg-editable");
    if (!editable) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        event.preventDefault();
        const file = items[i].getAsFile();
        handleDirectImageUpload(file, editable);
        break;
      }
    }
  });

  async function handleDirectImageUpload(file, editable) {
    if (!file) return;
    const wrapper = editable.closest(".wysiwyg-wrapper");
    try {
      const folder = "projects";
      const rawFilename = file.name || `inline-${Date.now()}.png`;
      const fileToConvert = file.name ? file : new File([file], rawFilename, { type: file.type });
      const { dataUrl, filename } = await convertToWebp(fileToConvert);
      const res = await api("/api/media", {
        method: "POST",
        body: { folder, filename, data: dataUrl }
      });
      const imgMarkdown = `\n![${filename}](${res.path})\n`;
      editable.focus();
      document.execCommand("insertText", false, imgMarkdown);
      syncWysiwyg(wrapper);
      state.content = null;
      await loadContent();
    } catch(e) {
      alert(`Image upload failed: ${e.message}`);
    }
  }

  app.addEventListener("submit", async (event) => {
    const form = event.target.closest("form");
    if (!form) return;
    event.preventDefault();
    syncAllWysiwyg(form);
    const publishFlag = form.dataset.nextPublish || "false";
    const type = form.getAttribute("data-form");
    if (type === "passcode-login") {
      try {
        await onSubmit(form, publishFlag);
      } catch (err) {
        state.error = err.message;
        await render();
      }
      return;
    }
    const name = formValue(form, "title") || formValue(form, "name") || "this entry";
    try {
      const ok = await askCommit(commitPrompt(type, publishFlag, form));
      if (!ok) {
        delete form.dataset.nextPublish;
        return;
      }
      
      const isPublish = publishFlag === "true" || type === "journal" || ["about", "settings", "skills", "media-upload"].includes(type);
      const isMedia = type === "media-upload";
      const prog = showProgressModal({
        kicker: isMedia ? "07 / MEDIA UPLOAD" : (isPublish ? "00 / PUBLISHING" : "00 / SAVING DRAFT"),
        title: isMedia ? "SAVING MEDIA ASSETS..." : (isPublish ? "PROCESSING & SAVING..." : "SAVING DRAFT..."),
        copy: isMedia
          ? `"${name}" is being processed and saved to Cloudflare R2 media storage.`
          : `"${name}" is being saved to content store.`
      });

      let savedResult;
      try {
        savedResult = await onSubmit(form, publishFlag);
      } catch (err) {
        prog.fail(err.message);
        return;
      }

      let viewUrl = "";
      if (savedResult && savedResult.url && isPublish) viewUrl = savedResult.url;

      const sync = savedResult && savedResult.githubSync;
      let successTitle = isMedia ? "UPLOADED SUCCESSFULLY" : (isPublish ? "PUBLISHED SUCCESSFULLY" : "DRAFT SAVED SUCCESSFULLY");
      let successCopy = isMedia
        ? `"${name}" has been uploaded to Cloudflare R2 media storage.`
        : (isPublish
          ? `"${name}" has been published and updated.`
          : `"${name}" has been saved as a draft.`);
      let isWarning = false;

      if (sync && sync.error) {
        isWarning = true;
        successTitle = "SAVED LOCALLY (SYNC ERROR)";
        successCopy = `"${name}" was saved locally, but GitHub sync failed:\n\n${sync.error}\n\nPlease check your GITHUB_TOKEN and repository permissions on Vercel.`;
      } else if (sync && sync.synced === false && sync.reason === "not_configured") {
        isWarning = true;
        successTitle = "SAVED LOCALLY (SYNC WARNING)";
        successCopy = `"${name}" was saved locally, but GitHub sync is NOT configured.\n\nTo auto-deploy changes to the public site, set GITHUB_TOKEN, GITHUB_REPO_OWNER, and GITHUB_REPO_NAME in Vercel environment variables.`;
      } else if (sync && sync.synced) {
        successCopy += `\n\n✅ GitHub commit: ${sync.sha ? sync.sha.slice(0, 7) : "synced"} (Vercel build triggered)`;
      }

      prog.finish(successTitle, successCopy, viewUrl, isWarning);

      if (type === "project") go("/projects");
      if (type === "blog") go("/blog");
      if (type === "journal") go("/journal");
    } catch (err) {
      state.error = err.message;
      let msgEl = document.querySelector(".admin-main .admin-msg.error");
      if (!msgEl) {
        msgEl = document.createElement("p");
        msgEl.className = "admin-msg error";
        const main = document.querySelector(".admin-main");
        if (main) main.insertBefore(msgEl, main.firstChild);
      }
      if (msgEl) msgEl.textContent = state.error;
    }
  });

  window.addEventListener("hashchange", () => {
    state.message = "";
    render();
  });
  render();
})();
