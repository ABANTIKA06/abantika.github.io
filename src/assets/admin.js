(function () {
  const app = document.getElementById("admin-app");
  if (!app) return;

  const state = { user: null, config: {}, content: null, message: "", error: "" };

  const ICONS = {
    back: `<svg class="btn-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
    save: `<svg class="btn-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
    preview: `<svg class="btn-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    publish: `<svg class="btn-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`
  };

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
    render(true);
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
    const formPublished = Boolean(formValue(form, "published"));
    const publishing =
      publishFlag === "true" ||
      (publishFlag !== "false" && formPublished) ||
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

  function slugify(val) {
    return String(val || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function formValue(form, name) {
    const field = form.elements[name];
    if (!field) return "";
    if (field.type === "checkbox") return field.checked;
    return field.value;
  }

  function input(label, name, value, extra = "", isRequired = false) {
    const reqBadge = isRequired ? `<span class="req-star">*</span><span class="req-tag">REQUIRED</span>` : "";
    return `
      <label class="admin-field">
        <span class="admin-label-text">${esc(label)}${reqBadge}</span>
        <input name="${esc(name)}" value="${esc(value || "")}" ${extra}>
      </label>`;
  }
  function area(label, name, value, cls = "", isRequired = false) {
    const reqBadge = isRequired ? `<span class="req-star">*</span><span class="req-tag">REQUIRED</span>` : "";
    return `
      <div class="wide area-wrapper" style="margin-bottom:16px">
        <div class="area-header-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="admin-label-text">${esc(label)}${reqBadge}</span>
          <button type="button" class="wysiwyg-btn math-btn" data-area-cmd="math" title="Insert LaTeX Math" style="font-size:10px;padding:3px 8px;font-weight:700;color:var(--accent-red,#e03c31)">∑ LATEX MATH</button>
        </div>
        <textarea class="${cls}" name="${esc(name)}">${esc(value || "")}</textarea>
      </div>`;
  }
  function check(label, name, on) {
    return `
      <label class="admin-field admin-check-field">
        <span class="admin-label-text">${esc(label)}</span>
        <div class="admin-check-input">
          <input type="checkbox" name="${esc(name)}" ${on ? "checked" : ""}>
          <span class="admin-check-text">${esc(label)}</span>
        </div>
      </label>`;
  }
  function sel(label, name, value, options) {
    return `
      <label class="admin-field">
        <span class="admin-label-text">${esc(label)}</span>
        <select name="${esc(name)}">${options
          .map((opt) => `<option value="${esc(opt.value)}" ${opt.value === value ? "selected" : ""}>${esc(opt.label)}</option>`)
          .join("")}</select>
      </label>`;
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
        } else if (tag === "table") {
          let tableMd = "\n\n";
          const trs = child.querySelectorAll("tr");
          let hasHeader = false;
          trs.forEach((tr, rIdx) => {
            const ths = tr.querySelectorAll("th");
            const tds = tr.querySelectorAll("td");
            if (ths.length > 0) {
              hasHeader = true;
              tableMd += "| " + Array.from(ths).map(th => htmlToMarkdown(th).trim()).join(" | ") + " |\n";
              tableMd += "| " + Array.from(ths).map(th => {
                const align = th.style.textAlign || "left";
                if (align === "center") return ":---:";
                if (align === "right") return "---:";
                return ":---";
              }).join(" | ") + " |\n";
            } else if (tds.length > 0) {
              if (rIdx === 0 && !hasHeader) {
                tableMd += "| " + Array.from(tds).map((_, i) => `Header ${i+1}`).join(" | ") + " |\n";
                tableMd += "| " + Array.from(tds).map(() => ":---").join(" | ") + " |\n";
                hasHeader = true;
              }
              tableMd += "| " + Array.from(tds).map(td => htmlToMarkdown(td).trim()).join(" | ") + " |\n";
            }
          });
          md += tableMd + "\n";
        } else {
          md += inner;
        }
      }
    });
    return md.replace(/\n{3,}/g, "\n\n");
  }

  function convertMarkdownTablesToHtml(text) {
    const tableRegex = /(?:(?:^|\n)\|[^\n]+\|(?:$|\n))+/g;
    return text.replace(tableRegex, (block) => {
      const lines = block.trim().split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return block;
      
      if (!lines[1].includes("-")) {
        return block;
      }
      
      const parseRow = (rowStr) => {
        let parts = rowStr.split("|");
        if (parts.length > 1 && parts[0].trim() === "") parts.shift();
        if (parts.length > 0 && parts[parts.length - 1].trim() === "") parts.pop();
        return parts.map(p => p.trim());
      };

      const headers = parseRow(lines[0]);
      const alignments = parseRow(lines[1]).map(col => {
        if (col.startsWith(":") && col.endsWith(":")) return "center";
        if (col.endsWith(":")) return "right";
        if (col.startsWith(":")) return "left";
        return "left";
      });

      let tableHtml = '<div class="table-responsive"><table class="bauhaus-table"><thead><tr>';
      headers.forEach((h, i) => {
        const align = alignments[i] || "left";
        tableHtml += `<th style="text-align:${align}">${h}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      for (let r = 2; r < lines.length; r++) {
        const rowCells = parseRow(lines[r]);
        if (rowCells.length === 0) continue;
        tableHtml += '<tr>';
        rowCells.forEach((c, i) => {
          const align = alignments[i] || "left";
          tableHtml += `<td style="text-align:${align}">${c}</td>`;
        });
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table></div>';
      return "\n" + tableHtml + "\n";
    });
  }

  function markdownToHtml(mdText) {
    if (!mdText) return "";
    let html = esc(String(mdText));
    html = html.replace(/&lt;span style=&quot;(.*?)&quot;&gt;(.*?)&lt;\/span&gt;/gi, '<span style="$1">$2</span>');
    html = html.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, "<u>$1</u>");
    html = html.replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/gi, "<s>$1</s>");
    html = convertMarkdownTablesToHtml(html);
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

    const tableBlocks = [];
    html = html.replace(/<div class="table-responsive">[\s\S]*?<\/div>/g, (m) => {
      tableBlocks.push(m);
      return `___TABLE_BLOCK_${tableBlocks.length - 1}___`;
    });

    html = html.replace(/\n/g, "<br>");

    tableBlocks.forEach((tbl, idx) => {
      html = html.replace(`___TABLE_BLOCK_${idx}___`, tbl);
    });

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
          <button type="button" class="wysiwyg-btn table-btn" data-wysiwyg-cmd="table" title="Generate & Format Table" style="font-weight:700">⊞ TABLE</button>
          <button type="button" class="wysiwyg-btn chart-btn" data-wysiwyg-cmd="chart" title="Generate & Format Interactive Data Chart" style="font-weight:700;color:var(--accent-red,#e03c31)">📊 CHART</button>
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
        <div class="admin-header-controls">
          <button type="button" class="header-dot admin-header-dot" id="admin-theme-toggle" aria-label="Toggle theme" title="Toggle Dark/Light Mode"></button>
          <button type="button" class="mobile-menu-btn admin-mobile-toggle" id="admin-mobile-toggle-btn" aria-label="Toggle admin navigation menu" aria-expanded="false">
            <span class="menu-bar"></span>
            <span class="menu-bar"></span>
            <span class="menu-bar"></span>
          </button>
        </div>
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
          <a href="#/trash" class="${isCurrent("/trash") ? "active" : ""}"><i>09</i> RECYCLE BIN</a>
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
        <button type="button" class="header-dot admin-header-dot" id="admin-gate-theme-toggle" aria-label="Toggle theme" title="Toggle Dark/Light Mode"></button>
      </div>
      <div class="admin-gate">
        <p class="admin-kicker">00 / PRIVATE CONSOLE</p>
        <h1>ABANTIKA / ADMIN<span class="red-stop">.</span></h1>
        <p>Enter your secret access passcode to unlock the workspace console.</p>
        ${state.error ? `<p class="admin-msg error">${esc(state.error)}</p>` : ""}
        
        <form class="admin-form" data-form="passcode-login" style="max-width:380px;margin:24px 0">
          <label style="font:11px var(--mono)">SECRET ACCESS PASSCODE
            <input type="password" name="passcode" placeholder="Enter secret code..." required style="padding:10px;font-size:14px">
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
        <a class="admin-stat" href="#/projects" style="text-decoration:none;color:inherit;cursor:pointer;display:block"><span>PROJECTS</span><strong>${overview.projects.published}</strong><p>${overview.projects.draft} DRAFT / ${overview.projects.total} TOTAL <b>→</b></p></a>
        <a class="admin-stat" href="#/blog" style="text-decoration:none;color:inherit;cursor:pointer;display:block"><span>BLOG</span><strong>${overview.blog.published}</strong><p>${overview.blog.draft} DRAFT / ${overview.blog.total} TOTAL <b>→</b></p></a>
        <a class="admin-stat" href="#/journal" style="text-decoration:none;color:inherit;cursor:pointer;display:block"><span>JOURNAL</span><strong>${overview.journal.total}</strong><p>${overview.journal.published} PUBLISHED / ${overview.journal.draft} DRAFT <b>→</b></p></a>
        <a class="admin-stat" href="#/trash" style="text-decoration:none;color:inherit;cursor:pointer;display:block"><span>RECYCLE BIN</span><strong>${overview.trash ? overview.trash.total : 0}</strong><p>6-MONTH RETENTION <b>→</b></p></a>
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

  function showSudoConfirmModal({ kicker, title, message, promptLabel, expectedText, buttonLabel, isDanger = true, onConfirm }) {
    document.querySelector(".admin-modal-root")?.remove();
    const root = document.createElement("div");
    root.className = "admin-modal-root";
    const expected = String(expectedText || "").trim();
    const normalize = (str) => String(str || "").replace(/\s+/g, " ").trim().toUpperCase();
    const borderColor = isDanger ? "var(--red)" : "var(--line)";
    const iconHtml = isDanger ? `
      <svg class="admin-cross-icon" viewBox="0 0 52 52">
        <circle class="admin-cross-circle" cx="26" cy="26" r="23" />
        <path class="admin-cross-line1" d="M17 17 L35 35" />
        <path class="admin-cross-line2" d="M35 17 L17 35" />
      </svg>` : `
      <svg class="admin-cross-icon" viewBox="0 0 52 52" style="color:#22a722">
        <circle class="admin-cross-circle" cx="26" cy="26" r="23" stroke="#22a722" />
        <path d="M16 26 L23 33 L36 19" fill="none" stroke="#22a722" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal" role="dialog" aria-modal="true" style="border:2px solid ${borderColor}">
        <div class="admin-tick-container">
          ${iconHtml}
          <div>
            <p class="admin-kicker" style="color:${isDanger ? 'var(--red)' : '#1d1d1d'};margin:0">${esc(kicker || "CONFIRM ACTION")}</p>
            <h2 id="admin-modal-title" style="margin:4px 0 0;font-size:clamp(22px, 3vw, 30px);${isDanger ? 'color:var(--red)' : ''}">${esc(title)}<span class="red-stop">.</span></h2>
          </div>
        </div>
        ${message ? `<p style="margin-top:12px;font-size:14px;line-height:1.5">${message}</p>` : ""}
        <div class="sudo-delete-box" style="margin-top:16px">
          <label for="sudo-confirm-input">${promptLabel || `To confirm, please type <code>${esc(expected)}</code> below:`}</label>
          <input type="text" id="sudo-confirm-input" class="sudo-delete-input" placeholder="${esc(expected)}" autocomplete="off" spellcheck="false" />
        </div>
        <div class="admin-actions" style="margin-top:20px">
          <button type="button" class="admin-btn" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn ${isDanger ? 'admin-btn-danger' : 'primary'}" id="confirm-sudo-action-btn" disabled>${esc(buttonLabel || "CONFIRM")}</button>
        </div>
      </div>`;

    const inputEl = root.querySelector("#sudo-confirm-input");
    const confirmBtn = root.querySelector("#confirm-sudo-action-btn");

    const checkMatch = () => {
      const val = normalize(inputEl.value);
      const exp = normalize(expected);
      if (val === exp) {
        confirmBtn.removeAttribute("disabled");
        inputEl.classList.add("valid");
      } else {
        confirmBtn.setAttribute("disabled", "true");
        inputEl.classList.remove("valid");
      }
    };

    inputEl?.addEventListener("input", checkMatch);

    const close = () => {
      document.removeEventListener("keydown", onKey);
      root.remove();
    };

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Enter" && !confirmBtn.hasAttribute("disabled")) {
        event.preventDefault();
        close();
        onConfirm();
      }
    };

    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-dismiss]")) {
        close();
      } else if (event.target.closest("#confirm-sudo-action-btn")) {
        if (!confirmBtn.hasAttribute("disabled")) {
          close();
          onConfirm();
        }
      }
    });

    document.addEventListener("keydown", onKey);
    document.body.appendChild(root);
    setTimeout(() => inputEl?.focus(), 100);
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
          You are about to move <strong>"${esc(title)}"</strong> to the Recycle Bin.
          It will be preserved in the Recycle Bin for 6 months before being permanently erased. You can restore it anytime.
        </p>
        <div class="sudo-delete-box">
          <label for="sudo-delete-input">To confirm deletion, please type <code>sudo delete</code> below:</label>
          <input type="text" id="sudo-delete-input" class="sudo-delete-input" placeholder="sudo delete" autocomplete="off" spellcheck="false" />
        </div>
        <div class="admin-actions" style="margin-top:20px">
          <button type="button" class="admin-btn" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn admin-btn-danger" id="confirm-sudo-delete-btn" disabled>MOVE TO RECYCLE BIN</button>
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
            <button type="button" class="wysiwyg-tab section-collapse-btn" data-act="section-collapse" title="Collapse Section Content">—</button>
            <button type="button" class="wysiwyg-tab" data-act="section-move-up" title="Move Section Up">▲</button>
            <button type="button" class="wysiwyg-tab" data-act="section-move-down" title="Move Section Down">▼</button>
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
    const dateVal = item.dateISO || (item.date && String(item.date).slice(0, 10)) || today;
    const sections = ensureSections(item, [
      { label: "01 / PROBLEM", heading: "THE QUESTION", body: "" },
      { label: "02 / DATA", heading: "THE EVIDENCE", body: "" },
      { label: "03 / METHODOLOGY", heading: "THE METHOD", body: "" },
      { label: "04 / RESULTS", heading: "THE OUTCOME", body: "METRIC TBD — Add only results supported by the real project record." }
    ]);
    return chrome(
      isNew ? "03 / NEW PROJECT" : "03 / EDIT PROJECT",
      `
      <form class="admin-form" id="project-editor-form" data-form="project" data-slug="${esc(item.slug || "")}" data-new="${isNew ? "1" : ""}">
        <div class="collapsible-details-panel open">
          <div class="collapsible-details-summary" role="button" tabindex="0">
            <span>01 / CASE STUDY METADATA & MEDIA SETTINGS</span>
            <span class="toggle-hint" style="font-size:10px;color:var(--accent-red,#e03c31);font-weight:700">▼ CLICK TO COLLAPSE METADATA</span>
          </div>
          <div class="collapsible-details-content">
            ${input("TITLE", "title", item.title || "", "", true)}
            ${sel("DOCUMENT TITLE SIZE", "titleSize", item.titleSize || "md", [
              { value: "sm", label: "SM — COMPACT (48px - 64px)" },
              { value: "md", label: "MD — BALANCED (72px - 88px)" },
              { value: "lg", label: "LG — EDITORIAL DISPLAY (96px - 112px)" },
              { value: "xl", label: "XL — MAXIMUM IMPACT / HERO (120px - 140px)" }
            ])}
            ${input("SLUG", "slug", item.slug || "", 'placeholder="auto-generated-from-title"')}
            ${input("NUMBER", "number", item.number || "")}
            ${input("DATE", "date", dateVal, 'type="date"', true)}
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
        </div>

        ${renderSectionListContainer(sections)}

        <div class="admin-actions" style="margin-top:24px">
          <button class="admin-btn" type="submit" data-publish="false">SAVE DRAFT <b>→</b></button>
          <button class="admin-btn" type="button" data-act="preview-project">PREVIEW <b>→</b></button>
          <button class="admin-btn primary" type="submit" data-publish="true">PUBLISH <b>→</b></button>
          ${!isNew ? `<button class="admin-btn admin-btn-danger" type="button" data-act="delete-project" data-slug="${esc(item.slug)}" data-title="${esc(item.title)}">DELETE CASE STUDY</button>` : ""}
        </div>
      </form>`
    );
  }

  function blogForm(item, isNew) {
    const today = new Date().toISOString().slice(0, 10);
    const dateVal = item.dateISO || (item.date && String(item.date).slice(0, 10)) || today;
    const sections = ensureSections(item, [
      { label: "01 / INTRODUCTION", heading: "THE CONTEXT", body: "" },
      { label: "02 / ANALYSIS", heading: "THE FINDINGS", body: "" },
      { label: "03 / CONCLUSION", heading: "THE TAKEAWAY", body: "" }
    ]);
    return chrome(
      isNew ? "04 / NEW ARTICLE" : "04 / EDIT ARTICLE",
      `
      <form class="admin-form" id="blog-editor-form" data-form="blog" data-slug="${esc(item.slug || "")}" data-new="${isNew ? "1" : ""}">
        <div class="collapsible-details-panel open">
          <div class="collapsible-details-summary" role="button" tabindex="0">
            <span>01 / ARTICLE METADATA & MEDIA SETTINGS</span>
            <span class="toggle-hint" style="font-size:10px;color:var(--accent-red,#e03c31);font-weight:700">▼ CLICK TO COLLAPSE METADATA</span>
          </div>
          <div class="collapsible-details-content">
            ${input("TITLE", "title", item.title || "", "", true)}
            ${sel("DOCUMENT TITLE SIZE", "titleSize", item.titleSize || "md", [
              { value: "sm", label: "SM — COMPACT (48px - 64px)" },
              { value: "md", label: "MD — BALANCED (72px - 88px)" },
              { value: "lg", label: "LG — EDITORIAL DISPLAY (96px - 112px)" },
              { value: "xl", label: "XL — MAXIMUM IMPACT / HERO (120px - 140px)" }
            ])}
            ${input("SLUG", "slug", item.slug || "", 'placeholder="auto-generated-from-title"')}
            ${input("DATE", "date", dateVal, 'type="date"', true)}
            ${input("CATEGORY", "category", item.category || "", "", true)}
            ${area("TAGS (ONE PER LINE)", "tags", (item.tags || []).join("\n"))}
            ${area("DESCRIPTION", "description", item.description || "", "", true)}
            ${area("HEADLINE (ONE LINE PER BREAK)", "headline", (item.headline || []).join("\n"))}
            ${sel("RELATED PROJECT", "relatedProject", item.relatedProject || "", [{ value: "", label: "NONE" }].concat((state.content.projects || []).map((p) => ({ value: p.slug, label: p.title }))))}
            ${input("COVER PATH", "cover", item.cover || "")}
            ${check("FEATURED", "featured", item.featured)}
            ${check("PUBLISHED", "published", item.published)}
          </div>
        </div>

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
    const dateVal = item.dateISO || (item.date && String(item.date).slice(0, 10)) || today;
    const sections = ensureSections(item, [
      { label: "01 / NOTE CONTENT", heading: "THE RESEARCH NOTE", body: item.body || "" }
    ]);
    return chrome(
      isNew ? "06 / NEW NOTE" : "06 / EDIT NOTE",
      `
      <form class="admin-form" id="note-editor-form" data-form="note" data-slug="${esc(item.slug || "")}" data-new="${isNew ? "1" : ""}">
        <div class="collapsible-details-panel open">
          <div class="collapsible-details-summary" role="button" tabindex="0">
            <span>01 / NOTE METADATA</span>
            <span class="toggle-hint" style="font-size:10px;color:var(--accent-red,#e03c31);font-weight:700">▼ CLICK TO COLLAPSE METADATA</span>
          </div>
          <div class="collapsible-details-content">
            ${input("TITLE", "title", item.title || "", "", true)}
            ${sel("DOCUMENT TITLE SIZE", "titleSize", item.titleSize || "md", [
              { value: "sm", label: "SM — COMPACT (48px - 64px)" },
              { value: "md", label: "MD — BALANCED (72px - 88px)" },
              { value: "lg", label: "LG — EDITORIAL DISPLAY (96px - 112px)" },
              { value: "xl", label: "XL — MAXIMUM IMPACT / HERO (120px - 140px)" }
            ])}
            ${input("SLUG", "slug", item.slug || "", 'placeholder="auto-generated-from-title"')}
            ${input("DATE", "date", dateVal, 'type="date"', true)}
            ${input("TAGS (COMMA SEPARATED)", "tags", (item.tags || []).join(", "))}
            ${check("PUBLISHED", "published", item.published !== false)}
          </div>
        </div>

        ${renderSectionListContainer(sections)}

        <div class="admin-actions" style="margin-top:24px">
          <button class="admin-btn" type="button" data-act="preview-note">PREVIEW <b>→</b></button>
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
    const dateVal = item.dateISO || (item.date && String(item.date).slice(0, 10)) || today;
    const defaultSections = [
      { label: "01 / WHAT I DID", heading: "THE WORK", body: item.did || "" },
      { label: "02 / WHAT I LEARNED", heading: "THE INSIGHT", body: item.learned || "" },
      { label: "03 / NEXT", heading: "THE FOLLOW-UP", body: item.next || "" }
    ];
    const sections = ensureSections(item, defaultSections);
    return chrome(
      isNew ? "05 / NEW NOTE" : "05 / EDIT NOTE",
      `
      <form class="admin-form" id="journal-editor-form" data-form="journal" data-id="${esc(item.id || "")}" data-new="${isNew ? "1" : ""}">
        <div class="collapsible-details-panel open">
          <div class="collapsible-details-summary" role="button" tabindex="0">
            <span>01 / JOURNAL METADATA & LINKS</span>
            <span class="toggle-hint" style="font-size:10px;color:var(--accent-red,#e03c31);font-weight:700">▼ CLICK TO COLLAPSE METADATA</span>
          </div>
          <div class="collapsible-details-content">
            ${input("DATE", "date", dateVal, 'type="date"', true)}
            ${input("TITLE", "title", item.title || "", "", true)}
            ${sel("DOCUMENT TITLE SIZE", "titleSize", item.titleSize || "md", [
              { value: "sm", label: "SM — COMPACT (48px - 64px)" },
              { value: "md", label: "MD — BALANCED (72px - 88px)" },
              { value: "lg", label: "LG — EDITORIAL DISPLAY (96px - 112px)" },
              { value: "xl", label: "XL — MAXIMUM IMPACT / HERO (120px - 140px)" }
            ])}
            ${area("HEADLINE (ONE LINE PER BREAK)", "headline", (item.headline || []).join("\n"))}
            ${sel("RELATED PROJECT", "project", item.project || "", [{ value: "", label: "NONE" }].concat((state.content.projects || []).map((p) => ({ value: p.slug, label: p.title }))))}
            ${input("SUMMARY", "summary", item.summary || "")}
            ${input("DATA", "data", item.data || "")}
            ${input("METHOD", "method", item.method || "")}
            ${input("RESULT", "result", item.result || "")}
            ${input("TOOLS", "tools", item.tools || "")}
            ${check("PUBLISHED", "published", item.published !== false)}
          </div>
        </div>

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
      <div class="wide portrait-studio-container about-principle-card" style="margin-top:20px;padding:20px">
        <h4 style="font:700 11px var(--mono);margin:0 0 14px;letter-spacing:0.14em;color:var(--accent-red,#e03c31)">PRINCIPLE 0${i + 1}</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px">
          ${input(`PRINCIPLE ${i + 1} TITLE`, `p-title-${i}`, item.title || "")}
          ${input("HOME LINE", `p-home-${i}`, item.home || "")}
          ${input("PAGE LINE", `p-page-${i}`, item.page || "")}
        </div>
      </div>
    `).join("");
    const portraitPath = about.portrait || "";
    return chrome(
      "02 / ABOUT",
      `<h1>ABOUT COPY<span class="red-stop">.</span></h1>
      <form class="admin-form" id="about-editor-form" data-form="about">
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
        <div class="wide portrait-studio-container">
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
              <div style="margin-bottom:14px">
                <label class="admin-kicker" style="margin-bottom:6px;display:block">PORTRAIT PATH / IMAGE URL</label>
                <input type="text" name="portrait" id="portrait-path-input" class="admin-input" value="${portraitPath}" placeholder="/assets/images/about/portrait.webp">
              </div>
              <div class="portrait-studio-actions">
                <input type="file" id="portrait-direct-upload-input" accept="image/*" style="display:none">
                <button type="button" class="admin-btn primary" id="portrait-direct-upload-btn">
                  📤 UPLOAD NEW FILE <b>→</b>
                </button>
                <button type="button" class="admin-btn secondary" id="pick-library-portrait-btn">
                  🖼️ CHOOSE FROM LIBRARY <b>→</b>
                </button>
                <button type="button" class="admin-btn" id="open-portrait-studio-btn">
                  🎨 CROP & FILTER STUDIO <b>→</b>
                </button>
                ${portraitPath ? `<button type="button" class="admin-btn danger" id="clear-portrait-btn">❌ REMOVE</button>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- RESUME DOCUMENT UPLOADER -->
        <div class="wide portrait-studio-container" style="margin-top:24px">
          <div class="portrait-studio-header">
            <h3>RESUME DOCUMENT (PDF)</h3>
            <span class="studio-badge">PUBLIC DOWNLOAD ASSET</span>
          </div>
          <div style="padding:16px 0 0;font-family:var(--sans)">
            <p style="font-size:13px;line-height:1.5;color:#555;margin:0 0 16px">Upload your updated resume PDF file here. It will automatically replace <code>/assets/Abantika_Resume.pdf</code> and update all Download Resume buttons on the live site.</p>
            <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
              <input type="file" id="resume-pdf-input" accept="application/pdf" class="admin-input" style="max-width:360px;padding:8px;border:1px solid var(--line)" />
              <button type="button" class="admin-btn primary" id="upload-resume-btn">📄 UPLOAD NEW RESUME PDF <b>↗</b></button>
            </div>
            <div id="resume-upload-msg" style="margin-top:12px;font:11px var(--mono)"></div>
          </div>
        </div>

        ${principles}
        <div class="admin-actions" style="margin-top:28px"><button class="admin-btn primary" type="submit">SAVE ABOUT <b>→</b></button></div>
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
      <form class="admin-form" id="settings-editor-form" data-form="settings">
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
      <form class="admin-form" id="skills-editor-form" data-form="skills">
        ${area("DATA ANALYSIS", "dataAnalysis", skills.dataAnalysis || "")}
        ${area("STATISTICS", "statistics", skills.statistics || "")}
        ${area("MACHINE LEARNING", "machineLearning", skills.machineLearning || "")}
        ${area("VISUALIZATION", "visualization", skills.visualization || "")}
        ${area("OTHER", "other", skills.other || "")}
        <div class="admin-actions"><button class="admin-btn primary" type="submit">SAVE SKILLS <b>→</b></button></div>
      </form>`
    );
  }

  async function uploadMediaFile(file, folder = "about") {
    if (!file) throw new Error("Choose a file first.");
    if (file.size > 25 * 1024 * 1024) throw new Error("File exceeds 25MB limit.");

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
      let dataUrl, filename;
      if (file.type && file.type.includes("svg")) {
        const text = await file.text();
        const base64 = btoa(unescape(encodeURIComponent(text)));
        dataUrl = `data:image/svg+xml;base64,${base64}`;
        filename = baseName;
      } else if (file.type && (file.type.includes("pdf") || file.type.includes("mp4"))) {
        const reader = new FileReader();
        dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        filename = baseName;
      } else {
        const converted = await convertToWebp(file);
        dataUrl = converted.dataUrl;
        filename = converted.filename;
      }

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
    try {
      state.mediaPreviewCache[uploadedPath] = URL.createObjectURL(file);
    } catch(e) {}
    return { path: uploadedPath, name: baseName, folder };
  }

  async function showMediaSelectModal(onSelect) {
    window.showMediaSelectModal = showMediaSelectModal;
    document.querySelector(".admin-modal-root")?.remove();
    let mediaFiles = [];
    try {
      const res = await api("/api/media");
      mediaFiles = Array.isArray(res) ? res : (Array.isArray(state.content?.media) ? state.content.media : []);
    } catch(e) {
      mediaFiles = Array.isArray(state.content?.media) ? state.content.media : [];
    }

    const fallbackSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='140' viewBox='0 0 200 140'%3E%3Crect width='100%25' height='100%25' fill='%23edebe6'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' font-size='10' font-family='monospace' fill='%23888'%3E%5B MEDIA ASSET %5D%3C/text%3E%3C/svg%3E";

    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal media-select-modal" role="dialog" aria-modal="true" style="width:min(940px, 96vw);max-height:92vh;display:flex;flex-direction:column;padding:26px 24px 20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <p class="admin-kicker" style="margin:0 0 2px">07 / MEDIA ASSETS</p>
            <h2 style="margin:0;font-size:clamp(22px, 3.5vw, 28px);letter-spacing:-0.05em">SELECT OR UPLOAD MEDIA<span class="red-stop">.</span></h2>
          </div>
          <button type="button" class="admin-btn" data-dismiss="true" style="padding:4px 10px;font-size:11px" title="Close modal">✕ ESC</button>
        </div>

        <!-- UPLOAD STRIP MATCHING MEDIA PAGE -->
        <div class="media-picker-upload-box" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:12px;border:1px solid var(--line);background:var(--bg-elevated, #faf9f5);margin-bottom:12px">
          <div style="flex:0 0 130px">
            <label style="font:10px var(--mono);display:block;margin-bottom:4px;font-weight:700">FOLDER</label>
            <select id="picker-folder" style="width:100%;padding:6px;font:11px var(--mono);border:1px solid var(--line);background:var(--bg, #fff)">
              <option value="projects">projects</option>
              <option value="blog">blog</option>
              <option value="journal">journal</option>
              <option value="about">about</option>
            </select>
          </div>
          <div style="flex:1;min-width:200px">
            <label style="font:10px var(--mono);display:block;margin-bottom:4px;font-weight:700">CHOOSE FILE TO UPLOAD</label>
            <input type="file" id="picker-file" accept="image/*,.svg,application/pdf,video/mp4,.pdf,.mp4" style="width:100%;font:11px var(--mono)">
          </div>
          <div>
            <button type="button" class="admin-btn primary" id="picker-upload-btn" style="white-space:nowrap;padding:7px 14px">UPLOAD FILE <b>↑</b></button>
          </div>
        </div>

        <!-- FOLDER FILTER TABS & SEARCH -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <div class="media-picker-tabs" style="display:flex;gap:4px">
            <button type="button" class="wysiwyg-tab active" data-picker-filter="all">ALL (<span id="picker-total-count">${mediaFiles.length}</span>)</button>
            <button type="button" class="wysiwyg-tab" data-picker-filter="projects">PROJECTS</button>
            <button type="button" class="wysiwyg-tab" data-picker-filter="blog">BLOG</button>
            <button type="button" class="wysiwyg-tab" data-picker-filter="journal">JOURNAL</button>
            <button type="button" class="wysiwyg-tab" data-picker-filter="about">ABOUT</button>
          </div>
          <div style="flex:1;max-width:260px">
            <input type="text" id="picker-search" placeholder="Search filename or path..." style="width:100%;padding:5px 8px;font:11px var(--mono);border:1px solid var(--line);background:transparent">
          </div>
        </div>

        <!-- MEDIA GRID - FILE VERSION FROM MEDIA VIEW -->
        <div class="media-picker-files-grid" id="media-picker-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:12px;overflow-y:auto;flex:1;min-height:180px;max-height:380px;padding:8px 4px;border:1px solid var(--line);background:var(--bg, transparent)">
        </div>

        <!-- SELECTION DETAILS & ALT TEXT -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;align-items:end">
          <div>
            <label style="font:10px var(--mono);display:block;margin-bottom:3px;font-weight:700">SELECTED ASSET PATH</label>
            <input type="text" id="picker-selected-path" placeholder="/assets/images/..." style="width:100%;padding:6px 8px;font:11px var(--mono);border:1px solid var(--line)">
          </div>
          <div>
            <label style="font:10px var(--mono);display:block;margin-bottom:3px;font-weight:700">IMAGE ALT TEXT / CAPTION</label>
            <input type="text" id="picker-selected-alt" placeholder="Descriptive caption / alt text" style="width:100%;padding:6px 8px;font:11px var(--sans);border:1px solid var(--line)">
          </div>
        </div>

        <div class="admin-actions" style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--line)">
          <button type="button" class="admin-btn" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn primary" id="picker-select-btn" style="padding:8px 18px;font-weight:700">USE THIS MEDIA <b>→</b></button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    let activeFilter = "all";
    let selectedPath = "";
    let selectedName = "";

    const grid = root.querySelector("#media-picker-grid");
    const searchInput = root.querySelector("#picker-search");
    const pathInput = root.querySelector("#picker-selected-path");
    const altInput = root.querySelector("#picker-selected-alt");
    const uploadBtn = root.querySelector("#picker-upload-btn");

    function renderFilesGrid() {
      const query = (searchInput.value || "").toLowerCase().trim();
      const filtered = mediaFiles.filter((f) => {
        const fPath = (f.path || "").toLowerCase();
        const fFolder = (f.folder || "").toLowerCase();
        const fName = (f.name || "").toLowerCase();

        if (activeFilter !== "all") {
          if (fFolder !== activeFilter && !fPath.includes("/" + activeFilter + "/")) return false;
        }
        if (query) {
          if (!fName.includes(query) && !fPath.includes(query)) return false;
        }
        return true;
      });

      if (!filtered.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;padding:40px 16px;text-align:center;font:12px var(--mono);color:var(--text-muted,#888)">NO MEDIA ASSETS FOUND IN THIS VIEW</div>`;
        return;
      }

      grid.innerHTML = filtered.map((file) => {
        const isSelected = selectedPath === file.path;
        const refs = file.references || [];
        const refCount = refs.length;
        const ext = String(file.name || "").split(".").pop().toLowerCase();
        const previewSrc = (state.mediaPreviewCache && state.mediaPreviewCache[file.path]) || file.path;

        let previewHtml = `<img src="${esc(previewSrc)}" alt="${esc(file.name)}" style="width:100%;height:110px;object-fit:cover;background:#edebe6;display:block" onerror="this.onerror=null;this.src='${fallbackSvg}'">`;
        if (ext === "pdf") {
          previewHtml = `<div style="height:110px;background:#171717;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font:10px var(--mono)"><span style="font-size:26px;margin-bottom:3px">📄</span><b>PDF DOCUMENT</b></div>`;
        } else if (ext === "mp4") {
          previewHtml = `<video src="${esc(previewSrc)}" style="width:100%;height:110px;object-fit:cover;background:#000" muted></video>`;
        }

        return `
          <article class="admin-file picker-file-card ${isSelected ? "is-selected" : ""}" data-path="${esc(file.path)}" data-name="${esc(file.name)}" style="position:relative;cursor:pointer;border:1px solid ${isSelected ? "var(--red, #ef321f)" : "var(--line)"};padding:8px;background:var(--card-bg, #fff);display:flex;flex-direction:column;justify-content:space-between;transition:border-color 0.15s, transform 0.1s">
            <div style="position:relative;overflow:hidden">
              ${previewHtml}
              ${isSelected ? `<span style="position:absolute;top:6px;right:6px;background:var(--red,#ef321f);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.3)">✓</span>` : ""}
            </div>
            <p style="margin:8px 0 2px;font-weight:700;font-size:12px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(file.name)}">${esc(file.name)}</p>
            <p style="font-size:10px;color:var(--text-muted,#777);word-break:break-all;margin:0 0 6px;font-family:var(--mono);line-height:1.2">${esc(file.path)}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;padding-top:4px;border-top:1px dashed var(--line)">
              <span class="admin-badge ${refCount > 0 ? "published" : "draft"}" style="padding:1px 5px">${refCount > 0 ? "USED (" + refCount + ")" : "UNUSED"}</span>
              <span style="font-family:var(--mono);text-transform:uppercase;color:var(--text-muted,#888)">${esc(file.folder || ext)}</span>
            </div>
          </article>
        `;
      }).join("");
    }

    renderFilesGrid();

    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".picker-file-card");
      if (!card) return;
      selectedPath = card.getAttribute("data-path");
      selectedName = card.getAttribute("data-name") || "";
      pathInput.value = selectedPath;
      if (!altInput.value) {
        altInput.value = selectedName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      }
      renderFilesGrid();
    });

    grid.addEventListener("dblclick", (e) => {
      const card = e.target.closest(".picker-file-card");
      if (!card) return;
      selectedPath = card.getAttribute("data-path");
      selectedName = card.getAttribute("data-name") || "";
      const altVal = altInput.value.trim() || selectedName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      root.remove();
      onSelect(selectedPath, altVal);
    });

    root.querySelectorAll("[data-picker-filter]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        root.querySelectorAll("[data-picker-filter]").forEach((b) => b.classList.remove("active"));
        tabBtn.classList.add("active");
        activeFilter = tabBtn.getAttribute("data-picker-filter");
        renderFilesGrid();
      });
    });

    searchInput.addEventListener("input", () => {
      renderFilesGrid();
    });

    uploadBtn?.addEventListener("click", async () => {
      const fileInput = root.querySelector("#picker-file");
      const file = fileInput?.files?.[0];
      if (!file) {
        alert("Please select a file to upload first.");
        return;
      }
      const folder = root.querySelector("#picker-folder")?.value || "projects";
      uploadBtn.disabled = true;
      const prevHtml = uploadBtn.innerHTML;
      uploadBtn.innerHTML = `UPLOADING... ⏳`;
      try {
        const uploaded = await uploadMediaFile(file, folder);
        const newMedia = {
          path: uploaded.path,
          name: uploaded.name || file.name,
          folder: folder,
          references: []
        };
        mediaFiles.unshift(newMedia);
        if (state.content && Array.isArray(state.content.media)) {
          state.content.media.unshift(newMedia);
        }
        selectedPath = uploaded.path;
        selectedName = newMedia.name;
        pathInput.value = selectedPath;
        altInput.value = selectedName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        fileInput.value = "";
        const countEl = root.querySelector("#picker-total-count");
        if (countEl) countEl.textContent = mediaFiles.length;
        renderFilesGrid();
      } catch (err) {
        alert("Upload failed: " + err.message);
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = prevHtml;
      }
    });

    root.querySelector("#picker-select-btn")?.addEventListener("click", () => {
      const pathVal = pathInput.value.trim() || selectedPath;
      const altVal = altInput.value.trim() || selectedName;
      if (pathVal) {
        root.remove();
        onSelect(pathVal, altVal);
      } else {
        alert("Please select or upload a media file first.");
      }
    });

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-dismiss]")) root.remove();
    });

    const onKey = (e) => {
      if (e.key === "Escape") {
        root.remove();
        window.removeEventListener("keydown", onKey);
      }
    };
    window.addEventListener("keydown", onKey);
  }
  window.showMediaSelectModal = showMediaSelectModal;

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

  function showMathPickerModal(targetOrCallback, initialCode = "") {
    window.showMathPickerModal = showMathPickerModal;
    document.querySelector(".admin-modal-root")?.remove();

    const presets = [
      { label: "Inline E = mc²", code: "$ E = mc^2 $", isBlock: false },
      { label: "Standard Deviation", code: "$ \\sigma = \\sqrt{\\frac{1}{N} \\sum_{i=1}^N (x_i - \\mu)^2} $", isBlock: false },
      { label: "Quadratic Formula", code: "$$ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} $$", isBlock: true },
      { label: "Summation Series", code: "$$ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} $$", isBlock: true },
      { label: "Definite Integral", code: "$$ \\int_{a}^{b} f(x) \\, dx $$", isBlock: true },
      { label: "2x2 Matrix", code: "$$ \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} $$", isBlock: true },
      { label: "Limit", code: "$$ \\lim_{x \\to \\infty} \\frac{1}{x} = 0 $$", isBlock: true },
      { label: "Euler's Identity", code: "$$ e^{i\\pi} + 1 = 0 $$", isBlock: true }
    ];

    let startCode = initialCode;
    if (!startCode) {
      if (typeof targetOrCallback === "object" && targetOrCallback instanceof HTMLTextAreaElement) {
        const sel = targetOrCallback.value.substring(targetOrCallback.selectionStart, targetOrCallback.selectionEnd).trim();
        if (sel) startCode = sel.startsWith("$") ? sel : `$ ${sel} $`;
      }
    }
    if (!startCode) startCode = presets[0].code;

    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal math-picker-modal" role="dialog" aria-modal="true" style="width:min(640px, 95vw);padding:26px 24px 20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <p class="admin-kicker" style="margin:0 0 2px">08 / MATHEMATICAL NOTATION</p>
            <h2 style="margin:0;font-size:clamp(22px, 3.5vw, 28px);letter-spacing:-0.05em">LATEX FORMULA<span class="red-stop">.</span></h2>
          </div>
          <button type="button" class="admin-btn" data-dismiss="true" style="padding:4px 10px;font-size:11px" title="Close modal">✕ ESC</button>
        </div>

        <div style="margin-bottom:12px">
          <label style="display:block;font:11px var(--mono);margin-bottom:6px;font-weight:700">PRESETS & EXAMPLES</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
            ${presets.map((p, idx) => `
              <button type="button" class="wysiwyg-tab math-preset-btn" data-preset-idx="${idx}" style="font-size:11px;padding:4px 8px">${esc(p.label)}</button>
            `).join("")}
          </div>
        </div>

        <label style="display:block;margin-bottom:12px;font:11px var(--mono);font-weight:700">WRITE FORMULA (LATEX)
          <textarea id="math-modal-input" rows="3" style="width:100%;font-family:var(--mono);font-size:13px;padding:10px;margin-top:4px;border:1px solid var(--line);resize:vertical;background:var(--bg-elevated, #faf9f5)">${esc(startCode)}</textarea>
          <span style="font-size:10px;color:var(--text-muted, #777);display:block;margin-top:4px">Tip: Use <code>$ ... $</code> for inline math or <code>$$ ... $$</code> for display block. Press Ctrl+Enter to insert.</span>
        </label>

        <div style="margin-bottom:16px">
          <label style="display:block;font:11px var(--mono);margin-bottom:4px;font-weight:700">LIVE MATHEMATICAL PREVIEW</label>
          <div id="math-modal-preview" style="min-height:60px;padding:14px;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;font-size:16px;overflow-x:auto"></div>
        </div>

        <div class="image-picker-actions" style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:10px;border-top:1px solid var(--line)">
          <button type="button" class="admin-btn secondary" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn primary" id="math-modal-insert-btn" style="padding:8px 18px;font-weight:700">INSERT FORMULA <b>→</b></button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const input = root.querySelector("#math-modal-input");
    const preview = root.querySelector("#math-modal-preview");
    const insertBtn = root.querySelector("#math-modal-insert-btn");

    function updatePreview() {
      const val = input.value.trim();
      if (!val) {
        preview.innerHTML = '<span style="color:#888;font-size:12px">Type formula above to see live preview...</span>';
        return;
      }
      preview.textContent = val.startsWith("$") ? val : `$ ${val} $`;
      try {
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
        } else if (window.katex) {
          const isDisplay = val.startsWith("$$");
          const clean = val.replace(/^\$\$?/, "").replace(/\$\$?$/, "").trim();
          window.katex.render(clean, preview, { displayMode: isDisplay, throwOnError: false });
        }
      } catch (err) {
        preview.textContent = val;
      }
    }

    input.addEventListener("input", updatePreview);
    setTimeout(() => {
      input.focus();
      input.select();
      updatePreview();
    }, 50);

    const doCommit = () => {
      const mathCode = input.value.trim();
      if (!mathCode) return;

      if (typeof targetOrCallback === "function") {
        targetOrCallback(mathCode);
      } else if (targetOrCallback instanceof HTMLTextAreaElement) {
        insertIntoTextarea(targetOrCallback, mathCode);
      } else if (targetOrCallback && targetOrCallback.querySelector) {
        const wrapper = targetOrCallback;
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
    };

    insertBtn.addEventListener("click", doCommit);

    input.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        doCommit();
      } else if (e.key === "Escape") {
        root.remove();
      }
    });

    root.addEventListener("click", (e) => {
      const presetBtn = e.target.closest(".math-preset-btn");
      if (presetBtn) {
        const idx = parseInt(presetBtn.getAttribute("data-preset-idx"), 10);
        if (presets[idx]) {
          input.value = presets[idx].code;
          updatePreview();
          input.focus();
        }
        return;
      }

      if (e.target.getAttribute("data-dismiss") === "true") {
        root.remove();
        return;
      }
    });

    const onEsc = (e) => {
      if (e.key === "Escape") {
        root.remove();
        window.removeEventListener("keydown", onEsc);
      }
    };
    window.addEventListener("keydown", onEsc);
  }
  window.showMathPickerModal = showMathPickerModal;

  function showTablePickerModal(target) {
    document.querySelector(".admin-modal-root")?.remove();

    let headers = ["Header 1", "Header 2", "Header 3"];
    let rows = [
      ["Cell 1", "Cell 2", "Cell 3"],
      ["Cell 4", "Cell 5", "Cell 6"]
    ];
    let aligns = ["left", "left", "left"];

    const presets = [
      {
        label: "📊 3x3 Standard Table",
        headers: ["Feature / Item", "Description", "Status"],
        rows: [
          ["Data Pipeline", "Automated ETL flow", "Active"],
          ["Model Accuracy", "94.2% ROC-AUC", "Verified"]
        ],
        aligns: ["left", "left", "center"]
      },
      {
        label: "📈 Comparison Matrix",
        headers: ["Criteria", "Option A (Legacy)", "Option B (Proposed)"],
        rows: [
          ["Latency", "250ms", "45ms"],
          ["Cost / mo", "$1,200", "$450"],
          ["Scalability", "Manual", "Auto-scaled"]
        ],
        aligns: ["left", "center", "center"]
      },
      {
        label: "📝 Key-Value Spec Sheet",
        headers: ["Specification", "Details"],
        rows: [
          ["Framework", "Eleventy v2.0"],
          ["Hosting", "Vercel Edge Network"],
          ["Deployment", "GitHub Actions CI/CD"]
        ],
        aligns: ["left", "left"]
      }
    ];

    const root = document.createElement("div");
    root.className = "admin-modal-root";
    root.innerHTML = `
      <div class="admin-modal-backdrop" data-dismiss="true"></div>
      <div class="admin-modal table-picker-modal" role="dialog" aria-modal="true" style="width:min(760px, 96vw);max-height:90vh;display:flex;flex-direction:column;background:var(--paper,#fbf9f5)">
        <div style="flex:0 0 auto;padding-bottom:10px;border-bottom:1px solid var(--line)">
          <p class="admin-kicker">TABLE FORMATTER & GENERATOR</p>
          <h2 style="margin-bottom:8px">GENERATE & FORMAT TABLE<span class="red-stop">.</span></h2>
          <p style="font-size:12px;color:#555;margin-bottom:10px">
            Build table grids, choose column alignments, load presets, or paste CSV/TSV text. Formats automatically for Edit, Source, and Preview modes.
          </p>
          <div class="wysiwyg-tabs">
            <button type="button" class="wysiwyg-tab active" id="table-tab-builder">GRID BUILDER</button>
            <button type="button" class="wysiwyg-tab" id="table-tab-presets">PRESETS</button>
            <button type="button" class="wysiwyg-tab" id="table-tab-csv">PASTE CSV / TSV</button>
          </div>
        </div>

        <div style="flex:1 1 auto;overflow-y:auto;padding:12px 0">
          <!-- GRID BUILDER VIEW -->
          <div id="table-view-builder">
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;background:#f2efe6;padding:10px;border:1px solid var(--line)">
              <label style="font:11px var(--mono);font-weight:700">ROWS: 
                <input type="number" id="table-rows-count" min="1" max="20" value="${rows.length}" style="width:50px;padding:3px;margin-left:4px;border:1px solid var(--line);background:#fff">
              </label>
              <label style="font:11px var(--mono);font-weight:700">COLS: 
                <input type="number" id="table-cols-count" min="1" max="10" value="${headers.length}" style="width:50px;padding:3px;margin-left:4px;border:1px solid var(--line);background:#fff">
              </label>
              <button type="button" class="admin-btn secondary" id="table-add-row-btn" style="padding:4px 8px;font-size:10px">+ ADD ROW</button>
              <button type="button" class="admin-btn secondary" id="table-add-col-btn" style="padding:4px 8px;font-size:10px">+ ADD COL</button>
              <button type="button" class="admin-btn secondary danger" id="table-clear-btn" style="padding:4px 8px;font-size:10px">RESET</button>
            </div>

            <div style="overflow-x:auto;margin-bottom:12px">
              <label style="display:block;font:11px var(--mono);margin-bottom:6px;font-weight:700">INTERACTIVE TABLE CELL EDITOR</label>
              <div id="table-grid-container"></div>
            </div>
          </div>

          <!-- PRESETS VIEW -->
          <div id="table-view-presets" style="display:none">
            <label style="display:block;font:11px var(--mono);margin-bottom:8px;font-weight:700">SELECT PRESET TEMPLATE</label>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${presets.map((p, idx) => `
                <button type="button" class="admin-btn secondary table-preset-card" data-preset-idx="${idx}" style="text-align:left;justify-content:flex-start;padding:12px;height:auto">
                  <div>
                    <strong style="font-size:13px;display:block;margin-bottom:4px">${esc(p.label)}</strong>
                    <span style="font-size:11px;font-family:var(--mono);color:#666">${p.headers.join(" | ")}</span>
                  </div>
                </button>
              `).join("")}
            </div>
          </div>

          <!-- CSV / TSV VIEW -->
          <div id="table-view-csv" style="display:none">
            <label style="display:block;font:11px var(--mono);margin-bottom:6px;font-weight:700">PASTE CSV OR TSV (TAB-SEPARATED) DATA</label>
            <textarea id="table-csv-input" style="width:100%;height:130px;font-family:var(--mono);font-size:12px;padding:8px;border:1px solid var(--line);background:#ffffff" placeholder="Header 1, Header 2, Header 3&#10;Value 1, Value 2, Value 3&#10;Value 4, Value 5, Value 6"></textarea>
            <button type="button" class="admin-btn secondary" id="table-convert-csv-btn" style="margin-top:6px;font-size:11px">CONVERT CSV TO GRID BUILDER</button>
          </div>

          <!-- LIVE RENDERED PREVIEW -->
          <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:10px">
            <label style="display:block;font:11px var(--mono);margin-bottom:6px;font-weight:700">LIVE RENDERED TABLE PREVIEW</label>
            <div id="table-modal-rendered-preview" style="padding:12px;background:#ffffff;border:1px dashed var(--line);min-height:70px;overflow-x:auto"></div>
          </div>

          <details style="margin-top:8px">
            <summary style="font:11px var(--mono);cursor:pointer;color:#666">VIEW FORMATTED MARKDOWN CODE</summary>
            <pre id="table-modal-md-code" style="margin-top:6px;padding:8px;background:#111;color:#00ff66;font-family:var(--mono);font-size:11px;overflow-x:auto;white-space:pre"></pre>
          </details>
        </div>

        <div class="image-picker-actions" style="flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--line)">
          <button type="button" class="admin-btn secondary" data-dismiss="true">CANCEL</button>
          <button type="button" class="admin-btn" id="table-modal-insert-btn" style="font-weight:700">INSERT TABLE INTO EDITOR <b>→</b></button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const rowsInput = root.querySelector("#table-rows-count");
    const colsInput = root.querySelector("#table-cols-count");
    const gridContainer = root.querySelector("#table-grid-container");
    const mdCodeEl = root.querySelector("#table-modal-md-code");
    const renderedPreviewEl = root.querySelector("#table-modal-rendered-preview");
    const insertBtn = root.querySelector("#table-modal-insert-btn");

    function generateMarkdown() {
      let md = "| " + headers.map(h => (h || "").trim() || "Header").join(" | ") + " |\n";
      md += "| " + aligns.map(a => {
        if (a === "center") return ":---:";
        if (a === "right") return "---:";
        return ":---";
      }).join(" | ") + " |\n";

      rows.forEach(r => {
        md += "| " + headers.map((_, cIdx) => (r[cIdx] || "").trim()).join(" | ") + " |\n";
      });
      return md;
    }

    function updatePreviews() {
      const mdStr = generateMarkdown();
      if (mdCodeEl) mdCodeEl.textContent = mdStr;
      if (renderedPreviewEl) renderedPreviewEl.innerHTML = markdownToHtml(mdStr);
    }

    function renderGrid() {
      let html = '<table style="width:100%;border-collapse:collapse;border:1px solid var(--line);background:#fff"><thead><tr style="background:#eae7df">';
      headers.forEach((h, cIdx) => {
        html += `
          <th style="padding:6px;border:1px solid var(--line);min-width:110px">
            <div style="display:flex;flex-direction:column;gap:4px">
              <input type="text" class="table-hdr-input" data-col="${cIdx}" value="${esc(h)}" placeholder="Header ${cIdx + 1}" style="width:100%;font-weight:700;font-size:11px;padding:4px;border:1px solid var(--line)">
              <select class="table-align-sel" data-col="${cIdx}" style="font-size:10px;padding:2px">
                <option value="left" ${aligns[cIdx] === "left" ? "selected" : ""}>Left</option>
                <option value="center" ${aligns[cIdx] === "center" ? "selected" : ""}>Center</option>
                <option value="right" ${aligns[cIdx] === "right" ? "selected" : ""}>Right</option>
              </select>
            </div>
          </th>`;
      });
      html += '</tr></thead><tbody>';

      rows.forEach((r, rIdx) => {
        html += '<tr>';
        headers.forEach((_, cIdx) => {
          const val = r[cIdx] || "";
          html += `
            <td style="padding:4px;border:1px solid var(--line)">
              <input type="text" class="table-cell-input" data-row="${rIdx}" data-col="${cIdx}" value="${esc(val)}" placeholder="Data" style="width:100%;font-size:12px;padding:4px;border:1px solid #ddd">
            </td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';

      gridContainer.innerHTML = html;
      updatePreviews();
    }

    renderGrid();

    // Event Listeners inside Modal
    root.addEventListener("input", (e) => {
      if (e.target.classList.contains("table-hdr-input")) {
        const col = parseInt(e.target.getAttribute("data-col"), 10);
        headers[col] = e.target.value;
        updatePreviews();
      } else if (e.target.classList.contains("table-cell-input")) {
        const r = parseInt(e.target.getAttribute("data-row"), 10);
        const c = parseInt(e.target.getAttribute("data-col"), 10);
        if (rows[r]) rows[r][c] = e.target.value;
        updatePreviews();
      }
    });

    root.addEventListener("change", (e) => {
      if (e.target.classList.contains("table-align-sel")) {
        const col = parseInt(e.target.getAttribute("data-col"), 10);
        aligns[col] = e.target.value;
        updatePreviews();
      } else if (e.target.id === "table-rows-count") {
        const newCount = Math.max(1, parseInt(e.target.value, 10) || 1);
        while (rows.length < newCount) {
          rows.push(new Array(headers.length).fill(""));
        }
        while (rows.length > newCount) {
          rows.pop();
        }
        renderGrid();
      } else if (e.target.id === "table-cols-count") {
        const newCount = Math.max(1, parseInt(e.target.value, 10) || 1);
        while (headers.length < newCount) {
          headers.push(`Header ${headers.length + 1}`);
          aligns.push("left");
          rows.forEach(r => r.push(""));
        }
        while (headers.length > newCount) {
          headers.pop();
          aligns.pop();
          rows.forEach(r => r.pop());
        }
        renderGrid();
      }
    });

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-dismiss]")) {
        root.remove();
        return;
      }

      // Tab switching
      if (e.target.id === "table-tab-builder") {
        root.querySelectorAll(".wysiwyg-tab").forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");
        root.querySelector("#table-view-builder").style.display = "block";
        root.querySelector("#table-view-presets").style.display = "none";
        root.querySelector("#table-view-csv").style.display = "none";
      } else if (e.target.id === "table-tab-presets") {
        root.querySelectorAll(".wysiwyg-tab").forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");
        root.querySelector("#table-view-builder").style.display = "none";
        root.querySelector("#table-view-presets").style.display = "block";
        root.querySelector("#table-view-csv").style.display = "none";
      } else if (e.target.id === "table-tab-csv") {
        root.querySelectorAll(".wysiwyg-tab").forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");
        root.querySelector("#table-view-builder").style.display = "none";
        root.querySelector("#table-view-presets").style.display = "none";
        root.querySelector("#table-view-csv").style.display = "block";
      }

      // Preset selection
      const presetCard = e.target.closest(".table-preset-card");
      if (presetCard) {
        const pIdx = parseInt(presetCard.getAttribute("data-preset-idx"), 10);
        const p = presets[pIdx];
        if (p) {
          headers = [...p.headers];
          rows = p.rows.map(r => [...r]);
          aligns = [...(p.aligns || p.headers.map(() => "left"))];
          rowsInput.value = rows.length;
          colsInput.value = headers.length;
          root.querySelector("#table-tab-builder").click();
          renderGrid();
        }
      }

      // Buttons
      if (e.target.id === "table-add-row-btn") {
        rows.push(new Array(headers.length).fill(""));
        rowsInput.value = rows.length;
        renderGrid();
      } else if (e.target.id === "table-add-col-btn") {
        headers.push(`Header ${headers.length + 1}`);
        aligns.push("left");
        rows.forEach(r => r.push(""));
        colsInput.value = headers.length;
        renderGrid();
      } else if (e.target.id === "table-clear-btn") {
        headers = ["Header 1", "Header 2"];
        rows = [["", ""], ["", ""]];
        aligns = ["left", "left"];
        rowsInput.value = 2;
        colsInput.value = 2;
        renderGrid();
      } else if (e.target.id === "table-convert-csv-btn") {
        const csvRaw = root.querySelector("#table-csv-input").value.trim();
        if (csvRaw) {
          const lines = csvRaw.split("\n").map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            const sep = lines[0].includes("\t") ? "\t" : ",";
            headers = lines[0].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
            aligns = headers.map(() => "left");
            rows = [];
            for (let i = 1; i < lines.length; i++) {
              rows.push(lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
            }
            rowsInput.value = rows.length;
            colsInput.value = headers.length;
            root.querySelector("#table-tab-builder").click();
            renderGrid();
          }
        }
      }
    });

    // Insert Handler
    insertBtn.onclick = () => {
      const mdStr = generateMarkdown();
      const htmlStr = markdownToHtml(mdStr);

      if (target instanceof HTMLTextAreaElement) {
        insertIntoTextarea(target, "\n\n" + mdStr + "\n\n");
      } else if (target && target.querySelector) {
        const wrapper = target;
        const editable = wrapper.querySelector(".wysiwyg-editable");
        const source = wrapper.querySelector(".wysiwyg-source");
        const previewPane = wrapper.querySelector(".wysiwyg-preview-pane");
        const activeTab = wrapper.querySelector(".wysiwyg-tab.active");
        const mode = activeTab ? activeTab.getAttribute("data-wysiwyg-mode") : "edit";

        if (mode === "source") {
          insertIntoTextarea(source, "\n\n" + mdStr + "\n\n");
          if (editable) editable.innerHTML = markdownToHtml(source.value);
        } else if (mode === "edit") {
          editable.focus();
          try {
            document.execCommand("insertHTML", false, htmlStr);
          } catch(e) {
            editable.innerHTML += htmlStr;
          }
          if (source) source.value = htmlToMarkdown(editable).trim();
        } else if (mode === "preview") {
          if (source) {
            source.value = (source.value.trim() + "\n\n" + mdStr + "\n\n").trim();
          }
          if (editable) {
            editable.innerHTML = markdownToHtml(source.value);
          }
          if (previewPane) {
            previewPane.innerHTML = `<div class="case-body content-body" style="font-family:var(--sans);line-height:1.6;padding:16px;background:#ffffff;border:1px solid var(--line);min-height:160px">${markdownToHtml(source.value)}</div>`;
          }
        }
        syncWysiwyg(wrapper);
      }
      root.remove();
    };
  }

  function openChartStudioWorkspace(target) {
    document.querySelector(".chart-studio-panel")?.remove();
    document.querySelector(".admin-modal-root")?.remove();

    let existingEl = null;
    if (target && target.classList && target.classList.contains("bauhaus-chart")) {
      existingEl = target;
    } else if (target && target.querySelector) {
      existingEl = target.querySelector(".bauhaus-chart");
    }

    let chartType = existingEl?.getAttribute("data-chart-type") || "bar";
    let chartTitle = existingEl?.getAttribute("data-chart-title") || "FEATURE IMPORTANCE (CHURN MODEL)";
    let chartWidth = existingEl?.getAttribute("data-chart-width") || "100%";
    let chartHeight = existingEl?.getAttribute("data-chart-height") || "380px";

    let rawData = existingEl?.getAttribute("data-chart-data");
    let items = [
      { label: "Customer Tenure", val: 0.38, x: 20, size: 14 },
      { label: "Contract Type", val: 0.26, x: 50, size: 24 },
      { label: "Monthly Charges", val: 0.20, x: 80, size: 18 },
      { label: "Tech Support", val: 0.16, x: 100, size: 12 }
    ];
    let matrix = { tp: 412, fp: 18, fn: 24, tn: 546 };

    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed)) items = parsed;
        else if (parsed && typeof parsed === "object") {
          if (parsed.tp !== undefined) matrix = parsed;
          else items = [parsed];
        }
      } catch(e) {}
    }

    let customSvgUrl = "";
    let uploadedFileText = "";
    let uploadedFileType = "";
    let uploadedBlobUrl = "";

    if (existingEl) {
      const existingSvg = existingEl.querySelector("svg");
      if (existingSvg) {
        uploadedFileText = existingSvg.outerHTML;
        uploadedFileType = "svg";
        chartType = "svg";
      }
      const existingImg = existingEl.querySelector("img");
      if (existingImg) {
        customSvgUrl = existingImg.getAttribute("src") || "";
        chartType = "svg";
      }
      const existingIframe = existingEl.querySelector("iframe");
      if (existingIframe) {
        customSvgUrl = existingIframe.getAttribute("src") || "";
        uploadedFileType = "html";
        chartType = "svg";
      }
    }

    let customColors = {
      primary: "#111111",
      accent: "#E03C31",
      bg: "#FBF9F5",
      text: "#111111"
    };

    const root = document.createElement("div");
    root.className = "chart-studio-panel";
    root.innerHTML = `
      <div class="chart-studio-backdrop" data-dismiss="true"></div>
      <div class="chart-studio-body">
        <div class="chart-studio-header">
          <div class="chart-studio-brand">
            <span class="r2-badge" style="background:var(--red,#e03c31);color:#fff;font-weight:900">09 / STUDIO</span>
            <h2>DATA VISUALIZATION STUDIO & EDITOR<span class="red-stop">.</span></h2>
          </div>
          <div class="chart-studio-actions">
            <button type="button" class="admin-btn secondary" data-dismiss="true">CANCEL ✕</button>
            <button type="button" class="admin-btn primary" id="chart-studio-insert-btn" style="font-weight:700">INSERT / UPDATE CHART <b>→</b></button>
          </div>
        </div>

        <div class="chart-studio-grid">
          <div class="chart-studio-sidebar">
            <div class="chart-type-tabs">
              <button type="button" class="chart-tab ${chartType === 'bar' ? 'active' : ''}" data-type="bar">📊 BAR</button>
              <button type="button" class="chart-tab ${chartType === 'line' ? 'active' : ''}" data-type="line">📈 LINE</button>
              <button type="button" class="chart-tab ${chartType === 'confusion-matrix' ? 'active' : ''}" data-type="confusion-matrix">🎯 MATRIX</button>
              <button type="button" class="chart-tab ${chartType === 'scatter' ? 'active' : ''}" data-type="scatter">⚪ SCATTER</button>
              <button type="button" class="chart-tab ${chartType === 'svg' ? 'active' : ''}" data-type="svg">🖼️ SVG / PLOTLY</button>
              <button type="button" class="chart-tab" data-type="csv">📋 CSV PASTE</button>
            </div>

            <div class="chart-studio-section">
              <label class="chart-field-label">CHART TITLE:
                <input type="text" id="chart-studio-title" value="${esc(chartTitle)}" placeholder="Enter chart title..." class="chart-input">
              </label>

              <div class="chart-size-controls" style="margin-top:10px">
                <span class="chart-field-label" style="display:block;margin-bottom:4px">CHART DIMENSIONS & ASPECT RATIO:</span>
                <div class="chart-size-presets" style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
                  <button type="button" class="admin-btn secondary chart-size-preset-btn" data-w="100%" data-h="380px">STANDARD (600x380)</button>
                  <button type="button" class="admin-btn secondary chart-size-preset-btn" data-w="100%" data-h="320px">WIDE (850x320)</button>
                  <button type="button" class="admin-btn secondary chart-size-preset-btn" data-w="500px" data-h="500px">SQUARE (500x500)</button>
                  <button type="button" class="admin-btn secondary chart-size-preset-btn" data-w="100%" data-h="450px">FULL (100%)</button>
                </div>
                <div style="display:flex;gap:8px">
                  <label class="chart-field-label" style="flex:1">WIDTH:
                    <input type="text" id="chart-studio-width" value="${esc(chartWidth)}" placeholder="e.g. 100% or 600px" class="chart-input">
                  </label>
                  <label class="chart-field-label" style="flex:1">HEIGHT:
                    <input type="text" id="chart-studio-height" value="${esc(chartHeight)}" placeholder="e.g. 380px" class="chart-input">
                  </label>
                </div>
              </div>
            </div>

            <div id="chart-controls-container" class="chart-studio-section">
              <div id="chart-view-items" style="${['bar','line','scatter'].includes(chartType) ? 'display:block' : 'display:none'}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <span class="chart-field-label">DATA POINTS (LABEL, VAL, X, SIZE):</span>
                  <button type="button" class="admin-btn secondary" id="chart-add-item-btn" style="padding:2px 6px;font-size:10px">+ ADD POINT</button>
                </div>
                <div id="chart-items-list" class="chart-items-scroll-list"></div>
              </div>

              <div id="chart-view-matrix" style="${chartType === 'confusion-matrix' ? 'display:block' : 'display:none'}">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                  <label class="chart-field-label">TRUE POSITIVES (TP):
                    <input type="number" id="chart-matrix-tp" value="${matrix.tp}" class="chart-input">
                  </label>
                  <label class="chart-field-label">FALSE POSITIVES (FP):
                    <input type="number" id="chart-matrix-fp" value="${matrix.fp}" class="chart-input">
                  </label>
                  <label class="chart-field-label">FALSE NEGATIVES (FN):
                    <input type="number" id="chart-matrix-fn" value="${matrix.fn}" class="chart-input">
                  </label>
                  <label class="chart-field-label">TRUE NEGATIVES (TN):
                    <input type="number" id="chart-matrix-tn" value="${matrix.tn}" class="chart-input">
                  </label>
                </div>
              </div>

              <div id="chart-view-svg" style="${chartType === 'svg' ? 'display:block' : 'display:none'}">
                <div class="chart-upload-dropzone">
                  <span style="font-size:24px;display:block;margin-bottom:4px">📁 / 🖼️</span>
                  <p style="font:700 11px var(--mono);margin:0 0 8px">UPLOAD PYTHON SVG OR PLOTLY HTML FILE</p>
                  <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
                    <button type="button" class="admin-btn primary" onclick="document.getElementById('chart-file-upload-input').click()">SELECT FROM COMPUTER <b>→</b></button>
                    <button type="button" class="admin-btn secondary" id="chart-open-media-drawer-btn">🖼️ MEDIA LIBRARY <b>→</b></button>
                  </div>
                  <input type="file" id="chart-file-upload-input" accept=".svg,.html,.htm" style="display:none">
                  <span id="chart-upload-file-name" style="display:block;font:10px var(--mono);color:var(--red);margin-top:6px"></span>
                </div>

                <div id="chart-media-library-drawer" style="display:none;margin-top:8px;border:1px solid var(--line);padding:8px;background:#f7f5ef">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="font:700 10px var(--mono)">MEDIA ASSETS (CLICK TO SELECT):</span>
                    <button type="button" class="admin-btn secondary danger" id="chart-close-media-drawer-btn" style="padding:2px 6px;font-size:9px">CLOSE ✕</button>
                  </div>
                  <div id="chart-media-grid-container" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));gap:6px;max-height:160px;overflow-y:auto"></div>
                </div>

                <label class="chart-field-label" style="margin-top:8px;display:block">DIRECT FILE PATH / URL:
                  <input type="text" id="chart-svg-url" placeholder="/assets/images/projects/sample_chart.svg" class="chart-input">
                </label>

                <div id="chart-svg-inspector" style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px">
                  <span class="chart-field-label" style="display:block;margin-bottom:4px">🎨 SVG ELEMENT COLORS (CLICK TO RECOLOR):</span>
                  <div id="chart-svg-color-groups" style="display:flex;flex-wrap:wrap;gap:6px">
                    <span style="font:10px var(--mono);color:#888">Upload or select an SVG file to inspect elements.</span>
                  </div>
                </div>
              </div>

              <div id="chart-view-csv" style="display:none">
                <label class="chart-field-label">PASTE CSV / TSV DATA (LABEL, VAL, X, SIZE):
                  <textarea id="chart-csv-textarea" rows="6" placeholder="Label, Value, X, Size&#10;Customer Tenure, 0.38, 20, 14&#10;Contract Type, 0.26, 50, 24&#10;Monthly Charges, 0.20, 80, 18" class="chart-input" style="font-family:var(--mono);line-height:1.4"></textarea>
                </label>
                <button type="button" class="admin-btn primary" id="chart-parse-csv-btn" style="width:100%;margin-top:6px">PARSE & IMPORT DATASET <b>→</b></button>
              </div>
            </div>

            <div class="chart-studio-section" style="border-top:1px solid var(--line);padding-top:10px;margin-top:auto">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span class="chart-field-label">🎨 BAUHAUS PALETTE & PRESETS:</span>
                <select id="chart-preset-select" class="chart-input" style="width:auto;padding:2px 6px;font-size:10px">
                  <option value="classic">BAUHAUS CLASSIC</option>
                  <option value="swiss">SWISS NEUTRAL</option>
                  <option value="warm">WARM EDITORIAL</option>
                  <option value="obsidian">OBSIDIAN NIGHT</option>
                </select>
              </div>

              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#f4f2ea;padding:8px;border:1px solid var(--line);margin-bottom:8px">
                <label style="font:10px var(--mono);display:flex;align-items:center;gap:4px">PRIMARY:
                  <input type="color" id="chart-picker-primary" value="#111111" style="border:none;width:22px;height:22px;cursor:pointer">
                </label>
                <label style="font:10px var(--mono);display:flex;align-items:center;gap:4px">ACCENT:
                  <input type="color" id="chart-picker-accent" value="#E03C31" style="border:none;width:22px;height:22px;cursor:pointer">
                </label>
                <label style="font:10px var(--mono);display:flex;align-items:center;gap:4px">BG:
                  <input type="color" id="chart-picker-bg" value="#FBF9F5" style="border:none;width:22px;height:22px;cursor:pointer">
                </label>
                <label style="font:10px var(--mono);display:flex;align-items:center;gap:4px">TEXT:
                  <input type="color" id="chart-picker-text" value="#111111" style="border:none;width:22px;height:22px;cursor:pointer">
                </label>
              </div>

              <div style="display:flex;gap:3px;flex-wrap:wrap" id="chart-swatch-bar">
                ${(window.BAUHAUS_SWISS_PALETTE || []).map(p => `
                  <button type="button" class="swatch-opt-btn" data-swatch="${p.hex}" style="background:${p.hex};width:16px;height:16px;padding:0;border:1px solid #111;cursor:pointer" title="${p.name} (${p.hex})"></button>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="chart-studio-canvas-panel">
            <div class="chart-canvas-header">
              <span style="font:700 11px var(--mono);color:#5e5b55">LIVE RENDERED CHART VIEWPORT & PREVIEW</span>
              <span id="chart-status-badge" style="font:700 10px var(--mono);color:var(--red)">READY</span>
            </div>
            <div class="chart-canvas-viewport">
              <div id="chart-studio-preview-box" class="bauhaus-chart" style="width:${esc(chartWidth)};height:${esc(chartHeight)};min-height:360px;background:#FBF9F5;border:1px solid var(--line)"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const previewBox = root.querySelector("#chart-studio-preview-box");
    const itemsList = root.querySelector("#chart-items-list");
    const titleInput = root.querySelector("#chart-studio-title");
    const widthInput = root.querySelector("#chart-studio-width");
    const heightInput = root.querySelector("#chart-studio-height");
    const insertBtn = root.querySelector("#chart-studio-insert-btn");
    const fileInput = root.querySelector("#chart-file-upload-input");
    const uploadNameSpan = root.querySelector("#chart-upload-file-name");
    const svgColorGroupsContainer = root.querySelector("#chart-svg-color-groups");

    const openMediaDrawerBtn = root.querySelector("#chart-open-media-drawer-btn");
    const closeMediaDrawerBtn = root.querySelector("#chart-close-media-drawer-btn");
    const mediaDrawer = root.querySelector("#chart-media-library-drawer");
    const mediaGridContainer = root.querySelector("#chart-media-grid-container");

    const primaryColorInput = root.querySelector("#chart-picker-primary");
    const accentColorInput = root.querySelector("#chart-picker-accent");
    const bgColorInput = root.querySelector("#chart-picker-bg");
    const textColorInput = root.querySelector("#chart-picker-text");
    const presetSelect = root.querySelector("#chart-preset-select");

    function renderItemsList() {
      itemsList.innerHTML = items.map((item, idx) => `
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <input type="text" class="chart-item-label chart-input" data-idx="${idx}" value="${esc(item.label)}" placeholder="Label" style="flex:2">
          <input type="number" step="any" class="chart-item-val chart-input" data-idx="${idx}" value="${item.val}" placeholder="Val" style="flex:1">
          <input type="number" step="any" class="chart-item-x chart-input" data-idx="${idx}" value="${item.x !== undefined ? item.x : (idx+1)*20}" placeholder="X" style="flex:1">
          <input type="number" step="any" class="chart-item-size chart-input" data-idx="${idx}" value="${item.size !== undefined ? item.size : 12}" placeholder="Size" style="flex:1">
          <button type="button" class="admin-btn secondary danger chart-del-item-btn" data-idx="${idx}" style="padding:2px 6px;font-size:10px">✕</button>
        </div>
      `).join("");
    }

    function applyLiveColorsToPreview() {
      customColors.primary = primaryColorInput.value;
      customColors.accent = accentColorInput.value;
      customColors.bg = bgColorInput.value;
      customColors.text = textColorInput.value;

      const svgEl = previewBox.querySelector("svg");
      if (svgEl && window.recolorSvgElement) {
        window.recolorSvgElement(svgEl, customColors);
      }

      const iframeEl = previewBox.querySelector("iframe");
      if (iframeEl && window.adaptPlotlyIframe) {
        window.adaptPlotlyIframe(iframeEl, customColors);
      }
    }

    function updateSvgColorInspector(svgEl) {
      if (!svgEl || !window.inspectSvgElements) {
        svgColorGroupsContainer.innerHTML = `<span style="font:10px var(--mono);color:#888">No SVG element inspector available.</span>`;
        return;
      }
      const detected = window.inspectSvgElements(svgEl);
      if (!detected.length) {
        svgColorGroupsContainer.innerHTML = `<span style="font:10px var(--mono);color:#888">No element color groups detected in SVG.</span>`;
        return;
      }
      svgColorGroupsContainer.innerHTML = detected.map((group) => `
        <button type="button" class="chart-svg-group-btn" data-color="${group.color}" style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;background:#fff;border:1px solid var(--line);font:10px var(--mono);cursor:pointer" title="Click to recolor this element group (${group.count} elements)">
          <span style="width:12px;height:12px;background:${group.color};border:1px solid #111;display:inline-block"></span>
          <span>${group.color} (${group.count})</span>
        </button>
      `).join("");

      svgColorGroupsContainer.querySelectorAll(".chart-svg-group-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const oldColor = btn.getAttribute("data-color");
          const picker = window.showColorPickerModal || function(cb) {
            const hex = prompt("Enter new color hex code (e.g. #E03C31 or #2457A6):", oldColor);
            if (hex) cb(hex);
          };
          picker((newHex) => {
            if (window.recolorSvgGroup) {
              window.recolorSvgGroup(svgEl, oldColor, newHex);
              uploadedFileText = svgEl.outerHTML;
              updateSvgColorInspector(svgEl);
              applyLiveColorsToPreview();
            }
          });
        });
      });
    }

    function updatePreview() {
      chartTitle = titleInput.value.trim();
      chartWidth = widthInput.value.trim() || "100%";
      chartHeight = heightInput.value.trim() || "380px";

      previewBox.style.width = chartWidth;
      previewBox.style.height = chartHeight;

      previewBox.removeAttribute("data-chart-rendered");
      previewBox.setAttribute("data-chart-type", chartType);
      previewBox.setAttribute("data-chart-title", chartTitle);
      previewBox.setAttribute("data-chart-width", chartWidth);
      previewBox.setAttribute("data-chart-height", chartHeight);

      if (['bar', 'line', 'scatter'].includes(chartType)) {
        previewBox.setAttribute("data-chart-data", JSON.stringify(items));
        if (window.initBauhausCharts) window.initBauhausCharts();
      } else if (chartType === "confusion-matrix") {
        previewBox.setAttribute("data-chart-data", JSON.stringify(matrix));
        if (window.initBauhausCharts) window.initBauhausCharts();
      } else if (chartType === "svg") {
        if (uploadedFileType === "html" && uploadedBlobUrl) {
          previewBox.innerHTML = `
            <div class="bauhaus-chart-header">
              <span class="chart-title-label">${esc(chartTitle || "PLOTLY INTERACTIVE CHART")}</span>
            </div>
            <iframe src="${esc(uploadedBlobUrl)}" style="width:100%;height:${esc(chartHeight)};border:none" onload="if (window.adaptPlotlyIframe) window.adaptPlotlyIframe(this, ${JSON.stringify(customColors)})"></iframe>
          `;
        } else if (uploadedFileType === "svg" && uploadedFileText) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(uploadedFileText, "image/svg+xml");
          const svgEl = doc.querySelector("svg");
          if (svgEl) {
            svgEl.setAttribute("width", "100%");
            svgEl.setAttribute("height", "100%");
            if (window.adaptSvgElement) window.adaptSvgElement(svgEl);
            if (window.recolorSvgElement) window.recolorSvgElement(svgEl, customColors);
            previewBox.innerHTML = `
              <div class="bauhaus-chart-header">
                <span class="chart-title-label">${esc(chartTitle || "PYTHON SVG GRAPH")}</span>
              </div>
              <div class="chart-svg-wrapper">${svgEl.outerHTML}</div>
            `;
            const renderedSvg = previewBox.querySelector("svg");
            if (renderedSvg) updateSvgColorInspector(renderedSvg);
          }
        } else if (customSvgUrl) {
          const isPlotlyHtml = customSvgUrl.endsWith(".html") || customSvgUrl.endsWith(".htm");
          if (isPlotlyHtml) {
            previewBox.innerHTML = `
              <div class="bauhaus-chart-header">
                <span class="chart-title-label">${esc(chartTitle || "PLOTLY INTERACTIVE CHART")}</span>
              </div>
              <iframe src="${esc(customSvgUrl)}" style="width:100%;height:${esc(chartHeight)};border:none"></iframe>
            `;
          } else {
            if (!uploadedFileText || uploadedFileType !== "svg") {
              fetch(customSvgUrl).then(r => r.ok ? r.text() : "").then(txt => {
                if (txt && txt.includes("<svg")) {
                  uploadedFileText = txt;
                  uploadedFileType = "svg";
                  updatePreview();
                }
              }).catch(() => {});
            }
            previewBox.innerHTML = `<img src="${esc(customSvgUrl)}" alt="${esc(chartTitle)}" />`;
            if (window.initBauhausCharts) window.initBauhausCharts();
          }
        } else {
          previewBox.innerHTML = `<p style="padding:20px;font:11px var(--mono);color:#666">Upload an SVG/HTML file or select from media library above to preview.</p>`;
        }
      }

      applyLiveColorsToPreview();
    }

    renderItemsList();
    updatePreview();

    root.querySelectorAll(".chart-size-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        widthInput.value = btn.getAttribute("data-w");
        heightInput.value = btn.getAttribute("data-h");
        updatePreview();
      });
    });

    [widthInput, heightInput, titleInput].forEach((inp) => {
      inp.addEventListener("input", updatePreview);
    });

    presetSelect?.addEventListener("change", (e) => {
      const presetKey = e.target.value;
      const presets = {
        classic: { primary: "#111111", accent: "#E03C31", bg: "#FBF9F5", text: "#111111" },
        swiss: { primary: "#4A4945", accent: "#23827F", bg: "#F4F2EA", text: "#111111" },
        warm: { primary: "#2F7D5A", accent: "#E87524", bg: "#FBF9F5", text: "#111111" },
        obsidian: { primary: "#111111", accent: "#E03C31", bg: "#171717", text: "#FBF9F5" }
      };
      const p = presets[presetKey] || presets.classic;
      primaryColorInput.value = p.primary;
      accentColorInput.value = p.accent;
      bgColorInput.value = p.bg;
      textColorInput.value = p.text;
      applyLiveColorsToPreview();
    });

    [primaryColorInput, accentColorInput, bgColorInput, textColorInput].forEach(inp => {
      inp.addEventListener("input", applyLiveColorsToPreview);
    });

    root.querySelectorAll(".swatch-opt-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        accentColorInput.value = btn.getAttribute("data-swatch");
        applyLiveColorsToPreview();
      });
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const ext = file.name.split(".").pop().toLowerCase();
      uploadNameSpan.textContent = `LOADING FILE: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`;

      const reader = new FileReader();
      reader.onload = async (e) => {
        uploadedFileText = e.target.result;
        if (ext === "html" || ext === "htm") {
          uploadedFileType = "html";
          const blob = new Blob([uploadedFileText], { type: "text/html" });
          if (uploadedBlobUrl) URL.revokeObjectURL(uploadedBlobUrl);
          uploadedBlobUrl = URL.createObjectURL(blob);
        } else {
          uploadedFileType = "svg";
        }
        uploadNameSpan.textContent = `✓ LOADED & RECOLORED: ${file.name}`;
        updatePreview();
      };
      reader.readAsText(file);
    });

    openMediaDrawerBtn?.addEventListener("click", async () => {
      mediaDrawer.style.display = "block";
      mediaGridContainer.innerHTML = `<p style="font:10px var(--mono);color:#666">Loading assets...</p>`;
      try {
        const res = await api("/api/media");
        const mediaFiles = Array.isArray(res) ? res : (Array.isArray(state.content?.media) ? state.content.media : []);
        if (!mediaFiles.length) {
          mediaGridContainer.innerHTML = `<p style="font:10px var(--mono);color:#666">No media assets found.</p>`;
          return;
        }
        mediaGridContainer.innerHTML = mediaFiles.map((f) => {
          const ext = String(f.name || "").split(".").pop().toLowerCase();
          let iconOrImg = `<img src="${esc(f.path)}" alt="${esc(f.name)}" style="width:100%;height:46px;object-fit:cover">`;
          if (ext === "html" || ext === "htm") {
            iconOrImg = `<div style="height:46px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font:9px var(--mono)">📊 PLOTLY</div>`;
          } else if (ext === "svg") {
            iconOrImg = `<div style="height:46px;background:#eae7df;display:flex;align-items:center;justify-content:center;font:9px var(--mono)">🎨 SVG</div>`;
          }
          return `
            <div class="chart-media-picker-item" data-path="${esc(f.path)}" data-ext="${ext}" style="border:1px solid var(--line);padding:3px;cursor:pointer;background:#ffffff">
              ${iconOrImg}
              <span style="font:8px var(--mono);display:block;margin-top:2px;word-break:break-all;line-height:1.1">${esc(f.name)}</span>
            </div>
          `;
        }).join("");

        mediaGridContainer.querySelectorAll(".chart-media-picker-item").forEach((item) => {
          item.addEventListener("click", async () => {
            const path = item.getAttribute("data-path");
            const ext = item.getAttribute("data-ext");
            customSvgUrl = path;
            const urlInput = root.querySelector("#chart-svg-url");
            if (urlInput) urlInput.value = path;
            uploadNameSpan.textContent = `✓ SELECTED: ${path}`;

            try {
              const r = await fetch(path);
              if (r.ok) {
                const txt = await r.text();
                uploadedFileText = txt;
                uploadedFileType = (ext === "html" || ext === "htm") ? "html" : "svg";
                if (uploadedFileType === "html") {
                  const blob = new Blob([txt], { type: "text/html" });
                  if (uploadedBlobUrl) URL.revokeObjectURL(uploadedBlobUrl);
                  uploadedBlobUrl = URL.createObjectURL(blob);
                }
              }
            } catch(e) {}

            updatePreview();
          });
        });
      } catch(e) {
        mediaGridContainer.innerHTML = `<p style="font:10px var(--mono);color:var(--red)">Failed to load media: ${esc(e.message)}</p>`;
      }
    });

    closeMediaDrawerBtn?.addEventListener("click", () => {
      mediaDrawer.style.display = "none";
    });

    root.querySelector("#chart-parse-csv-btn")?.addEventListener("click", () => {
      const csvText = root.querySelector("#chart-csv-textarea")?.value || "";
      if (!csvText.trim()) return;
      const lines = csvText.trim().split("\n");
      const parsedItems = [];
      lines.forEach((line, idx) => {
        const parts = line.split(/[,;\t]+/).map(p => p.trim());
        if (parts.length >= 2) {
          const label = parts[0];
          const val = parseFloat(parts[1]);
          const x = parts[2] !== undefined ? parseFloat(parts[2]) : (idx + 1) * 20;
          const size = parts[3] !== undefined ? parseFloat(parts[3]) : 14;
          if (!isNaN(val)) {
            parsedItems.push({ label, val, x: isNaN(x) ? 20 : x, size: isNaN(size) ? 14 : size });
          }
        }
      });
      if (parsedItems.length) {
        items = parsedItems;
        chartType = "bar";
        root.querySelectorAll(".chart-tab").forEach(t => t.classList.remove("active"));
        root.querySelector(".chart-tab[data-type='bar']")?.classList.add("active");
        root.querySelector("#chart-view-items").style.display = "block";
        root.querySelector("#chart-view-csv").style.display = "none";
        renderItemsList();
        updatePreview();
      }
    });

    root.addEventListener("input", (e) => {
      if (e.target.classList.contains("chart-item-label")) {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        items[idx].label = e.target.value;
        updatePreview();
      } else if (e.target.classList.contains("chart-item-val")) {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        items[idx].val = parseFloat(e.target.value) || 0;
        updatePreview();
      } else if (e.target.classList.contains("chart-item-x")) {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        items[idx].x = parseFloat(e.target.value) || 0;
        updatePreview();
      } else if (e.target.classList.contains("chart-item-size")) {
        const idx = parseInt(e.target.getAttribute("data-idx"), 10);
        items[idx].size = parseFloat(e.target.value) || 10;
        updatePreview();
      } else if (e.target.id === "chart-matrix-tp") {
        matrix.tp = parseInt(e.target.value, 10) || 0;
        updatePreview();
      } else if (e.target.id === "chart-matrix-fp") {
        matrix.fp = parseInt(e.target.value, 10) || 0;
        updatePreview();
      } else if (e.target.id === "chart-matrix-fn") {
        matrix.fn = parseInt(e.target.value, 10) || 0;
        updatePreview();
      } else if (e.target.id === "chart-matrix-tn") {
        matrix.tn = parseInt(e.target.value, 10) || 0;
        updatePreview();
      } else if (e.target.id === "chart-svg-url") {
        customSvgUrl = e.target.value.trim();
        updatePreview();
      }
    });

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-dismiss]")) {
        if (uploadedBlobUrl) URL.revokeObjectURL(uploadedBlobUrl);
        root.remove();
        return;
      }

      const tab = e.target.closest(".chart-tab");
      if (tab) {
        chartType = tab.getAttribute("data-type");
        root.querySelectorAll(".chart-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        root.querySelector("#chart-view-items").style.display = ['bar','line','scatter'].includes(chartType) ? "block" : "none";
        root.querySelector("#chart-view-matrix").style.display = chartType === "confusion-matrix" ? "block" : "none";
        root.querySelector("#chart-view-svg").style.display = chartType === "svg" ? "block" : "none";
        root.querySelector("#chart-view-csv").style.display = chartType === "csv" ? "block" : "none";

        updatePreview();
      }

      if (e.target.id === "chart-add-item-btn") {
        items.push({ label: `Point ${items.length + 1}`, val: 15, x: (items.length + 1) * 20, size: 12 });
        renderItemsList();
        updatePreview();
      }

      const delBtn = e.target.closest(".chart-del-item-btn");
      if (delBtn) {
        const idx = parseInt(delBtn.getAttribute("data-idx"), 10);
        items.splice(idx, 1);
        renderItemsList();
        updatePreview();
      }
    });

    insertBtn.onclick = () => {
      const title = titleInput.value.trim();
      const w = widthInput.value.trim() || "100%";
      const h = heightInput.value.trim() || "380px";

      let insertTag = "";
      if (['bar', 'line', 'scatter'].includes(chartType)) {
        insertTag = `\n\n<div class="bauhaus-chart" data-chart-type="${chartType}" data-chart-title="${esc(title)}" data-chart-width="${esc(w)}" data-chart-height="${esc(h)}" data-chart-data='${JSON.stringify(items)}'></div>\n\n`;
      } else if (chartType === "confusion-matrix") {
        insertTag = `\n\n<div class="bauhaus-chart" data-chart-type="confusion-matrix" data-chart-title="${esc(title)}" data-chart-width="${esc(w)}" data-chart-height="${esc(h)}" data-chart-data='${JSON.stringify(matrix)}'></div>\n\n`;
      } else if (chartType === "svg") {
        if (customSvgUrl) {
          const isPlotly = customSvgUrl.endsWith(".html") || customSvgUrl.endsWith(".htm") || uploadedFileType === "html";
          if (isPlotly) {
            insertTag = `\n\n<div class="bauhaus-chart" data-chart-title="${esc(title)}" data-chart-type="plotly" data-chart-width="${esc(w)}" data-chart-height="${esc(h)}"><iframe src="${esc(customSvgUrl)}" style="width:100%;height:${esc(h)};border:none"></iframe></div>\n\n`;
          } else {
            insertTag = `\n\n<div class="bauhaus-chart" data-chart-title="${esc(title)}" data-chart-width="${esc(w)}" data-chart-height="${esc(h)}"><img src="${esc(customSvgUrl)}" alt="${esc(title)}" /></div>\n\n`;
          }
        } else if (uploadedFileType === "svg" && uploadedFileText) {
          insertTag = `\n\n<div class="bauhaus-chart" data-chart-title="${esc(title)}" data-chart-width="${esc(w)}" data-chart-height="${esc(h)}">\n${uploadedFileText}\n</div>\n\n`;
        }
      }

      if (target instanceof HTMLTextAreaElement) {
        insertIntoTextarea(target, insertTag);
      } else if (target && target.querySelector) {
        const wrapper = target;
        const editable = wrapper.querySelector(".wysiwyg-editable");
        const source = wrapper.querySelector(".wysiwyg-source");
        const previewPane = wrapper.querySelector(".wysiwyg-preview-pane");
        const activeTab = wrapper.querySelector(".wysiwyg-tab.active");
        const mode = activeTab ? activeTab.getAttribute("data-wysiwyg-mode") : "edit";

        if (existingEl) {
          existingEl.outerHTML = insertTag.trim();
        } else if (mode === "source") {
          insertIntoTextarea(source, insertTag);
          if (editable) editable.innerHTML = markdownToHtml(source.value);
        } else if (mode === "preview") {
          insertIntoTextarea(source, insertTag);
          if (editable) editable.innerHTML = markdownToHtml(source.value);
          if (previewPane) previewPane.innerHTML = markdownToHtml(source.value);
        } else {
          editable.focus();
          document.execCommand("insertHTML", false, insertTag);
          syncWysiwyg(wrapper);
        }
      }

      if (uploadedBlobUrl) URL.revokeObjectURL(uploadedBlobUrl);
      root.remove();
      if (window.initBauhausCharts) window.initBauhausCharts();
    };
  }

  function showChartPickerModal(target) {
    openChartStudioWorkspace(target);
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
        if (portraitStudioState.lastObjectUrl) {
          URL.revokeObjectURL(portraitStudioState.lastObjectUrl);
        }
        const url = URL.createObjectURL(file);
        portraitStudioState.lastObjectUrl = url;
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

    if (window._psMouseMoveHandler) {
      window.removeEventListener("mousemove", window._psMouseMoveHandler);
    }
    if (window._psMouseUpHandler) {
      window.removeEventListener("mouseup", window._psMouseUpHandler);
    }

    window._psMouseMoveHandler = (e) => {
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
    };

    window._psMouseUpHandler = () => {
      if (portraitStudioState.isDragging) {
        portraitStudioState.isDragging = false;
        if (canvas) canvas.style.cursor = "grab";
      }
    };

    window.addEventListener("mousemove", window._psMouseMoveHandler);
    window.addEventListener("mouseup", window._psMouseUpHandler);

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

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 2 : 1) + " " + units[i];
  }

  function renderR2StorageCard(files) {
    const R2_FREE_CAPACITY_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB Free Storage Limit
    let totalBytes = 0;
    let r2FileCount = 0;
    let largestFile = null;

    files.forEach((file) => {
      const size = Number(file.size) || 0;
      totalBytes += size;
      if (file.r2) r2FileCount++;
      if (!largestFile || size > (largestFile.size || 0)) {
        largestFile = file;
      }
    });

    const usedFormatted = formatBytes(totalBytes);
    const maxFormatted = formatBytes(R2_FREE_CAPACITY_BYTES);
    const freeBytes = Math.max(0, R2_FREE_CAPACITY_BYTES - totalBytes);
    const freeFormatted = formatBytes(freeBytes);
    const percentNum = (totalBytes / R2_FREE_CAPACITY_BYTES) * 100;
    const percentFormatted = percentNum < 0.01 && totalBytes > 0 ? "<0.01" : percentNum.toFixed(2);
    const cappedPercent = Math.min(Math.max(percentNum, totalBytes > 0 ? 0.5 : 0), 100);

    let statusText = `NORMAL (${percentFormatted}% USED)`;
    let statusClass = "status-normal";
    let barColorClass = "bar-normal";
    let alertBannerHtml = "";

    if (percentNum >= 90) {
      statusText = "🚨 CRITICAL HIGH USAGE";
      statusClass = "status-critical";
      barColorClass = "bar-critical";
      alertBannerHtml = `
        <div class="r2-alert-banner critical">
          <span style="font-size:16px">🚨</span>
          <div>
            <b>CRITICAL HIGH STORAGE WARNING (${percentFormatted}% USED):</b> 
            Your Cloudflare R2 bucket is approaching its 10 GB free tier limit. Delete unused media or upgrade R2 capacity.
          </div>
        </div>
      `;
    } else if (percentNum >= 75) {
      statusText = "⚠️ HIGH USAGE CAUTION";
      statusClass = "status-caution";
      barColorClass = "bar-caution";
      alertBannerHtml = `
        <div class="r2-alert-banner caution">
          <span style="font-size:16px">⚠️</span>
          <div>
            <b>HIGH USAGE CAUTION (${percentFormatted}% USED):</b> 
            Cloudflare R2 storage usage has crossed 75% of the 10 GB capacity.
          </div>
        </div>
      `;
    }

    const largestFileName = largestFile ? largestFile.name : "None";
    const largestFileFormatted = largestFile ? formatBytes(largestFile.size || 0) : "0 B";

    return `
      <div class="r2-storage-card">
        <div class="r2-storage-header">
          <div class="r2-storage-title">
            <span class="r2-badge">CLOUDFLARE R2 BUCKET</span>
            <h3 style="margin-top:4px">STORAGE CAPACITY & MONITOR<span class="red-stop">.</span></h3>
          </div>
          <div class="r2-storage-actions">
            <button type="button" class="admin-btn secondary" data-act="sync-r2-metrics">🔄 SYNC R2 METRICS</button>
          </div>
        </div>

        <div class="r2-storage-metrics-grid">
          <div class="r2-metric-box">
            <span class="r2-metric-label">SPACE USED</span>
            <strong class="r2-metric-value ${statusClass}">${usedFormatted}</strong>
            <small class="r2-metric-sub">OF ${maxFormatted} FREE TIER</small>
          </div>
          <div class="r2-metric-box">
            <span class="r2-metric-label">USAGE PERCENTAGE</span>
            <strong class="r2-metric-value ${statusClass}">${percentFormatted}%</strong>
            <small class="r2-metric-sub">${statusText}</small>
          </div>
          <div class="r2-metric-box">
            <span class="r2-metric-label">TOTAL ASSETS</span>
            <strong class="r2-metric-value">${files.length}</strong>
            <small class="r2-metric-sub">${r2FileCount} IN R2 STORAGE</small>
          </div>
          <div class="r2-metric-box">
            <span class="r2-metric-label">LARGEST FILE</span>
            <strong class="r2-metric-value">${largestFileFormatted}</strong>
            <small class="r2-metric-sub" style="word-break:break-all">${esc(largestFileName)}</small>
          </div>
        </div>

        <!-- LINEAR SCALE INDICATOR -->
        <div class="r2-view-linear" style="border-top:1px solid var(--line);padding-top:12px;margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <span style="font:700 10px var(--mono);color:#5e5b55">0.0 GB</span>
            <strong style="font-size:28px;font-weight:900;letter-spacing:-0.06em;color:${statusClass === 'status-critical' ? '#E03C31' : '#111111'}">${percentFormatted}% USED</strong>
            <span style="font:700 10px var(--mono);color:#5e5b55">${freeFormatted} FREE</span>
          </div>
          <div class="r2-progress-bar-wrap">
            <div class="r2-progress-bar-fill ${barColorClass}" style="width:${cappedPercent}%"></div>
          </div>
          <div class="r2-progress-labels" style="margin-top:6px">
            <span>0 GB</span>
            <span>2.5 GB</span>
            <span>5.0 GB</span>
            <span>7.5 GB</span>
            <span>10.0 GB MAX</span>
          </div>
        </div>

        ${alertBannerHtml}
      </div>
    `;
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
      ${renderR2StorageCard(files)}
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

  function trashView(items) {
    const list = Array.isArray(items) ? items : [];
    const count = list.length;
    return chrome(
      "09 / RECYCLE BIN",
      `
      <div class="admin-toolbar" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;margin-bottom:24px">
        <div>
          <h1>RECYCLE BIN<span class="red-stop">.</span></h1>
          <p style="font:11px var(--mono);color:#666;margin:6px 0 0;letter-spacing:0.04em">
            DELETED ITEMS ARE KEPT FOR 6 MONTHS (180 DAYS) BEFORE AUTOMATIC EXPIRATION.
          </p>
        </div>
        ${count > 0 ? `<button type="button" class="admin-btn admin-btn-danger" data-act="empty-trash" style="font-weight:700">EMPTY RECYCLE BIN (${count}) 🗑️</button>` : ""}
      </div>

      <div class="admin-stat-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:28px">
        <div class="admin-stat" style="border:1px solid var(--line);padding:16px">
          <span style="font:10px var(--mono);color:#777;letter-spacing:0.1em;display:block">DELETED ITEMS</span>
          <strong style="font:32px var(--sans);display:block;margin:4px 0">${count}</strong>
          <p style="font:11px var(--mono);color:#888;margin:0">CURRENTLY IN BIN</p>
        </div>
        <div class="admin-stat" style="border:1px solid var(--line);padding:16px">
          <span style="font:10px var(--mono);color:#777;letter-spacing:0.1em;display:block">RETENTION POLICY</span>
          <strong style="font:32px var(--sans);display:block;margin:4px 0">180<span style="font-size:16px;font-weight:400;color:#666"> DAYS</span></strong>
          <p style="font:11px var(--mono);color:#888;margin:0">6-MONTH ARCHIVE</p>
        </div>
      </div>

      ${count === 0 ? `
        <div class="admin-trash-empty" style="border:1px dashed var(--line);padding:48px 24px;text-align:center;margin-top:20px">
          <p style="font:700 13px var(--mono);letter-spacing:0.1em;margin:0 0 6px">THE RECYCLE BIN IS EMPTY</p>
          <p style="font:12px var(--sans);color:#666;margin:0">Deleted projects, articles, field notes, and research notes will be safely preserved here.</p>
        </div>
      ` : `
        <div class="admin-list" style="display:flex;flex-direction:column;gap:12px">
          ${list.map((item) => {
            const typeLabel = String(item.type || "item").toUpperCase();
            const dateStr = item.deletedAt ? new Date(item.deletedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
            const daysLeft = typeof item.daysLeft === "number" ? item.daysLeft : 180;
            const daysTag = daysLeft <= 15
              ? `<span class="admin-trash-expiring" style="font:700 10px var(--mono);color:var(--accent-red,#e03c31);background:rgba(239,50,31,0.12);padding:2px 8px;border:1px solid var(--accent-red,#e03c31)">EXPIRING IN ${daysLeft}D</span>`
              : `<span class="admin-trash-tag" style="font:10px var(--mono);padding:2px 8px;border:1px solid var(--line)">${daysLeft} DAYS LEFT</span>`;

            return `
              <div class="admin-row-wrapper admin-trash-card" style="border:1px solid var(--line);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
                <div style="display:flex;flex-direction:column;gap:4px;min-width:240px;flex:1">
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                    <span class="admin-badge" style="font:700 9px var(--mono);background:#171717;color:#fff;padding:2px 6px;letter-spacing:0.1em">${esc(typeLabel)}</span>
                    <span style="font:11px var(--mono);color:#888">DELETED: ${esc(dateStr)}</span>
                    ${daysTag}
                  </div>
                  <b class="admin-trash-title" style="font:700 16px var(--sans);margin-top:4px">${esc(item.title || item.originalId || "Untitled Item")}</b>
                  <span style="font:11px var(--mono);color:#777;word-break:break-all">${esc(item.originalPath || item.originalId || "")}</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
                  <button type="button" class="admin-btn" data-act="restore-trash" data-id="${esc(item.id)}" data-title="${esc(item.title || item.originalId)}">
                    <span class="btn-icon">↺</span> <span class="btn-text">RESTORE</span>
                  </button>
                  <button type="button" class="admin-btn admin-btn-danger" data-act="purge-trash" data-id="${esc(item.id)}" data-title="${esc(item.title || item.originalId)}">
                    <span class="btn-icon">✕</span> <span class="btn-text">PURGE</span>
                  </button>
                </div>
              </div>`;
          }).join("")}
        </div>
      `}
      `
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

  function previewFrame(html, titleText = "PREVIEW") {
    document.querySelectorAll(".admin-preview").forEach(p => p.remove());
    const box = document.createElement("div");
    box.className = "admin-preview";
    box.innerHTML = `
      <div class="admin-preview-header">
        <div class="admin-preview-title-group">
          <span class="preview-dot"></span>
          <span>${esc(titleText)} — LIVE PREVIEW BEFORE PUSHING</span>
        </div>
        <div class="admin-preview-actions">
          <div class="preview-viewport-toggle">
            <button type="button" class="preview-mode-btn active" data-vp="desktop">💻 DESKTOP</button>
            <button type="button" class="preview-mode-btn" data-vp="mobile">📱 MOBILE</button>
          </div>
          <button class="admin-btn primary" type="button" data-act="close-preview">✕ CLOSE PREVIEW</button>
        </div>
      </div>
      <div class="admin-preview-container">
        <iframe title="Preview" sandbox="allow-same-origin allow-scripts"></iframe>
      </div>
    `;
    document.body.appendChild(box);

    const iframe = box.querySelector("iframe");
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/assets/styles.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    body { padding: 48px 32px 100px; max-width: 900px; margin: 0 auto; background: var(--paper, #f2f0ea); color: var(--ink, #111); }
  </style>
</head>
<body class="site-body">
  ${html}
</body>
</html>`);
    doc.close();

    box.querySelectorAll("[data-vp]").forEach(btn => {
      btn.addEventListener("click", () => {
        box.querySelectorAll("[data-vp]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const vp = btn.getAttribute("data-vp");
        if (vp === "mobile") {
          iframe.style.maxWidth = "390px";
          iframe.style.margin = "0 auto";
          iframe.style.display = "block";
          iframe.style.border = "2px solid #111";
        } else {
          iframe.style.maxWidth = "100%";
          iframe.style.margin = "0";
          iframe.style.border = "1px solid var(--line, #c8c6bf)";
        }
      });
    });

    box.querySelector('[data-act="close-preview"]')?.addEventListener("click", () => box.remove());
    return;
  }
  function oldPreviewFrame(html) {
    const box = document.createElement("div");
    box.className = "admin-preview";
    box.innerHTML = `<button class="admin-btn" type="button" data-act="close-preview">CLOSE PREVIEW</button><iframe title="Preview" sandbox="allow-same-origin allow-scripts"></iframe>`;
    app.appendChild(box);
    const doc = box.querySelector("iframe").contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><link rel="stylesheet" href="/assets/styles.css"></head><body>${html}</body></html>`);
    doc.close();
  }

  function getTitleSizeStyleAttr(titleSize) {
    if (!titleSize || titleSize === "default") return "";
    if (["sm", "md", "lg", "xl"].includes(titleSize)) {
      return `class="title-size-${esc(titleSize)}"`;
    }
    const sizeWithUnit = String(titleSize).includes("px") ? titleSize : `${titleSize}px`;
    return `style="font-size: clamp(32px, 6.5vw, ${esc(sizeWithUnit)}) !important;"`;
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
    const titleAttr = getTitleSizeStyleAttr(formValue(form, "titleSize") || "");
    previewFrame(`<main class="case-study"><header class="case-header"><p class="eyebrow">PROJECT PREVIEW</p><h1 ${titleAttr}>${title}<span class="red-stop">.</span></h1><p>${esc(formValue(form, "description"))}</p></header><article class="case-body">${sectionsHtml}</article></main>`);
  }

  function blogPreview(form) {
    const title = esc(formValue(form, "title"));
    const sections = collectSections(form);
    const sectionsHtml = sections
      .map(
        (section, idx) => `
        <section>
          ${section.label ? `<p class="case-num">${esc(section.label)}</p>` : ""}
          ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ""}
          <div>${markdownToHtml(section.body)}</div>
        </section>`
      )
      .join("");
    const titleAttr = getTitleSizeStyleAttr(formValue(form, "titleSize") || "");
    previewFrame(`<main class="article-page"><header class="case-header"><p class="eyebrow">05 / BLOG</p><h1 ${titleAttr}>${title}<span class="red-stop">.</span></h1><p>${esc(formValue(form, "description"))}</p></header><article class="case-body article-body">${sectionsHtml}</article></main>`);
  }

  function notePreview(form) {
    const title = esc(formValue(form, "title"));
    const sections = collectSections(form);
    const sectionsHtml = sections
      .map(
        (section, idx) => `
        <section>
          ${section.label ? `<p class="case-num">${esc(section.label)}</p>` : ""}
          ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ""}
          <div>${markdownToHtml(section.body)}</div>
        </section>`
      )
      .join("");
    const titleAttr = getTitleSizeStyleAttr(formValue(form, "titleSize") || "");
    previewFrame(`<main class="article-page"><header class="case-header"><p class="eyebrow">NOTE PREVIEW</p><h1 ${titleAttr}>${title}<span class="red-stop">.</span></h1></header><article class="case-body">${sectionsHtml}</article></main>`);
  }

  function journalPreview(form) {
    const title = esc(formValue(form, "title"));
    const sections = collectSections(form);
    const sectionsHtml = sections
      .map(
        (section, idx) => `
        <section>
          ${section.label ? `<p class="case-num">${esc(section.label)}</p>` : ""}
          ${section.heading ? `<h2>${esc(section.heading)}</h2>` : ""}
          <div>${markdownToHtml(section.body)}</div>
        </section>`
      )
      .join("");
    const titleAttr = getTitleSizeStyleAttr(formValue(form, "titleSize") || "");
    previewFrame(`<main class="note-page"><header class="note-header"><p class="eyebrow">04 / JOURNAL</p><h1 ${titleAttr}>${title}<span class="red-stop">.</span></h1></header><article class="case-body">${sectionsHtml}</article></main>`, "JOURNAL PREVIEW");
  }

  window.renderAdminSectionHtml = renderSection;
  window.reindexAdminSections = reindexSections;
  window.triggerEditorPreview = function(form) {
    if (!form) form = document.querySelector('form[data-form="project"], form[data-form="blog"], form[data-form="note"], form[data-form="journal"]');
    if (!form) return;
    const type = form.getAttribute("data-form");
    syncAllWysiwyg(form);
    if (type === "project") projectPreview(form);
    else if (type === "blog") blogPreview(form);
    else if (type === "note") notePreview(form);
    else if (type === "journal") journalPreview(form);
  };

  async function loadContent() {
    state.content = await api("/api/content");
  }

  let renderGeneration = 0;
  let currentRenderPath = null;

  async function render(force = false) {
    const path = hash();
    if (!force && isFormActive() && currentRenderPath === path) {
      return;
    }
    const myGen = ++renderGeneration;
    state.error = "";
    try {
      try {
        if (!state.config || !state.user) {
          const [cfg, ses] = await Promise.all([
            api("/api/auth/config"),
            state.user ? Promise.resolve(state.user) : api("/api/session")
          ]);
          state.config = cfg;
          if (!state.user) {
            state.user = ses.login ? ses : null;
          }
        }
        if (myGen !== renderGeneration) return;
      } catch (err) {
        app.innerHTML = `<div class="admin-gate"><h1>ADMIN SERVER REQUIRED<span class="red-stop">.</span></h1><p>Open the admin origin instead of the public Eleventy port. From the project folder run <code>npm.cmd run admin</code> and go to <a href="http://localhost:8787/admin/">http://localhost:8787/admin/</a>.</p><p class="admin-msg error">${esc(err.message)}</p></div>`;
        return;
      }
      if (!state.user) {
        app.innerHTML = gate();
        return;
      }
      if (path === "/") {
        const overview = await api("/api/overview");
        if (myGen !== renderGeneration) return;
        app.innerHTML = dashboard(overview);
        currentRenderPath = path;
        if (!state.content) {
          loadContent().catch(() => {});
        }
        return;
      }
      if (path === "/trash") {
        currentRenderPath = path;
        try {
          const trashRes = await api("/api/trash");
          if (myGen !== renderGeneration) return;
          app.innerHTML = trashView(trashRes.items || []);
        } catch (err) {
          console.error("Failed to load recycle bin:", err);
          app.innerHTML = chrome("09 / RECYCLE BIN", `
            <div class="admin-toolbar">
              <h1>RECYCLE BIN<span class="red-stop">.</span></h1>
            </div>
            <div style="border:1px solid var(--red);background:#fff8f8;padding:24px;margin:24px 0">
              <p class="admin-kicker" style="color:var(--red);margin-bottom:8px">⚠ SERVER ENDPOINT NOT LOADED</p>
              <h2 style="margin:0 0 12px;font:700 18px var(--sans)">PLEASE RESTART THE ADMIN SERVER</h2>
              <p style="font:13px/1.6 var(--mono);margin:0 0 16px;color:#333">
                The local admin server was started before the Recycle Bin API was added.
              </p>
              <div style="background:#171717;color:#fff;padding:14px 18px;font:13px var(--mono);margin-bottom:18px;line-height:1.7">
                1. Go to the terminal where <code>npm run admin</code> is running.<br>
                2. Press <strong style="color:var(--red)">Ctrl + C</strong> to stop the server.<br>
                3. Run <code>npm run admin</code> again.<br>
                4. Refresh this page.
              </div>
              <button class="admin-btn primary" onclick="location.reload()" type="button">RELOAD PAGE <b>→</b></button>
            </div>
          `);
        }
        if (!state.content) {
          loadContent().catch(() => {});
        }
        return;
      }
      if (!state.content) await loadContent();
      if (!force && currentRenderPath === path && document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement) {
        return;
      }
      currentRenderPath = path;
      const parts = path.split("/").filter(Boolean);
      if (path === "/") {
        const overview = await api("/api/overview");
        if (myGen !== renderGeneration) return;
        app.innerHTML = dashboard(overview);
      } else if (path === "/projects") {
        app.innerHTML = chrome("03 / PROJECTS", `<div class="admin-toolbar"><h1>CASE STUDIES<span class="red-stop">.</span></h1><a class="admin-btn primary" href="#/projects/new">NEW PROJECT <b>→</b></a></div>${rows(state.content.projects, (item) => `#/projects/${item.slug}`, "project")}`);
      } else if (path === "/projects/new") {
        app.innerHTML = projectForm({}, true);
      } else if (parts[0] === "projects" && parts[1]) {
        const target = decodeURIComponent(parts[1]);
        const item = state.content.projects.find((p) => p.slug === target || p.slug === parts[1]) || {};
        app.innerHTML = projectForm(item, false);
      } else if (path === "/blog") {
        app.innerHTML = chrome("04 / BLOG", `<div class="admin-toolbar"><h1>ARTICLES<span class="red-stop">.</span></h1><a class="admin-btn primary" href="#/blog/new">NEW ARTICLE <b>→</b></a></div>${rows(state.content.blog, (item) => `#/blog/${item.slug}`, "blog")}`);
      } else if (path === "/blog/new") {
        app.innerHTML = blogForm({}, true);
      } else if (parts[0] === "blog" && parts[1]) {
        const target = decodeURIComponent(parts[1]);
        const item = state.content.blog.find((p) => p.slug === target || p.slug === parts[1]) || {};
        app.innerHTML = blogForm(item, false);
      } else if (path === "/journal") {
        app.innerHTML = chrome("05 / JOURNAL", `<div class="admin-toolbar"><h1>FIELD NOTES<span class="red-stop">.</span></h1><a class="admin-btn primary" href="#/journal/new">NEW NOTE <b>→</b></a></div>${rows(state.content.journal, (item) => `#/journal/${item.id || item.slug || item.date}`, "journal")}`);
      } else if (path === "/journal/new") {
        app.innerHTML = journalForm({}, true);
      } else if (parts[0] === "journal" && parts[1]) {
        const target = decodeURIComponent(parts[1]);
        const item = state.content.journal.find((p) => p.id === target || p.slug === target || p.date === target || p.dateISO === target) || {};
        app.innerHTML = journalForm(item, false);
      } else if (path === "/notes") {
        app.innerHTML = chrome("06 / NOTES", `<div class="admin-toolbar"><h1>RESEARCH NOTES<span class="red-stop">.</span></h1><a class="admin-btn primary" href="#/notes/new">NEW NOTE <b>→</b></a></div>${rows(state.content.notes || [], (item) => `#/notes/${item.slug}`, "note")}`);
      } else if (path === "/notes/new") {
        app.innerHTML = noteForm({}, true);
      } else if (parts[0] === "notes" && parts[1]) {
        const target = decodeURIComponent(parts[1]);
        const item = (state.content.notes || []).find((n) => n.slug === target || n.slug === parts[1] || n.filename === target) || {};
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
      if (window.ZendocController && typeof window.ZendocController.mount === "function") {
        setTimeout(() => window.ZendocController.mount(), 20);
      }
    } finally {
      // render generation counter handles concurrency; no reset needed
    }
  }

  async function onSubmit(form, publishFlag) {
    const type = form.getAttribute("data-form");
    const isNew = form.getAttribute("data-new") === "1";
    if (type === "passcode-login") {
      const passcode = formValue(form, "passcode");
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "UNLOCKING CONSOLE... <span class='btn-spinner'></span>";
      }
      try {
        const res = await api("/api/auth/passcode", { method: "POST", body: { passcode } });
        if (res && res.login) {
          state.user = { login: res.login, passcode: true };
        }
        await render(true);
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = "UNLOCK CONSOLE <b>→</b>";
        }
        throw err;
      }
      return;
    }
    if (type === "media-upload") {
      const file = form.elements.file.files[0];
      const folder = formValue(form, "folder") || "about";
      const uploaded = await uploadMediaFile(file, folder);
      state.message = "Media uploaded successfully to Cloudflare R2.";
      state.content = null;
      return uploaded;
    }
    let published = Boolean(formValue(form, "published"));
    if (publishFlag === "true") {
      published = true;
    } else if (publishFlag === "false") {
      published = false;
    }
    if (type === "project") {
      const sections = collectSections(form);
      const titleVal = formValue(form, "title");
      const slugVal = formValue(form, "slug") || slugify(titleVal);
      const payload = {
        title: titleVal,
        slug: slugVal,
        titleSize: formValue(form, "titleSize") || "md",
        number: formValue(form, "number"),
        date: formValue(form, "date"),
        year: formValue(form, "year"),
        titleSize: formValue(form, "titleSize") || "md",
        category: formValue(form, "category"),
        description: formValue(form, "description"),
        summary: formValue(form, "summary"),
        technologies: formValue(form, "technologies"),
        titleSize: formValue(form, "titleSize") || "md",
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
      const oldSlug = form.getAttribute("data-slug");
      let res;
      if (isNew || !oldSlug) res = await api("/api/projects", { method: "POST", body: payload });
      else res = await api("/api/projects/" + encodeURIComponent(oldSlug), { method: "PUT", body: payload });
      state.message = published
        ? "Project saved. Open VIEW SITE to see it on the website."
        : "Draft saved. It stays off the public site until you publish.";
      state.content = null;
      return res;
    }
    if (type === "blog") {
      const sections = collectSections(form);
      const titleVal = formValue(form, "title");
      const slugVal = formValue(form, "slug") || slugify(titleVal);
      const payload = {
        title: titleVal,
        slug: slugVal,
        date: formValue(form, "date"),
        titleSize: formValue(form, "titleSize") || "md",
        category: formValue(form, "category"),
        tags: formValue(form, "tags"),
        description: formValue(form, "description"),
        titleSize: formValue(form, "titleSize") || "md",
        headline: formValue(form, "headline"),
        relatedProject: formValue(form, "relatedProject"),
        cover: formValue(form, "cover"),
        body: serializeSectionsToMarkdown(sections),
        featured: formValue(form, "featured"),
        published,
        sections: sections
      };
      const oldSlug = form.getAttribute("data-slug");
      let res;
      if (isNew || !oldSlug) res = await api("/api/blog", { method: "POST", body: payload });
      else res = await api("/api/blog/" + encodeURIComponent(oldSlug), { method: "PUT", body: payload });
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
        titleSize: formValue(form, "titleSize") || "md",
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
        published,
        sections: sections
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
      const titleVal = formValue(form, "title");
      const slugVal = formValue(form, "slug") || slugify(titleVal);
      const payload = {
        title: titleVal,
        slug: slugVal,
        date: formValue(form, "date"),
        tags: formValue(form, "tags"),
        body: serializeSectionsToMarkdown(sections),
        published,
        sections: sections
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
          titleSize: formValue(form, "titleSize") || "md",
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
        const themeBtn = event.target.closest("#admin-theme-toggle, #admin-theme-toggle-mobile, #admin-gate-theme-toggle, .admin-header-dot");
    if (themeBtn) {
      const isReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";

      // Randomly choose from 3 Bauhaus transition types:
      // 0: Radial Aperture Iris
      // 1: Diagonal Drafting Sweep
      // 2: Parallel Rule / Curtain Wipe
      const animType = Math.floor(Math.random() * 3);

      function applyTheme() {
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("abantika_theme", next);
        } catch (e) {}
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", next === "dark" ? "#0A0D12" : "#f2f0ea");
      }

      if (isReduced) {
        applyTheme();
        return;
    }

      if (themeBtn.classList) {
        themeBtn.classList.remove("dot-animating");
        void themeBtn.offsetWidth;
        themeBtn.classList.add("dot-animating");
        setTimeout(() => { themeBtn.classList.remove("dot-animating"); }, 450);

        const rect = themeBtn.getBoundingClientRect();
        const flare = document.createElement("div");
        if (animType === 0) {
          flare.className = "theme-ripple-ring";
        } else if (animType === 1) {
          flare.className = "theme-slash-flare";
        } else {
          flare.className = "theme-diamond-flare";
        }
        flare.style.left = (rect.left + rect.width / 2) + "px";
        flare.style.top = (rect.top + rect.height / 2) + "px";
        document.body.appendChild(flare);
        setTimeout(() => { flare.remove(); }, 500);
      }

      document.documentElement.classList.add("theme-transitioning");
      const clearTransition = () => {
        setTimeout(() => {
          document.documentElement.classList.remove("theme-transitioning");
        }, 420);
      };

      if (document.startViewTransition) {
        const rect = themeBtn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        let clipAnimation;
        if (animType === 0) {
          clipAnimation = [
            "circle(0px at " + x + "px " + y + "px)",
            "circle(" + endRadius + "px at " + x + "px " + y + "px)"
          ];
        } else if (animType === 1) {
          clipAnimation = [
            "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)",
            "polygon(-20% 0, 100% 0, 100% 100%, -20% 100%)"
          ];
        } else {
          clipAnimation = [
            "inset(0 0 100% 0)",
            "inset(0 0 0 0)"
          ];
        }

        const transition = document.startViewTransition(() => {
          applyTheme();
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: clipAnimation
            },
            {
              duration: 420,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              pseudoElement: "::view-transition-new(root)"
            }
          ).finished.finally(clearTransition);
        }).catch(() => {
          clearTransition();
        });
      } else {
        applyTheme();
        clearTransition();
      }
      return;
    }
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
      const href = adminNavLink.getAttribute("href");
      if (href && href.startsWith("#")) {
        const targetPath = href.replace(/^#/, "") || "/";
        if (hash() === targetPath) {
          render(true);
        }
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
        const editable = wrapper ? wrapper.querySelector(".wysiwyg-editable") : null;
        const source = wrapper ? wrapper.querySelector(".wysiwyg-source") : null;
        const previewPane = wrapper ? wrapper.querySelector(".wysiwyg-preview-pane") : null;
        const cmd = cmdBtn.getAttribute("data-wysiwyg-cmd");
        const activeTab = wrapper ? wrapper.querySelector(".wysiwyg-tab.active") : null;
        const mode = activeTab ? activeTab.getAttribute("data-wysiwyg-mode") : "edit";

        if (cmd === "table") {
          showTablePickerModal(wrapper);
          return;
        }

        if (cmd === "chart") {
          showChartPickerModal(wrapper);
          return;
        }

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
        } else if (mode === "preview") {
          if (cmd === "image") showImagePickerModal(wrapper);
          else if (cmd === "math") showMathPickerModal(wrapper);
          else if (cmd === "wikilink") {
            const title = prompt("Enter target document title for Wikilink [[ ... ]]:");
            if (title) {
              const alias = prompt("Optional alias (leave empty for none):");
              const tag = alias ? `[[${title}|${alias}]]` : `[[${title}]]`;
              insertIntoTextarea(source, tag);
            }
          }
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
          const isCollapsed = card.classList.toggle("collapsed");
          secCollapse.textContent = isCollapsed ? "+" : "—";
          secCollapse.setAttribute("title", isCollapsed ? "Expand Section Content" : "Collapse Section Content");
        }
        return;
      }

      const summaryBtn = event.target.closest(".collapsible-details-summary");
      if (summaryBtn) {
        event.preventDefault();
        const panel = summaryBtn.closest(".collapsible-details-panel");
        if (panel) {
          const isOpen = panel.classList.toggle("open");
          const content = panel.querySelector(".collapsible-details-content");
          if (content) content.style.display = isOpen ? "grid" : "none";
          const toggleHint = summaryBtn.querySelector(".toggle-hint");
          if (toggleHint) {
            toggleHint.textContent = isOpen ? "▼ CLICK TO COLLAPSE METADATA" : "▶ CLICK TO EXPAND METADATA";
          }
        }
        return;
      }
      const directUploadBtn = event.target.closest("#portrait-direct-upload-btn");
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
          try {
            await api("/api/auth/logout", { method: "POST", body: {} });
          } catch (e) {
            console.warn("Logout API call failed:", e);
          }
          state.user = null;
          state.content = null;
          state.error = "";
          state.message = "";
          location.hash = "#/";
          await render(true);
          return;
        }
        if (name === "dev") {
          act.disabled = true;
          act.innerHTML = "LOGGING IN... <span class='btn-spinner'></span>";
          try {
            const res = await api("/api/auth/dev", { method: "POST", body: {} });
            if (res && res.login) {
              state.user = { login: res.login, dev: true };
            }
            await render(true);
          } catch (err) {
            act.disabled = false;
            act.innerHTML = "DEVELOPER LOCALHOST LOGIN <b>→</b>";
            alert("Dev login failed: " + err.message);
          }
          return;
        }
        if (name === "close-preview") act.closest(".admin-preview").remove();
        if (name === "preview-project") { syncAllWysiwyg(act.closest("form")); projectPreview(act.closest("form")); }
        if (name === "preview-blog") { syncAllWysiwyg(act.closest("form")); blogPreview(act.closest("form")); }
        if (name === "preview-note") { syncAllWysiwyg(act.closest("form")); notePreview(act.closest("form")); }
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
        if (name === "restore-trash") {
          const id = act.getAttribute("data-id");
          const title = act.getAttribute("data-title") || "Item";
          showSudoConfirmModal({
            kicker: "09 / RESTORE",
            title: "RESTORE ITEM",
            message: `Restore <strong>"${esc(title)}"</strong> back to its original location?<br>It will be republished to the public website.`,
            promptLabel: `To confirm restoration, please type <code>SUDO RESTORE</code> below:`,
            expectedText: "SUDO RESTORE",
            buttonLabel: "RESTORE NOW",
            isDanger: false,
            onConfirm: async () => {
              const prog = showProgressModal({
                kicker: "09 / RECYCLE BIN",
                title: "RESTORING ITEM...",
                copy: `Restoring "${title}" and updating public site.`
              });
              try {
                const res = await api("/api/trash/restore", { method: "POST", body: { id } });
                prog.finish("ITEM RESTORED", `"${title}" has been restored to ${res.item?.originalPath || "its original location"}.`);
                state.content = null;
                await loadContent();
                go("/trash");
              } catch (err) {
                prog.fail(err.message);
              }
            }
          });
          return;
        }

        if (name === "purge-trash") {
          const id = act.getAttribute("data-id");
          const title = act.getAttribute("data-title") || "Item";
          showSudoConfirmModal({
            kicker: "09 / PERMANENT PURGE",
            title: "PURGE ITEM PERMANENTLY",
            message: `You are about to permanently erase <strong>"${esc(title)}"</strong> from the Recycle Bin.<br><span style="color:var(--red);font-weight:700">This action is completely irreversible and cannot be recovered.</span>`,
            promptLabel: `To permanently delete, please type <code>SUDO PURGE FINAL</code> below:`,
            expectedText: "SUDO PURGE FINAL",
            buttonLabel: "PURGE PERMANENTLY",
            isDanger: true,
            onConfirm: async () => {
              const prog = showProgressModal({
                kicker: "09 / RECYCLE BIN",
                title: "PURGING ITEM...",
                copy: `Permanently erasing "${title}".`
              });
              try {
                await api(`/api/trash/${encodeURIComponent(id)}`, { method: "DELETE" });
                prog.finish("ITEM PURGED", `"${title}" was permanently removed.`);
                state.content = null;
                await loadContent();
                go("/trash");
              } catch (err) {
                prog.fail(err.message);
              }
            }
          });
          return;
        }

        if (name === "empty-trash") {
          showSudoConfirmModal({
            kicker: "09 / EMPTY RECYCLE BIN",
            title: "EMPTY RECYCLE BIN",
            message: `You are about to permanently purge <strong>ALL ITEMS</strong> currently in the Recycle Bin.<br><span style="color:var(--red);font-weight:700">All deleted files will be irreversibly erased from the repository.</span>`,
            promptLabel: `To permanently empty the bin, please type <code>SUDO PURGE FINAL</code> below:`,
            expectedText: "SUDO PURGE FINAL",
            buttonLabel: "EMPTY ALL PERMANENTLY",
            isDanger: true,
            onConfirm: async () => {
              const prog = showProgressModal({
                kicker: "09 / RECYCLE BIN",
                title: "EMPTYING RECYCLE BIN...",
                copy: "Permanently purging all trashed items."
              });
              try {
                await api("/api/trash/empty", { method: "DELETE" });
                prog.finish("RECYCLE BIN EMPTIED", "All items in the Recycle Bin have been permanently erased.");
                state.content = null;
                await loadContent();
                go("/trash");
              } catch (err) {
                prog.fail(err.message);
              }
            }
          });
          return;
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
              const prog = showProgressModal({ kicker: "03 / PROJECT", title: "MOVING TO RECYCLE BIN...", copy: "Moving project to Recycle Bin (kept for 6 months) and rebuilding site." });
              try {
                await api(`/api/projects/${encodeURIComponent(slug)}`, { method: "DELETE" });
                state.content = null;
                prog.finish("MOVED TO RECYCLE BIN", `Project "${title}" was moved to the Recycle Bin. Kept for 6 months.`);
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
              const prog = showProgressModal({ kicker: "04 / BLOG", title: "MOVING TO RECYCLE BIN...", copy: "Moving article to Recycle Bin (kept for 6 months) and rebuilding site." });
              try {
                await api(`/api/blog/${encodeURIComponent(slug)}`, { method: "DELETE" });
                state.content = null;
                prog.finish("MOVED TO RECYCLE BIN", `Article "${title}" was moved to the Recycle Bin. Kept for 6 months.`);
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
              const prog = showProgressModal({ kicker: "05 / JOURNAL", title: "MOVING TO RECYCLE BIN...", copy: "Moving journal entry to Recycle Bin (kept for 6 months) and rebuilding site." });
              try {
                await api(`/api/journal/${encodeURIComponent(id)}`, { method: "DELETE" });
                state.content = null;
                prog.finish("MOVED TO RECYCLE BIN", `Journal entry "${title}" was moved to the Recycle Bin. Kept for 6 months.`);
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
              const prog = showProgressModal({ kicker: "06 / NOTE", title: "MOVING TO RECYCLE BIN...", copy: "Moving note to Recycle Bin (kept for 6 months) and rebuilding site." });
              try {
                await api(`/api/notes/${encodeURIComponent(slug)}`, { method: "DELETE" });
                state.content = null;
                prog.finish("MOVED TO RECYCLE BIN", `Note "${title}" was moved to the Recycle Bin. Kept for 6 months.`);
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
        if (name === "sync-r2-metrics") {
          const prog = showProgressModal({ kicker: "07 / MEDIA", title: "SYNCING R2 METRICS...", copy: "Fetching latest storage stats from Cloudflare R2 bucket." });
          try {
            const res = await api("/api/media");
            state.content = null;
            prog.finish("METRICS SYNCED", "Cloudflare R2 storage usage stats updated.");
            await render(true);
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
          await render(true);
        } catch(e) {
          prog.fail(e.message);
        }
      }
      if (publishBtn && publishBtn.tagName === "BUTTON" && publishBtn.type === "submit") {
        if (publishBtn.form) {
          publishBtn.form.dataset.nextPublish = publishBtn.getAttribute("data-publish") || "false";
        }
      }
    } catch (err) {
      console.error("Click handler error:", err);
      state.error = err.message;
      const msgEl = document.querySelector(".admin-main .admin-msg.error");
      if (msgEl) msgEl.textContent = err.message;
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
    const source = event.target.closest(".wysiwyg-source");
    if (source) {
      const wrapper = source.closest(".wysiwyg-wrapper");
      if (wrapper) {
        const editableEl = wrapper.querySelector(".wysiwyg-editable");
        if (editableEl) {
          editableEl.innerHTML = markdownToHtml(source.value);
        }
      }
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
    const submitter = event.submitter;
    const publishFlag = (submitter && submitter.getAttribute("data-publish")) || form.dataset.nextPublish || null;
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
      
      const isPublish = publishFlag === "true" || (publishFlag !== "false" && (Boolean(formValue(form, "published")) || ["about", "settings", "skills", "media-upload"].includes(type)));
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
      if (type === "media-upload") {
        state.content = null;
        await render(true);
      }
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

  function updateStickyBarScroll() {
    const stickyBar = document.querySelector(".admin-sticky-bar");
    if (stickyBar) {
      stickyBar.classList.toggle("is-scrolled", window.scrollY > 30);
    }
  }

  app.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.keyCode === 13) {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT") && target.type !== "submit" && target.type !== "button") {
        event.preventDefault();
      }
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target && event.target.name === "title") {
      const titleText = document.querySelector(".admin-sticky-title-text");
      if (titleText) {
        const val = event.target.value.trim();
        titleText.textContent = val || "UNTITLED";
        titleText.title = val || "UNTITLED";
      }
    }
  });

  function isFormActive() {
    if (document.querySelector("form.admin-form, .wysiwyg-wrapper")) return true;
    const active = document.activeElement;
    if (!active) return false;
    return !!(
      active.closest(".admin-form") ||
      active.closest(".wysiwyg-wrapper") ||
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable ||
      active.contentEditable === "true"
    );
  }

  let lastRouteHash = hash();
  window.addEventListener("hashchange", () => {
    const newRoute = hash();
    if (newRoute === lastRouteHash) return;
    if (isFormActive() && currentRenderPath === newRoute) return;
    lastRouteHash = newRoute;
    state.message = "";
    state.content = null;
    render(true).then(updateStickyBarScroll);
  });
  window.addEventListener("popstate", () => {
    const newRoute = hash();
    if (newRoute === lastRouteHash) return;
    if (isFormActive() && currentRenderPath === newRoute) return;
    lastRouteHash = newRoute;
    state.message = "";
    state.content = null;
    render(true).then(updateStickyBarScroll);
  });
  window.addEventListener("pageshow", () => {
    if (!isFormActive()) {
      state.content = null;
      render(false).then(updateStickyBarScroll);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !isFormActive()) {
      state.content = null;
      render(false).then(updateStickyBarScroll);
    }
  });
  render().then(updateStickyBarScroll);
})();
