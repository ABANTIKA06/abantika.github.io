/**
 * Document Editor — Variant B (Zendoc Style)
 * Bauhaus Editorial Design System · admin-doceditor.js
 *
 * Provides a clean, distraction-free document editing canvas:
 *   - Unified, continuous document sheet (like Google Docs / Zendoc)
 *   - Real-time text size controls: [-] 16px [+] stepper & SM/MD/LG/XL presets
 *   - Collapsible slide-over drawer for condensed metadata
 *   - Two-way sync with the underlying Eleventy form & API
 */

(function () {
  const esc = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function htmlToMd(node) {
    if (typeof node === "string") {
      const d = document.createElement("div");
      d.innerHTML = node;
      node = d;
    }
    let md = "";
    node.childNodes.forEach((c) => {
      if (c.nodeType === Node.TEXT_NODE) {
        md += c.textContent;
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        const t = c.tagName.toLowerCase();
        const inner = htmlToMd(c);
        if (t === "b" || t === "strong") md += `**${inner.trim()}**`;
        else if (t === "i" || t === "em") md += `*${inner.trim()}*`;
        else if (t === "u") md += `<u>${inner.trim()}</u>`;
        else if (t === "s" || t === "strike") md += `~~${inner.trim()}~~`;
        else if (t === "font") {
          const color = c.getAttribute("color");
          if (color) md += `<span style="color:${color}">${inner}</span>`;
          else md += inner;
        } else if (t === "span") {
          const style = c.getAttribute("style");
          if (style && (style.includes("color") || style.includes("background"))) {
            md += `<span style="${style}">${inner}</span>`;
          } else {
            md += inner;
          }
        } else if (t === "h1") md += `\n# ${inner.trim()}\n\n`;
        else if (t === "h2") md += `\n## ${inner.trim()}\n\n`;
        else if (t === "h3") md += `\n### ${inner.trim()}\n\n`;
        else if (t === "p" || t === "div") md += `\n${inner.trim()}\n\n`;
        else if (t === "br") md += "\n";
        else if (t === "ul") md += `\n${inner.trim()}\n\n`;
        else if (t === "ol") md += `\n${inner.trim()}\n\n`;
        else if (t === "li") md += `- ${inner.trim()}\n`;
        else if (t === "blockquote") md += `\n> ${inner.trim()}\n\n`;
        else if (t === "pre" || t === "code") md += `\n\`\`\`\n${inner.trim()}\n\`\`\`\n\n`;
        else if (t === "figure") {
          const img = c.querySelector("img");
          const captionEl = c.querySelector(".doc-image-caption") || c.querySelector("figcaption");
          if (img) {
            const src = img.getAttribute("src") || "";
            const alt = img.getAttribute("alt") || "Image";
            const caption = captionEl ? captionEl.textContent.trim() : "";
            const width = c.style.width || c.getAttribute("data-width") || "100%";
            const align = c.getAttribute("data-align") || "center";
            if (caption || (width && width !== "100%") || (align && align !== "center")) {
              const cleanWidth = width.replace(/[^0-9%px]/g, "") || "100%";
              md += `\n\n<figure data-align="${align}" style="width:${cleanWidth};text-align:${align};margin:24px auto;"><img src="${src}" alt="${alt}" style="max-width:100%;height:auto;"><figcaption>${caption}</figcaption></figure>\n\n`;
            } else {
              md += `\n\n![${alt}](${src})\n\n`;
            }
          }
        }
        else if (t === "img") md += `\n\n![${c.getAttribute("alt") || "Image"}](${c.getAttribute("src") || ""})\n\n`;
        else if (t === "a") md += `[${inner.trim()}](${c.getAttribute("href") || "#"})`;
        else md += inner;
      }
    });
    return md.replace(/\n{3,}/g, "\n\n");
  }

  function buildInteractiveFigure(src, alt, width = "100%", align = "center", caption = "") {
    const cleanWidth = (width || "100%").replace(/[^0-9%px]/g, "") || "100%";
    const cleanAlign = (align || "center").trim();
    return `<figure class="doc-image-figure" data-align="${cleanAlign}" style="width:${cleanWidth};text-align:${cleanAlign};margin:24px auto;" contenteditable="false"><div class="doc-image-wrap"><img src="${esc(src)}" alt="${esc(alt || "Image")}" style="width:100%;height:auto;display:inline-block;"><div class="doc-image-resize-handle handle-se" title="Drag to resize"></div><div class="doc-image-resize-handle handle-sw" title="Drag to resize"></div></div><figcaption class="doc-image-caption" contenteditable="true" placeholder="Click to add caption…">${esc(caption)}</figcaption></figure>`;
  }

  function mdToHtml(md) {
    if (!md) return "";
    let h = esc(String(md));

    // Decode and build interactive figures if already present as HTML
    h = h.replace(/&lt;figure(.*?)&gt;([\s\S]*?)&lt;\/figure&gt;/gi, (m, attrs, inner) => {
      const decodedAttrs = attrs.replace(/&quot;/g, '"');
      const alignMatch = decodedAttrs.match(/data-align="([^"]+)"/) || decodedAttrs.match(/text-align:\s*([^;"]+)/);
      const widthMatch = decodedAttrs.match(/width:\s*([^;"]+)/) || decodedAttrs.match(/data-width="([^"]+)"/);
      const align = alignMatch ? alignMatch[1].trim() : "center";
      const width = widthMatch ? widthMatch[1].trim() : "100%";

      const imgMatch = inner.match(/(?:&lt;|<)img\s+src=(?:&quot;|")([^"&]+)(?:&quot;|")(?:s+alt=(?:&quot;|")([^"&]*)(?:&quot;|"))?.*?(?:&gt;|>)/i);
      const captionMatch = inner.match(/(?:&lt;|<)figcaption.*?>(.*?)(?:&lt;\/figcaption&gt;|<\/figcaption>)/i);

      const src = imgMatch ? imgMatch[1] : "";
      const alt = (imgMatch && imgMatch[2]) ? imgMatch[2] : "Image";
      const caption = captionMatch ? captionMatch[1] : "";

      return buildInteractiveFigure(src, alt, width, align, caption);
    });

    // Convert standard markdown images ![alt](url) to interactive figures
    h = h.replace(/!\[(.*?)\]\((.*?)\)/g, (m, alt, src) => {
      return buildInteractiveFigure(src, alt, "100%", "center", "");
    });
    h = h.replace(/&lt;span style=&quot;(.*?)&quot;&gt;(.*?)&lt;\/span&gt;/gi, '<span style="$1">$2</span>');
    h = h.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, "<u>$1</u>");
    h = h.replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/gi, "<s>$1</s>");
    h = h.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    h = h.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    h = h.replace(/^# (.*$)/gim, "<h1>$1</h1>");
    h = h.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    h = h.replace(/\*(.*?)\*/g, "<i>$1</i>");
    h = h.replace(/~~(.*?)~~/g, "<s>$1</s>");
    h = h.replace(/^&gt; (.*$)/gim, "<blockquote>$1</blockquote>");
    h = h.replace(/```([\s\S]*?)```/g, "<pre>$1</pre>");
    h = h.replace(/^- (.*$)/gim, "<li>$1</li>");
    h = h.replace(/(<li>.*<\/li>)/g, "<ul>$1</ul>");
    h = h.replace(/(<\/ul>\s*<ul>)/g, "");
    h = h.replace(/\n/g, "<br>");
    return h;
  }

  let currentDocEditor = null;

  class ZendocDocumentEditor {
    constructor(formEl) {
      this.formEl = formEl;
      this.type = formEl.getAttribute("data-form");
      this.currentFontSize = parseInt(localStorage.getItem("admin_doc_fontsize") || "16", 10);
      this.currentFontFamily = localStorage.getItem("admin_doc_fontfamily") || "var(--sans)";
      this.shell = null;
      this.init();
    }

    init() {
      // 1. Extract data from form
      this.extractData();

      // 2. Hide classic form and classic sticky bar
      this.formEl.style.display = "none";
      document.body.classList.add("mode-zendoc-active");
      const classicBar = document.querySelector(".admin-sticky-bar");
      if (classicBar) classicBar.style.display = "none";

      // 3. Render Zendoc document view
      this.shell = document.createElement("div");
      this.shell.className = "doc-editor-shell";
      this.shell.id = "zendoc-editor-instance";
      this.shell.innerHTML = this.renderHtml();

      this.formEl.parentNode.insertBefore(this.shell, this.formEl);

      // 3b. Create floating Bauhaus Image Control Toolbar
      this.createImageToolbar();

      // 4. Bind events
      this.bindEvents();
      this.updateFontSize();
      this.updateTitleSize();
      this.updatePageWidth();
    }

    extractData() {
      const getVal = (name) => {
        const el = this.formEl.querySelector(`[name="${name}"]`);
        return el ? el.value : "";
      };

      this.isNew = this.formEl.getAttribute("data-new") === "1";
      this.pageWidth = localStorage.getItem("admin_doc_pagewidth") || "standard";
      this.title = getVal("title");

      const pubIn = this.formEl.querySelector('[name="published"]');
      this.published = pubIn ? pubIn.checked : false;

      const featIn = this.formEl.querySelector('[name="featured"]');
      this.featured = featIn ? featIn.checked : false;

      this.category = getVal("category");
      this.date = getVal("date");
      this.slug = getVal("slug") || this.formEl.getAttribute("data-slug") || this.formEl.getAttribute("data-id") || "";
      this.cover = getVal("cover");
      this.live = getVal("live");
      this.github = getVal("github");

      const techIn = this.formEl.querySelector('[name="technologies"]') || this.formEl.querySelector('[name="tags"]');
      this.technologies = techIn ? techIn.value : "";

      this.description = getVal("description");
      this.summary = getVal("summary");
      this.headline = getVal("headline");
      this.number = getVal("number");
      this.year = getVal("year");
      this.art = getVal("art") || "dots";
      this.customArt = getVal("customArt");
      this.artLabel = getVal("artLabel");
      this.relatedProject = getVal("relatedProject") || getVal("project");
      this.data = getVal("data");
      this.method = getVal("method");
      this.result = getVal("result");
      this.tools = getVal("tools");

      const titleSizeIn = this.formEl.querySelector('[name="titleSize"]');
      this.titleSize = titleSizeIn && titleSizeIn.value ? titleSizeIn.value : "md";

      // Combine sections into unified document content
      const cards = this.formEl.querySelectorAll(".section-card");
      let unifiedMd = "";
      if (cards.length > 0) {
        cards.forEach((card, idx) => {
          const headingIn = card.querySelector(".section-heading-input");
          const labelIn = card.querySelector(".section-label-input");
          const bodySource = card.querySelector(".wysiwyg-source");
          const editable = card.querySelector(".wysiwyg-editable");

          const heading = headingIn ? headingIn.value.trim() : "";
          const label = labelIn ? labelIn.value.trim() : "";
          let body = "";
          if (bodySource && bodySource.value) body = bodySource.value;
          else if (editable) body = htmlToMd(editable);

          if (heading) {
            unifiedMd += `## ${heading}\n\n`;
          } else if (label) {
            unifiedMd += `## ${label}\n\n`;
          }
          if (body) {
            unifiedMd += `${body}\n\n`;
          }
        });
      } else {
        // Fallback to description or intro
        unifiedMd = this.description || "Write your narrative here…";
      }

      this.unifiedContentHtml = mdToHtml(unifiedMd.trim());
    }

    createImageToolbar() {
      document.getElementById("zendoc-image-floating-bar")?.remove();
      this.imageToolbar = document.createElement("div");
      this.imageToolbar.className = "doc-image-floating-bar";
      this.imageToolbar.id = "zendoc-image-floating-bar";
      this.imageToolbar.innerHTML = `
        <div class="img-bar-group">
          <span class="img-bar-label">WIDTH:</span>
          <button type="button" class="img-bar-btn" data-set-size="25%">25%</button>
          <button type="button" class="img-bar-btn" data-set-size="50%">50%</button>
          <button type="button" class="img-bar-btn" data-set-size="75%">75%</button>
          <button type="button" class="img-bar-btn" data-set-size="100%">100%</button>
          <button type="button" class="img-bar-step-btn" data-img-act="size-dec" title="Decrease width">−</button>
          <span class="img-bar-val" id="zendoc-img-width-val">100%</span>
          <button type="button" class="img-bar-step-btn" data-img-act="size-inc" title="Increase width">+</button>
        </div>
        <span class="img-bar-divider"></span>
        <div class="img-bar-group">
          <span class="img-bar-label">ALIGN:</span>
          <button type="button" class="img-bar-btn" data-set-align="left" title="Align Left">⫷ Left</button>
          <button type="button" class="img-bar-btn" data-set-align="center" title="Align Center">≡ Center</button>
          <button type="button" class="img-bar-btn" data-set-align="right" title="Align Right">⫸ Right</button>
        </div>
        <span class="img-bar-divider"></span>
        <div class="img-bar-group">
          <button type="button" class="img-bar-btn" data-img-act="caption" title="Add / Edit Caption">💬 Caption</button>
          <button type="button" class="img-bar-btn" data-img-act="replace" title="Replace Image from Media Library or URL">🔄 Replace</button>
          <button type="button" class="img-bar-btn" data-img-act="alt" title="Edit Alt Text">🏷 Alt</button>
          <button type="button" class="img-bar-btn danger" data-img-act="delete" title="Delete Image">✕ Delete</button>
        </div>
      `;
      document.body.appendChild(this.imageToolbar);
    }

    renderHtml() {
      const typeLabel = (this.type || "document").toUpperCase();
      const statusText = this.published ? "Published" : "Drafting";
      const catBadge = this.category ? `<span class="doc-meta-badge">${esc(this.category)}</span>` : "";

      const backHash = this.type === "project" ? "projects" : (this.type === "note" ? "notes" : (this.type || "blog"));

      return `
        <!-- Sticky Header Container (Pins Top App Bar + Formatting Toolbar when scrolling) -->
        <div class="doc-sticky-header" id="zendoc-sticky-header">
          <!-- Top Zendoc Bar -->
          <div class="doc-top-appbar">
            <div class="doc-top-left">
              <a href="#/${esc(backHash)}" class="doc-back-circle-btn" title="Back to list" aria-label="Go Back">
                <span>&lt;</span>
              </a>
              <span class="doc-brand-badge">
                <span class="doc-brand-dot"></span>
                <span>zendoc / ${esc(typeLabel)}</span>
              </span>
              <div class="doc-header-title-box">
                <button type="button" class="doc-star-btn ${this.featured ? "starred" : ""}" id="zendoc-star-btn" title="${this.featured ? "Featured on Homepage (Click to unfeature)" : "Star as Featured on Homepage"}">
                  ${this.featured ? "★" : "☆"}
                </button>
                <input type="text" class="doc-title-input" id="zendoc-top-title" value="${esc(this.title || "Untitled Document")}" placeholder="Type document title…">
                <span class="req-star" title="Title is required">*</span>
                <span class="doc-save-badge">
                  <span class="doc-save-dot" id="zendoc-save-dot"></span>
                  <span id="zendoc-save-text">Auto-synced</span>
                </span>
              </div>
            </div>
            <div class="doc-top-right">
              <button type="button" class="admin-btn" id="zendoc-top-preview-btn" style="font-size:11px;padding:6px 12px;background:#ffffff;border:1px solid var(--ink,#111);font-weight:700" title="Live Preview Before Pushing">
                <span>👁 PREVIEW</span>
              </button>
              <select class="doc-toolbar-select" id="zendoc-status-select" style="font-weight:700">
                <option value="draft" ${!this.published ? "selected" : ""}>Drafting ▾</option>
                <option value="published" ${this.published ? "selected" : ""}>Published ✓</option>
              </select>
              <button type="button" class="doc-meta-toggle-btn ${this.category ? "has-meta" : ""}" id="zendoc-open-drawer-btn" title="Open Document Metadata & Properties">
                <span>⚙ PROPERTIES</span>
                ${catBadge}
              </button>
              <button type="button" class="admin-btn" id="zendoc-save-draft-btn" style="font-weight:700;padding:6px 14px" title="Save draft to disk">
                <span>💾 SAVE DRAFT</span>
              </button>
              <button type="button" class="admin-btn primary" id="zendoc-publish-btn" style="font-weight:700;padding:6px 14px" title="Publish live to site">
                <span>PUBLISH ↗</span>
              </button>
            </div>
          </div>

          <!-- Full Formatting Toolbar (Single-Row Calm) -->
          <div class="doc-full-toolbar">
            <button type="button" class="doc-toolbar-btn" data-cmd="undo" title="Undo (Ctrl+Z)">↺</button>
            <button type="button" class="doc-toolbar-btn" data-cmd="redo" title="Redo (Ctrl+Y)">↻</button>
            <span class="doc-toolbar-divider"></span>

            <!-- Block formatting selector -->
            <select class="doc-toolbar-select" id="zendoc-block-select" title="Paragraph / Heading Style">
              <option value="p">Paragraph text</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="blockquote">Quote block</option>
              <option value="pre">Code block</option>
            </select>

            <!-- Font Family Selector -->
            <select class="doc-toolbar-select" id="zendoc-font-select" title="Font Family">
              <option value="var(--sans)" ${this.currentFontFamily.includes("sans") ? "selected" : ""}>Inter (Modern Sans)</option>
              <option value="var(--mono)" ${this.currentFontFamily.includes("mono") ? "selected" : ""}>DM Mono (Technical)</option>
              <option value="Georgia, serif" ${this.currentFontFamily.includes("Georgia") ? "selected" : ""}>Georgia (Editorial)</option>
            </select>
            <span class="doc-toolbar-divider"></span>

            <!-- Text Size Stepper Control -->
            <div class="doc-size-stepper" title="Control text size">
              <button type="button" class="doc-step-btn" id="zendoc-font-dec" title="Decrease font size">−</button>
              <span class="doc-size-display" id="zendoc-size-display">${this.currentFontSize}px</span>
              <button type="button" class="doc-step-btn" id="zendoc-font-inc" title="Increase font size">+</button>
            </div>
            <span class="doc-toolbar-divider"></span>

            <!-- Inline Styling -->
            <button type="button" class="doc-toolbar-btn" data-cmd="bold" title="Bold"><b>B</b></button>
            <button type="button" class="doc-toolbar-btn" data-cmd="italic" title="Italic"><i>I</i></button>
            <button type="button" class="doc-toolbar-btn" data-cmd="underline" title="Underline"><u>U</u></button>
            <button type="button" class="doc-toolbar-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
            
            <!-- Interactive Color Picker Dropdown (Split Action) -->
            <div class="doc-color-picker-wrapper" id="zendoc-color-wrapper">
              <div class="doc-color-split-btn">
                <button type="button" class="doc-color-apply-btn" id="zendoc-color-apply-btn" title="Apply active color to highlighted text (Click to apply)">
                  <span class="doc-color-swatch" id="zendoc-active-swatch"></span>
                  <span style="font-weight:700">A</span>
                </button>
                <button type="button" class="doc-color-arrow-btn" id="zendoc-color-btn" title="Open color palette & highlighters">
                  <span style="font-size:8px;color:#888">▾</span>
                </button>
              </div>
              <div class="doc-color-popover" id="zendoc-color-popover">
                <div class="doc-color-section-label">TEXT COLOR</div>
                <div class="doc-color-palette">
                  <button type="button" class="doc-color-dot" data-forecolor="#ef321f" style="background:#ef321f" title="Bauhaus Red Accent"></button>
                  <button type="button" class="doc-color-dot" data-forecolor="#111111" style="background:#111111" title="Ink Black (Default)"></button>
                  <button type="button" class="doc-color-dot" data-forecolor="#666666" style="background:#666666" title="Muted Gray"></button>
                  <button type="button" class="doc-color-dot" data-forecolor="#0055ff" style="background:#0055ff" title="Cobalt Blue"></button>
                  <button type="button" class="doc-color-dot" data-forecolor="#188038" style="background:#188038" title="Forest Green"></button>
                  <button type="button" class="doc-color-dot" data-forecolor="#e67e22" style="background:#e67e22" title="Amber Orange"></button>
                  <label class="doc-color-custom-label" title="Choose Custom Color">
                    <input type="color" id="zendoc-custom-forecolor" value="#ef321f">
                    <span>🎨</span>
                  </label>
                </div>

                <div class="doc-color-section-label" style="margin-top:10px">HIGHLIGHT MARKER</div>
                <div class="doc-color-palette">
                  <button type="button" class="doc-highlight-dot" data-backcolor="#fff275" style="background:#fff275" title="Yellow Highlight"></button>
                  <button type="button" class="doc-highlight-dot" data-backcolor="#ffd1cc" style="background:#ffd1cc" title="Red Tint Highlight"></button>
                  <button type="button" class="doc-highlight-dot" data-backcolor="#d4edda" style="background:#d4edda" title="Green Tint Highlight"></button>
                  <button type="button" class="doc-highlight-dot" data-backcolor="#d1ecf1" style="background:#d1ecf1" title="Blue Tint Highlight"></button>
                  <button type="button" class="doc-color-clear-btn" data-backcolor="transparent" title="Remove Highlight">✕ Clear</button>
                </div>
              </div>
            </div>
            <span class="doc-toolbar-divider"></span>

            <!-- Alignment & Lists -->
            <button type="button" class="doc-toolbar-btn" data-cmd="justifyLeft" title="Align Left">≡</button>
            <button type="button" class="doc-toolbar-btn" data-cmd="justifyCenter" title="Align Center">≢</button>
            <button type="button" class="doc-toolbar-btn" data-cmd="insertUnorderedList" title="Bullet List">•≡</button>
            <button type="button" class="doc-toolbar-btn" data-cmd="insertOrderedList" title="Numbered List">1.≡</button>
            <span class="doc-toolbar-divider"></span>

            <!-- Insert Rich Elements -->
            <button type="button" class="doc-toolbar-btn" data-act="insert-image" title="Insert Image from Library or URL" style="font-weight:700">📷</button>
            <button type="button" class="doc-toolbar-btn" data-act="insert-table" title="Insert Data Table" style="font-weight:700">⊞</button>
            <button type="button" class="doc-toolbar-btn" data-act="insert-chart" title="Insert Interactive Chart" style="color:var(--red,#ef321f);font-weight:700">📊</button>
            <button type="button" class="doc-toolbar-btn" data-act="insert-math" title="Insert LaTeX Formula" style="color:var(--red,#ef321f);font-weight:700">∑</button>
            <span class="doc-toolbar-divider"></span>

            <!-- Section Controls in Toolbar -->
            <div class="doc-section-tool-group">
              <button type="button" class="doc-toolbar-section-btn" id="zendoc-toolbar-add-sec" title="Insert Editorial Section Break (Alt+S)">
                <span style="color:var(--red,#ef321f);font-weight:900">§</span>
                <span>+ SECTION</span>
              </button>
              <select class="doc-toolbar-select" id="zendoc-toolbar-section-jump" title="Jump to Document Section">
                <option value="">§ Outline ▾</option>
              </select>
            </div>
            <span class="doc-toolbar-divider"></span>

            <!-- Page Width Controls in Toolbar (Compact Dropdown) -->
            <select class="doc-toolbar-select" id="zendoc-toolbar-width-select" title="Canvas Page Width" style="font-weight:700">
              <option value="narrow" ${this.pageWidth === 'narrow' ? 'selected' : ''}>↔ Narrow (740px)</option>
              <option value="standard" ${(!this.pageWidth || this.pageWidth === 'standard') ? 'selected' : ''}>↔ Standard (860px)</option>
              <option value="wide" ${this.pageWidth === 'wide' ? 'selected' : ''}>↔ Wide (1120px)</option>
              <option value="full" ${this.pageWidth === 'full' ? 'selected' : ''}>↔ Full Width (100%)</option>
            </select>
          </div>
        </div>

        <!-- Center Document Viewport -->
        <div class="doc-viewport">
          <div class="doc-paper-sheet width-${esc(this.pageWidth || 'standard')}" id="zendoc-paper-sheet">
            <div class="doc-paper-header-row">
              <div class="doc-paper-kicker">${esc(typeLabel)} SPECIFICATION</div>
              <div class="doc-title-size-pill-bar" title="Document Title Size (Published Page & Document Sheet)">
                <span class="doc-title-size-label">TITLE SIZE:</span>
                <button type="button" class="doc-title-size-btn ${this.titleSize === 'sm' ? 'active' : ''}" data-title-size="sm" title="Small / Compact Title">SM</button>
                <button type="button" class="doc-title-size-btn ${(!this.titleSize || this.titleSize === 'md') ? 'active' : ''}" data-title-size="md" title="Medium / Balanced Title">MD</button>
                <button type="button" class="doc-title-size-btn ${this.titleSize === 'lg' ? 'active' : ''}" data-title-size="lg" title="Large / Editorial Display Title">LG</button>
                <button type="button" class="doc-title-size-btn ${this.titleSize === 'xl' ? 'active' : ''}" data-title-size="xl" title="Extra Large / Hero Scale Title">XL</button>
                <div class="doc-title-stepper-mini" title="Fine-tune Title Size">
                  <button type="button" id="zendoc-title-size-dec" title="Decrease Title Size">−</button>
                  <span id="zendoc-title-size-display">${(this.titleSize || 'MD').toUpperCase()}</span>
                  <button type="button" id="zendoc-title-size-inc" title="Increase Title Size">+</button>
                </div>
              </div>
            </div>
            <h1 class="doc-paper-h1 title-size-${esc(this.titleSize || 'md')}" id="zendoc-paper-title" contenteditable="true" spellcheck="false">${esc(this.title || "UNTITLED DOCUMENT")}</h1>
            
            <!-- Unified Continuous Content Surface -->
            <div class="doc-unified-canvas" id="zendoc-unified-canvas" contenteditable="true" spellcheck="true">${this.unifiedContentHtml}</div>
          </div>
        </div>

        <!-- Collapsible Slide-Over Metadata Drawer (Quiet & Condensed) -->
        <div class="doc-drawer-backdrop" id="zendoc-drawer-backdrop"></div>
        <aside class="doc-drawer-panel" id="zendoc-drawer-panel">
          <div class="doc-drawer-header">
            <h3 class="doc-drawer-title">DOCUMENT PROPERTIES</h3>
            <button type="button" class="doc-drawer-close" id="zendoc-drawer-close-btn" title="Close Drawer">✕</button>
          </div>
          <div class="doc-drawer-content">
            <!-- Suggested Editorial Sections (Zendoc Style) -->
            <div class="doc-condensed-card">
              <h4 class="doc-condensed-card-title">EDITORIAL SECTIONS (ZENDOC PRESETS)</h4>
              <div class="doc-suggestions-container">
                <button type="button" class="doc-suggested-pill" data-insert-suggest="THE QUESTION & HYPOTHESIS">
                  <span class="doc-suggested-bullet"></span>
                  <span>+ Add "The Question & Problem"</span>
                </button>
                <button type="button" class="doc-suggested-pill" data-insert-suggest="THE EVIDENCE & DATA PIPELINE">
                  <span class="doc-suggested-bullet"></span>
                  <span>+ Add "The Evidence & Data"</span>
                </button>
                <button type="button" class="doc-suggested-pill" data-insert-suggest="THE METHOD & ARCHITECTURE">
                  <span class="doc-suggested-bullet"></span>
                  <span>+ Add "The Methodology"</span>
                </button>
                <button type="button" class="doc-suggested-pill" data-insert-suggest="THE OUTCOME & METRICS">
                  <span class="doc-suggested-bullet"></span>
                  <span>+ Add "The Results & Metrics"</span>
                </button>
                <button type="button" class="doc-suggested-pill" data-insert-suggest="STRATEGIC TAKEAWAYS">
                  <span class="doc-suggested-bullet"></span>
                  <span>+ Add "Key Takeaways"</span>
                </button>
              </div>
            </div>

            <!-- Card 1: Status & Publishing -->
            <div class="doc-condensed-card">
              <h4 class="doc-condensed-card-title">01 / STATUS</h4>
              <label class="doc-condensed-toggle">
                <input type="checkbox" id="zendoc-meta-published" ${this.published ? "checked" : ""}>
                <span>PUBLISHED ON WEBSITE</span>
              </label>
              <label class="doc-condensed-toggle">
                <input type="checkbox" id="zendoc-meta-featured" ${this.featured ? "checked" : ""}>
                <span>FEATURE ON HOMEPAGE ★</span>
              </label>
            </div>

            <!-- Card 2: Taxonomy & Identity -->
            <div class="doc-condensed-card">
              <h4 class="doc-condensed-card-title">02 / TAXONOMY & DATES</h4>
              <div class="doc-condensed-field">
                <label>DOCUMENT TITLE SIZE (PUBLISHED & DOC)</label>
                <select id="zendoc-meta-title-size">
                  <option value="sm" ${this.titleSize === "sm" ? "selected" : ""}>SM — Compact (48px - 64px)</option>
                  <option value="md" ${(!this.titleSize || this.titleSize === "md") ? "selected" : ""}>MD — Balanced (72px - 88px)</option>
                  <option value="lg" ${this.titleSize === "lg" ? "selected" : ""}>LG — Editorial Display (96px - 112px)</option>
                  <option value="xl" ${this.titleSize === "xl" ? "selected" : ""}>XL — Maximum Impact / Hero (120px - 140px)</option>
                </select>
              </div>
              <div class="doc-condensed-field">
                <label>PAGE WIDTH (CANVAS LAYOUT)</label>
                <select id="zendoc-meta-page-width">
                  <option value="narrow" ${this.pageWidth === 'narrow' ? 'selected' : ''}>Narrow Sheet — Reading (740px)</option>
                  <option value="standard" ${(!this.pageWidth || this.pageWidth === 'standard') ? 'selected' : ''}>Standard Sheet — Editorial (860px)</option>
                  <option value="wide" ${this.pageWidth === 'wide' ? 'selected' : ''}>Wide Sheet — Analytical (1120px)</option>
                  <option value="full" ${this.pageWidth === 'full' ? 'selected' : ''}>Full Width — Fluid Canvas (100%)</option>
                </select>
              </div>
              <div class="doc-condensed-field">
                <label>CATEGORY <span class="req-star" title="Required field">*</span></label>
                <input type="text" id="zendoc-meta-category" value="${esc(this.category)}" placeholder="e.g. DATA SCIENCE / ML" required>
              </div>
              <div class="doc-condensed-field">
                <label>PUBLICATION DATE <span class="req-star" title="Required field">*</span></label>
                <input type="date" id="zendoc-meta-date" value="${esc(this.date)}" required>
              </div>
              <div class="doc-condensed-field">
                <label>URL SLUG</label>
                <input type="text" id="zendoc-meta-slug" value="${esc(this.slug)}" placeholder="auto-generated-from-title">
              </div>
            </div>

            <!-- Card 3: Media & External Links -->
            <div class="doc-condensed-card">
              <h4 class="doc-condensed-card-title">03 / MEDIA & LINKS</h4>
              <div class="doc-condensed-field">
                <label>TECHNOLOGIES / TAGS</label>
                <textarea id="zendoc-meta-tech" placeholder="One per line or comma-separated">${esc(this.technologies)}</textarea>
              </div>
              <div class="doc-condensed-field">
                <label>COVER IMAGE / ART PATH</label>
                <div style="display:flex;gap:6px">
                  <input type="text" id="zendoc-meta-cover" value="${esc(this.cover)}" placeholder="/assets/images/..." style="flex:1">
                  <button type="button" class="admin-btn" id="zendoc-pick-cover-btn" style="padding:4px 8px;font-size:10px" title="Choose or upload image from library">CHOOSE ↗</button>
                </div>
              </div>
              <div class="doc-condensed-field">
                <label>LIVE DEMO URL</label>
                <input type="url" id="zendoc-meta-live" value="${esc(this.live)}" placeholder="https://...">
              </div>
              <div class="doc-condensed-field">
                <label>GITHUB REPOSITORY</label>
                <input type="url" id="zendoc-meta-github" value="${esc(this.github)}" placeholder="https://github.com/...">
              </div>
            </div>

            <!-- Card 4: Content-Type Specific Contextual Settings -->
            ${this.renderContextualPropertiesCard()}

            <!-- Card 5: Danger Zone (Delete Item if Existing) -->
            ${!this.isNew ? `
            <div class="doc-condensed-card" style="border-color:#ffcccc;background:#fffafa">
              <h4 class="doc-condensed-card-title" style="color:#ef321f">05 / DANGER ZONE</h4>
              <p style="font:11px/1.3 var(--mono);color:#777;margin:0 0 10px">Permanently delete this document or send it to recycle bin.</p>
              <button type="button" class="admin-btn admin-btn-danger" id="zendoc-delete-btn" style="width:100%;justify-content:center;padding:8px">
                DELETE ${esc(typeLabel)} ✕
              </button>
            </div>
            ` : ""}

            <button type="button" class="admin-btn primary" id="zendoc-drawer-done-btn" style="width:100%;justify-content:center;margin-top:8px">
              DONE (SAVE PROPERTIES) <b>→</b>
            </button>
          </div>
        </aside>

        <!-- Calm Document Sheet Footer -->
        <div class="doc-bottom-bar">
          <div class="doc-bottom-left">
            <span class="doc-stats-pill" id="zendoc-doc-stats">DOCUMENT READY</span>
          </div>
          <div class="doc-bottom-right">
            ${!this.isNew ? `
            <button type="button" class="admin-btn admin-btn-danger" id="zendoc-bottom-delete-btn" style="font-size:10px;padding:6px 14px" title="Delete document">
              DELETE ${esc(typeLabel)} ✕
            </button>
            ` : ""}
          </div>
        </div>
      `;
    }

    renderContextualPropertiesCard() {
      const type = this.type;
      const projects = (window.__adminState?.content?.projects || []).map(p => ({ slug: p.slug, title: p.title }));

      if (type === "project") {
        const artOptions = [
          { val: "dots", lbl: "01 — ORBITAL DOTS / CONSTELLATION" },
          { val: "architecture", lbl: "02 — SYSTEM MESH / ARCHITECTURE" },
          { val: "chart", lbl: "03 — TREND LINE / ANALYTICAL CHART" },
          { val: "bars", lbl: "04 — SPECTRAL BARS / FREQUENCY" },
          { val: "scatter", lbl: "05 — CORRELATION CLUSTER / SCATTER" },
          { val: "waves", lbl: "06 — SINE WAVES / HARMONIC DYNAMICS" },
          { val: "matrix", lbl: "07 — NEURAL MATRIX / BINARY FIELD" },
          { val: "geometric", lbl: "08 — VORONOI MESH / GEOMETRIC" },
          { val: "circuit", lbl: "09 — QUANTUM CIRCUIT / LOGIC NODES" },
          { val: "radial", lbl: "10 — RADIAL BURST / PHASOR VECTOR" },
          { val: "heatmap", lbl: "11 — DENSITY MATRIX / HEATMAP" },
          { val: "custom", lbl: "12 — CUSTOM IMAGE / UPLOADED ARTWORK ↗" }
        ];

        return `
          <div class="doc-condensed-card">
            <h4 class="doc-condensed-card-title">04 / PROJECT SETTINGS & VISUALIZATION</h4>
            <div class="doc-condensed-field">
              <label>ART VISUALIZATION STYLE</label>
              <select id="zendoc-meta-art">
                ${artOptions.map(o => `<option value="${o.val}" ${this.art === o.val ? "selected" : ""}>${esc(o.lbl)}</option>`).join("")}
              </select>
            </div>
            <div class="doc-condensed-field">
              <label>CUSTOM ART IMAGE/SVG PATH</label>
              <div style="display:flex;gap:6px">
                <input type="text" id="zendoc-meta-customArt" value="${esc(this.customArt)}" placeholder="/assets/images/projects/..." style="flex:1">
                <button type="button" class="admin-btn" id="zendoc-pick-customart-btn" style="padding:4px 8px;font-size:10px">CHOOSE ↗</button>
              </div>
            </div>
            <div class="doc-condensed-field">
              <label>ART CAPTION / LABEL</label>
              <input type="text" id="zendoc-meta-artLabel" value="${esc(this.artLabel)}" placeholder="e.g. FIG 01.1 — SYSTEM TOPOLOGY">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div class="doc-condensed-field">
                <label>PROJECT NUMBER</label>
                <input type="text" id="zendoc-meta-number" value="${esc(this.number)}" placeholder="01">
              </div>
              <div class="doc-condensed-field">
                <label>YEAR</label>
                <input type="text" id="zendoc-meta-year" value="${esc(this.year)}" placeholder="2026">
              </div>
            </div>
            <div class="doc-condensed-field">
              <label>HEADLINE (ONE PER BREAK)</label>
              <textarea id="zendoc-meta-headline" rows="2">${esc(this.headline)}</textarea>
            </div>
            <div class="doc-condensed-field">
              <label>SUMMARY / ABSTRACT</label>
              <textarea id="zendoc-meta-summary" rows="3">${esc(this.summary)}</textarea>
            </div>
          </div>
        `;
      }

      if (type === "blog") {
        return `
          <div class="doc-condensed-card">
            <h4 class="doc-condensed-card-title">04 / ARTICLE RELATIONSHIPS & DISPLAY</h4>
            <div class="doc-condensed-field">
              <label>RELATED PROJECT</label>
              <select id="zendoc-meta-relatedProject">
                <option value="">NONE</option>
                ${projects.map(p => `<option value="${esc(p.slug)}" ${this.relatedProject === p.slug ? "selected" : ""}>${esc(p.title)}</option>`).join("")}
              </select>
            </div>
            <div class="doc-condensed-field">
              <label>HEADLINE (ONE PER BREAK)</label>
              <textarea id="zendoc-meta-headline" rows="2">${esc(this.headline)}</textarea>
            </div>
            <div class="doc-condensed-field">
              <label>DESCRIPTION / TEASER</label>
              <textarea id="zendoc-meta-desc" rows="3">${esc(this.description)}</textarea>
            </div>
          </div>
        `;
      }

      if (type === "journal") {
        return `
          <div class="doc-condensed-card">
            <h4 class="doc-condensed-card-title">04 / JOURNAL LOG PARAMETERS</h4>
            <div class="doc-condensed-field">
              <label>RELATED PROJECT</label>
              <select id="zendoc-meta-relatedProject">
                <option value="">NONE</option>
                ${projects.map(p => `<option value="${esc(p.slug)}" ${this.relatedProject === p.slug ? "selected" : ""}>${esc(p.title)}</option>`).join("")}
              </select>
            </div>
            <div class="doc-condensed-field">
              <label>HEADLINE</label>
              <textarea id="zendoc-meta-headline" rows="2">${esc(this.headline)}</textarea>
            </div>
            <div class="doc-condensed-field">
              <label>SUMMARY</label>
              <input type="text" id="zendoc-meta-summary" value="${esc(this.summary)}">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div class="doc-condensed-field">
                <label>DATA</label>
                <input type="text" id="zendoc-meta-data" value="${esc(this.data)}">
              </div>
              <div class="doc-condensed-field">
                <label>METHOD</label>
                <input type="text" id="zendoc-meta-method" value="${esc(this.method)}">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div class="doc-condensed-field">
                <label>RESULT</label>
                <input type="text" id="zendoc-meta-result" value="${esc(this.result)}">
              </div>
              <div class="doc-condensed-field">
                <label>TOOLS</label>
                <input type="text" id="zendoc-meta-tools" value="${esc(this.tools)}">
              </div>
            </div>
          </div>
        `;
      }

      if (type === "note") {
        return `
          <div class="doc-condensed-card">
            <h4 class="doc-condensed-card-title">04 / NOTE PROMOTIONS</h4>
            <p style="font:11px/1.4 var(--mono);color:#666;margin:0 0 10px">Promote this research note into a full draft:</p>
            <div style="display:flex;gap:8px;flex-direction:column">
              <button type="button" class="admin-btn" id="zendoc-promote-blog-btn" style="justify-content:center">PROMOTE TO BLOG ARTICLE <b>→</b></button>
              <button type="button" class="admin-btn" id="zendoc-promote-project-btn" style="justify-content:center">PROMOTE TO CASE STUDY <b>→</b></button>
            </div>
          </div>
        `;
      }

      return "";
    }

    bindEvents() {
      const shell = this.shell;

      // Sync Title (Top Input & Paper H1)
      const topTitle = shell.querySelector("#zendoc-top-title");
      const paperTitle = shell.querySelector("#zendoc-paper-title");

      topTitle?.addEventListener("input", () => {
        paperTitle.textContent = topTitle.value;
        this.title = topTitle.value;
        this.indicateUnsaved();
        this.syncBackToForm();
      });

      paperTitle?.addEventListener("input", () => {
        topTitle.value = paperTitle.textContent.trim();
        this.title = paperTitle.textContent.trim();
        this.indicateUnsaved();
        this.syncBackToForm();
      });

      // Document Title Size controls (SM, MD, LG, XL, [-], [+], Drawer Select)
      shell.querySelectorAll("[data-title-size]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.setTitleSize(btn.getAttribute("data-title-size"));
        });
      });

      const SIZES = ["sm", "md", "lg", "xl"];
      shell.querySelector("#zendoc-title-size-dec")?.addEventListener("click", () => {
        const cur = this.titleSize || "md";
        const idx = SIZES.indexOf(cur);
        if (idx > 0) this.setTitleSize(SIZES[idx - 1]);
      });

      shell.querySelector("#zendoc-title-size-inc")?.addEventListener("click", () => {
        const cur = this.titleSize || "md";
        const idx = SIZES.indexOf(cur);
        if (idx < SIZES.length - 1 && idx !== -1) this.setTitleSize(SIZES[idx + 1]);
      });

      const metaTitleSize = shell.querySelector("#zendoc-meta-title-size");
      metaTitleSize?.addEventListener("change", () => {
        this.setTitleSize(metaTitleSize.value);
      });

      // Page Width Mode Controls (Narrow, Standard, Wide, Full)
      shell.querySelectorAll("[data-doc-width]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.setPageWidth(btn.getAttribute("data-doc-width"));
        });
      });

      const metaPageWidth = shell.querySelector("#zendoc-meta-page-width");
      metaPageWidth?.addEventListener("change", () => {
        this.setPageWidth(metaPageWidth.value);
      });

      // Top Star Button (Featured toggle ⭐)
      const starBtn = shell.querySelector("#zendoc-star-btn");
      const featChk = shell.querySelector("#zendoc-meta-featured");

      starBtn?.addEventListener("click", () => {
        this.featured = !this.featured;
        starBtn.classList.toggle("starred", this.featured);
        starBtn.textContent = this.featured ? "★" : "☆";
        starBtn.title = this.featured ? "Featured on Homepage (Click to unstar)" : "Star as Featured on Homepage";
        if (featChk) featChk.checked = this.featured;
        this.indicateUnsaved();
        this.syncBackToForm();
      });

      featChk?.addEventListener("change", () => {
        this.featured = featChk.checked;
        if (starBtn) {
          starBtn.classList.toggle("starred", this.featured);
          starBtn.textContent = this.featured ? "★" : "☆";
          starBtn.title = this.featured ? "Featured on Homepage (Click to unstar)" : "Star as Featured on Homepage";
        }
      });

      // Status selector
      const statusSelect = shell.querySelector("#zendoc-status-select");
      statusSelect?.addEventListener("change", () => {
        this.published = statusSelect.value === "published";
        const chk = shell.querySelector("#zendoc-meta-published");
        if (chk) chk.checked = this.published;
        this.indicateUnsaved();
        this.syncBackToForm();
      });

      // Text Formatting Actions
      shell.querySelectorAll("[data-cmd]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cmd = btn.getAttribute("data-cmd");
          document.execCommand(cmd, false, null);
          this.indicateUnsaved();
          this.syncBackToForm();
        });
      });

      // Block Style selector (Paragraph, H1, H2, H3, Blockquote, Pre)
      const blockSelect = shell.querySelector("#zendoc-block-select");
      blockSelect?.addEventListener("change", () => {
        const val = blockSelect.value;
        document.execCommand("formatBlock", false, val);
        this.indicateUnsaved();
        this.syncBackToForm();
      });

      // Font Family Switcher
      const fontSelect = shell.querySelector("#zendoc-font-select");
      fontSelect?.addEventListener("change", () => {
        this.currentFontFamily = fontSelect.value;
        localStorage.setItem("admin_doc_fontfamily", this.currentFontFamily);
        this.updateFontSize();
      });

      // Text Size Stepper: [-] and [+]
      shell.querySelector("#zendoc-font-dec")?.addEventListener("click", () => {
        if (this.currentFontSize > 11) {
          this.currentFontSize -= 1;
          this.updateFontSize();
        }
      });

      shell.querySelector("#zendoc-font-inc")?.addEventListener("click", () => {
        if (this.currentFontSize < 36) {
          this.currentFontSize += 1;
          this.updateFontSize();
        }
      });

      // Quick Size Presets: SM, MD, LG, XL
      shell.querySelectorAll(".doc-size-preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          shell.querySelectorAll(".doc-size-preset-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          this.currentFontSize = parseInt(btn.getAttribute("data-size"), 10);
          this.updateFontSize();
        });
      });

      // Interactive Color & Highlight Popover (Split Action)
      const colorApplyBtn = shell.querySelector("#zendoc-color-apply-btn");
      const colorBtn = shell.querySelector("#zendoc-color-btn");
      const colorPopover = shell.querySelector("#zendoc-color-popover");
      const activeSwatch = shell.querySelector("#zendoc-active-swatch");
      const customPicker = shell.querySelector("#zendoc-custom-forecolor");

      let currentActiveColor = "#ef321f";
      let savedSelectionRange = null;

      const saveSelection = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          if (shell.contains(r.commonAncestorContainer)) {
            savedSelectionRange = r.cloneRange();
          }
        }
      };

      const restoreSelection = () => {
        if (savedSelectionRange) {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedSelectionRange);
          return true;
        }
        return false;
      };

      // Keep selection up to date continuously
      document.addEventListener("selectionchange", () => {
        saveSelection();
      });

      // Split button part 1: Clicking [🟥 A] directly applies the active color
      colorApplyBtn?.addEventListener("mousedown", (e) => {
        e.preventDefault();
        saveSelection();
      });
      colorApplyBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        applyForeColor(currentActiveColor);
      });

      // Split button part 2: Clicking [▾] toggles the color & highlighter popover
      colorBtn?.addEventListener("mousedown", (e) => {
        e.preventDefault();
        saveSelection();
      });
      colorBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        colorPopover?.classList.toggle("open");
      });

      // Prevent popover clicks from clearing text selection
      colorPopover?.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });

      // Close popover when clicking outside
      document.addEventListener("click", (e) => {
        if (!e.target.closest("#zendoc-color-wrapper")) {
          colorPopover?.classList.remove("open");
        }
      });

      // Apply Foreground / Text Color
      const applyForeColor = (hex) => {
        currentActiveColor = hex;
        if (activeSwatch) activeSwatch.style.background = hex;

        restoreSelection();
        const sel = window.getSelection();
        const hasSelection = sel && !sel.isCollapsed && sel.toString().trim().length > 0;

        try {
          document.execCommand("foreColor", false, hex);
        } catch(err) {
          console.warn("Could not apply foreColor", err);
        }

        colorPopover?.classList.remove("open");

        if (!hasSelection) {
          // Friendly feedback if no text was highlighted
          const saveText = shell.querySelector("#zendoc-save-text");
          if (saveText) {
            const orig = saveText.textContent;
            saveText.textContent = "Highlight text to color";
            setTimeout(() => {
              if (saveText.textContent === "Highlight text to color") {
                saveText.textContent = orig;
              }
            }, 2500);
          }
        }

        this.indicateUnsaved();
        this.syncBackToForm();
      };

      shell.querySelectorAll("[data-forecolor]").forEach((btn) => {
        btn.addEventListener("click", () => {
          applyForeColor(btn.getAttribute("data-forecolor"));
        });
      });

      customPicker?.addEventListener("input", () => {
        applyForeColor(customPicker.value);
      });

      // Apply Background / Highlight Color
      const applyHighlightColor = (hex) => {
        restoreSelection();
        const sel = window.getSelection();
        const hasSelection = sel && !sel.isCollapsed && sel.toString().trim().length > 0;

        if (hex === "transparent") {
          try {
            document.execCommand("removeFormat", false, null);
          } catch(err) {}
        } else {
          try {
            document.execCommand("hiliteColor", false, hex);
          } catch(e) {
            try {
              document.execCommand("backColor", false, hex);
            } catch(err) {}
          }
        }
        colorPopover?.classList.remove("open");

        if (!hasSelection) {
          const saveText = shell.querySelector("#zendoc-save-text");
          if (saveText) {
            const orig = saveText.textContent;
            saveText.textContent = "Highlight text to highlight";
            setTimeout(() => {
              if (saveText.textContent === "Highlight text to highlight") {
                saveText.textContent = orig;
              }
            }, 2500);
          }
        }

        this.indicateUnsaved();
        this.syncBackToForm();
      };

      shell.querySelectorAll("[data-backcolor]").forEach((btn) => {
        btn.addEventListener("click", () => {
          applyHighlightColor(btn.getAttribute("data-backcolor"));
        });
      });

      // Rich Inserts: Table, Chart, Math
      shell.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const act = btn.getAttribute("data-act");
          if (act === "insert-table") {
            const tableHtml = `
              <div class="table-responsive">
                <table class="bauhaus-table" style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <thead>
                    <tr style="border-bottom:2px solid #111">
                      <th style="padding:8px;text-align:left">METRIC</th>
                      <th style="padding:8px;text-align:left">BASELINE</th>
                      <th style="padding:8px;text-align:left">OUTCOME</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom:1px solid #ddd">
                      <td style="padding:8px">Conversion Rate</td>
                      <td style="padding:8px">3.2%</td>
                      <td style="padding:8px;color:#ef321f;font-weight:700">+28.4%</td>
                    </tr>
                  </tbody>
                </table>
              </div><p></p>`;
            document.execCommand("insertHTML", false, tableHtml);
            this.indicateUnsaved();
            this.syncBackToForm();
          } else if (act === "insert-image") {
            const doInsert = (url, alt = "Image") => {
              if (!url) return;
              const figHtml = `<p></p><figure class="doc-image-figure" data-align="center" style="width:100%;text-align:center;margin:24px auto;" contenteditable="false"><div class="doc-image-wrap"><img src="${esc(url)}" alt="${esc(alt)}" style="width:100%;height:auto;display:inline-block;"><div class="doc-image-resize-handle handle-se" title="Drag to resize"></div><div class="doc-image-resize-handle handle-sw" title="Drag to resize"></div></div><figcaption class="doc-image-caption" contenteditable="true" placeholder="Click to add caption…"></figcaption></figure><p></p>`;
              document.execCommand("insertHTML", false, figHtml);
              this.indicateUnsaved();
              this.syncBackToForm();
            };
            if (typeof window.showMediaSelectModal === "function") {
              window.showMediaSelectModal((selectedPath) => doInsert(selectedPath));
            } else {
              const url = prompt("Enter image URL or asset path:", "/assets/images/...");
              if (url) doInsert(url);
            }
          } else if (act === "insert-math") {
            const math = prompt("Enter LaTeX Formula:", "\\sigma = \\sqrt{\\frac{1}{N} \\sum_{i=1}^N (x_i - \\mu)^2}");
            if (math) {
              document.execCommand("insertHTML", false, ` <code>$${esc(math)}$</code> `);
              this.indicateUnsaved();
              this.syncBackToForm();
            }
          } else if (act === "insert-chart") {
            const chartBtn = document.querySelector(".chart-btn");
            if (chartBtn) chartBtn.click();
            else alert("Chart Studio is ready in the main console.");
          }
        });
      });

      // ── Interactive Image Selection & Floating Controls ──
      const canvas = shell.querySelector("#zendoc-unified-canvas");
      let selectedFigure = null;

      const positionImageToolbar = () => {
        if (!selectedFigure || !this.imageToolbar) return;
        const rect = selectedFigure.getBoundingClientRect();
        let top = rect.top + window.scrollY - 44;
        if (top < window.scrollY + 60) {
          top = rect.top + window.scrollY + 10;
        }
        let left = rect.left + window.scrollX + (rect.width / 2);

        this.imageToolbar.style.top = `${top}px`;
        this.imageToolbar.style.left = `${left}px`;
        this.imageToolbar.classList.add("is-visible");

        const currentWidth = selectedFigure.style.width || "100%";
        const widthVal = this.imageToolbar.querySelector("#zendoc-img-width-val");
        if (widthVal) widthVal.textContent = currentWidth;

        this.imageToolbar.querySelectorAll("[data-set-size]").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-set-size") === currentWidth);
        });

        const currentAlign = selectedFigure.getAttribute("data-align") || "center";
        this.imageToolbar.querySelectorAll("[data-set-align]").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-set-align") === currentAlign);
        });
      };

      const deselectImage = () => {
        if (selectedFigure) {
          selectedFigure.classList.remove("is-selected");
          selectedFigure = null;
        }
        if (this.imageToolbar) {
          this.imageToolbar.classList.remove("is-visible");
        }
      };

      const selectImageFigure = (fig) => {
        if (selectedFigure && selectedFigure !== fig) {
          selectedFigure.classList.remove("is-selected");
        }
        selectedFigure = fig;
        selectedFigure.classList.add("is-selected");
        positionImageToolbar();
      };

      canvas?.addEventListener("click", (e) => {
        const img = e.target.closest("img");
        const fig = e.target.closest(".doc-image-figure");

        if (img) {
          e.stopPropagation();
          let targetFig = fig;
          if (!targetFig) {
            targetFig = document.createElement("figure");
            targetFig.className = "doc-image-figure";
            targetFig.dataset.align = "center";
            targetFig.style.width = "100%";
            targetFig.style.textAlign = "center";
            targetFig.style.margin = "24px auto";
            targetFig.contentEditable = "false";

            const wrap = document.createElement("div");
            wrap.className = "doc-image-wrap";
            img.parentNode.insertBefore(targetFig, img);
            wrap.appendChild(img);

            const hSe = document.createElement("div");
            hSe.className = "doc-image-resize-handle handle-se";
            hSe.title = "Drag to resize";
            const hSw = document.createElement("div");
            hSw.className = "doc-image-resize-handle handle-sw";
            hSw.title = "Drag to resize";
            wrap.appendChild(hSe);
            wrap.appendChild(hSw);

            const figcap = document.createElement("figcaption");
            figcap.className = "doc-image-caption";
            figcap.contentEditable = "true";
            figcap.placeholder = "Click to add caption…";

            targetFig.appendChild(wrap);
            targetFig.appendChild(figcap);
          }
          selectImageFigure(targetFig);
          return;
        }

        if (fig && !e.target.closest(".doc-image-caption")) {
          e.stopPropagation();
          selectImageFigure(fig);
          return;
        }

        if (!e.target.closest("#zendoc-image-floating-bar")) {
          deselectImage();
        }
      });

      // Floating toolbar actions
      this.imageToolbar?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!selectedFigure) return;
        const img = selectedFigure.querySelector("img");

        // 1. Preset size
        const sizeBtn = e.target.closest("[data-set-size]");
        if (sizeBtn) {
          const size = sizeBtn.getAttribute("data-set-size");
          selectedFigure.style.width = size;
          positionImageToolbar();
          this.indicateUnsaved();
          this.syncBackToForm();
          return;
        }

        // 2. Stepper size
        const act = e.target.closest("[data-img-act]")?.getAttribute("data-img-act");
        if (act === "size-dec" || act === "size-inc") {
          let curr = parseInt(selectedFigure.style.width || "100", 10);
          if (isNaN(curr)) curr = 100;
          curr = act === "size-dec" ? Math.max(15, curr - 5) : Math.min(100, curr + 5);
          selectedFigure.style.width = `${curr}%`;
          positionImageToolbar();
          this.indicateUnsaved();
          this.syncBackToForm();
          return;
        }

        // 3. Align
        const alignBtn = e.target.closest("[data-set-align]");
        if (alignBtn) {
          const align = alignBtn.getAttribute("data-set-align");
          selectedFigure.setAttribute("data-align", align);
          selectedFigure.style.textAlign = align;
          if (align === "left") selectedFigure.style.margin = "24px auto 24px 0";
          else if (align === "right") selectedFigure.style.margin = "24px 0 24px auto";
          else selectedFigure.style.margin = "24px auto";
          positionImageToolbar();
          this.indicateUnsaved();
          this.syncBackToForm();
          return;
        }

        // 4. Caption
        if (act === "caption") {
          let captionEl = selectedFigure.querySelector(".doc-image-caption");
          if (!captionEl) {
            captionEl = document.createElement("figcaption");
            captionEl.className = "doc-image-caption";
            captionEl.contentEditable = "true";
            captionEl.placeholder = "Click to add caption…";
            selectedFigure.appendChild(captionEl);
          }
          captionEl.focus();
          return;
        }

        // 5. Replace image
        if (act === "replace") {
          const doReplace = (newUrl) => {
            if (newUrl && img) {
              img.src = newUrl;
              positionImageToolbar();
              this.indicateUnsaved();
              this.syncBackToForm();
            }
          };
          if (typeof window.showMediaSelectModal === "function") {
            window.showMediaSelectModal((selectedPath) => doReplace(selectedPath));
          } else {
            const url = prompt("Enter new image URL or asset path:", img?.src || "");
            if (url) doReplace(url);
          }
          return;
        }

        // 6. Alt text
        if (act === "alt") {
          const currentAlt = img?.alt || "";
          const newAlt = prompt("Enter image alt text (for accessibility):", currentAlt);
          if (newAlt !== null && img) {
            img.alt = newAlt;
            this.indicateUnsaved();
            this.syncBackToForm();
          }
          return;
        }

        // 7. Delete
        if (act === "delete") {
          selectedFigure.remove();
          deselectImage();
          this.indicateUnsaved();
          this.syncBackToForm();
          return;
        }
      });

      // Corner Drag-to-Resize Handle
      canvas?.addEventListener("mousedown", (e) => {
        const handle = e.target.closest(".doc-image-resize-handle");
        if (!handle || !selectedFigure) return;
        e.preventDefault();
        e.stopPropagation();

        const isEast = handle.classList.contains("handle-se");
        const startX = e.clientX;
        const startWidth = selectedFigure.offsetWidth;
        const canvasWidth = canvas.offsetWidth || 860;

        const onMouseMove = (ev) => {
          const deltaX = isEast ? (ev.clientX - startX) : (startX - ev.clientX);
          const newPx = Math.max(120, Math.min(canvasWidth, startWidth + deltaX * 2));
          const newPct = Math.round((newPx / canvasWidth) * 100);
          selectedFigure.style.width = `${Math.min(100, Math.max(15, newPct))}%`;
          positionImageToolbar();
        };

        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          this.indicateUnsaved();
          this.syncBackToForm();
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      // Window events for toolbar repositioning & dismissal
      window.addEventListener("scroll", positionImageToolbar, { passive: true });
      window.addEventListener("resize", positionImageToolbar, { passive: true });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && selectedFigure) {
          deselectImage();
        }
        if ((e.key === "Delete" || e.key === "Backspace") && selectedFigure && !e.target.closest(".doc-image-caption") && !e.target.closest("input, textarea")) {
          selectedFigure.remove();
          deselectImage();
          this.indicateUnsaved();
          this.syncBackToForm();
        }
      });

      // Continuous Canvas Input Event
      // (canvas already declared above)
      canvas?.addEventListener("input", () => {
        this.indicateUnsaved();
        this.syncBackToForm();
        this.refreshSectionOutline();
      });

      // ── Section Functionality in Toolbar (Zendoc Style) ──
      const addSecBtn = shell.querySelector("#zendoc-toolbar-add-sec");
      const jumpSelect = shell.querySelector("#zendoc-toolbar-section-jump");

      this.refreshSectionOutline = () => {
        if (!jumpSelect || !canvas) return;
        const headings = canvas.querySelectorAll("h2, h3");
        let optionsHtml = '<option value="">§ Sections (Outline) ▾</option>';
        headings.forEach((h, idx) => {
          if (!h.id) h.id = `doc-sec-node-${idx + 1}`;
          const title = h.textContent.trim().replace(/\s+/g, " ") || `Section 0${idx + 1}`;
          optionsHtml += `<option value="${h.id}">${idx + 1}. ${esc(title.slice(0, 32))}</option>`;
        });
        jumpSelect.innerHTML = optionsHtml;
      };

      this.insertSection = (headingText) => {
        if (!canvas) return;
        const currentCount = canvas.querySelectorAll("h2").length;
        const numStr = `0${currentCount + 1}`;
        const finalTitle = headingText || `${numStr} / NEW EDITORIAL SECTION`;
        const secId = `doc-sec-node-${Date.now()}`;

        const sectionHtml = `
          <h2 id="${secId}" style="margin:28px 0 10px;padding-top:16px;border-top:1px dashed #dcd8cc">${esc(finalTitle)}</h2>
          <p>Write your section narrative here…</p>
        `;

        // If selection is inside canvas, insert at selection; otherwise append
        const sel = window.getSelection();
        let inserted = false;
        if (sel && sel.rangeCount > 0 && canvas.contains(sel.anchorNode)) {
          try {
            document.execCommand("insertHTML", false, sectionHtml);
            inserted = true;
          } catch(e) {}
        }
        if (!inserted) {
          canvas.insertAdjacentHTML("beforeend", sectionHtml);
        }

        this.refreshSectionOutline();
        this.indicateUnsaved();
        this.syncBackToForm();

        // Scroll to newly added section
        const newEl = canvas.querySelector(`#${secId}`) || canvas.lastElementChild;
        if (newEl) {
          newEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };

      addSecBtn?.addEventListener("click", () => {
        const title = prompt("Enter Section Title (e.g. THE CHALLENGE, RESULTS):", "");
        this.insertSection(title ? title.toUpperCase() : "");
      });

      jumpSelect?.addEventListener("change", () => {
        const targetId = jumpSelect.value;
        if (!targetId || !canvas) return;
        const targetEl = canvas.querySelector(`#${targetId}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
          targetEl.focus();
        }
      });

      // Insert suggested sections from drawer (Zendoc Style)
      shell.querySelectorAll("[data-insert-suggest]").forEach((pill) => {
        pill.addEventListener("click", () => {
          const suggestText = pill.getAttribute("data-insert-suggest");
          this.insertSection(suggestText);
          closeDrawer();
        });
      });

      // Initial outline population
      setTimeout(() => this.refreshSectionOutline(), 50);

      // Slide-Over Metadata Drawer Toggle
      const drawer = shell.querySelector("#zendoc-drawer-panel");
      const backdrop = shell.querySelector("#zendoc-drawer-backdrop");
      const openBtn = shell.querySelector("#zendoc-open-drawer-btn");
      const closeBtn = shell.querySelector("#zendoc-drawer-close-btn");
      const doneBtn = shell.querySelector("#zendoc-drawer-done-btn");

      const openDrawer = () => {
        drawer.classList.add("open");
        backdrop.classList.add("open");
      };
      const closeDrawer = () => {
        drawer.classList.remove("open");
        backdrop.classList.remove("open");
      };

      openBtn?.addEventListener("click", openDrawer);
      closeBtn?.addEventListener("click", closeDrawer);
      doneBtn?.addEventListener("click", closeDrawer);
      backdrop?.addEventListener("click", closeDrawer);

      // Metadata inputs binding
      const bind = (id, prop, isCheckbox = false) => {
        const el = shell.querySelector(`#${id}`);
        el?.addEventListener("input", () => {
          this[prop] = isCheckbox ? el.checked : el.value;
          this.indicateUnsaved();
          this.syncBackToForm();
        });
      };
      bind("zendoc-meta-published", "published", true);
      bind("zendoc-meta-featured", "featured", true);
      bind("zendoc-meta-category", "category");
      bind("zendoc-meta-date", "date");
      bind("zendoc-meta-slug", "slug");
      bind("zendoc-meta-tech", "technologies");
      bind("zendoc-meta-cover", "cover");
      bind("zendoc-meta-live", "live");
      bind("zendoc-meta-github", "github");

      // Contextual inputs binding
      bind("zendoc-meta-art", "art");
      bind("zendoc-meta-customArt", "customArt");
      bind("zendoc-meta-artLabel", "artLabel");
      bind("zendoc-meta-number", "number");
      bind("zendoc-meta-year", "year");
      bind("zendoc-meta-headline", "headline");
      bind("zendoc-meta-summary", "summary");
      bind("zendoc-meta-desc", "description");
      bind("zendoc-meta-relatedProject", "relatedProject");
      bind("zendoc-meta-data", "data");
      bind("zendoc-meta-method", "method");
      bind("zendoc-meta-result", "result");
      bind("zendoc-meta-tools", "tools");

      // Cover Picker Button Trigger
      shell.querySelector("#zendoc-pick-cover-btn")?.addEventListener("click", () => {
        const pickBtn = this.formEl.querySelector('[data-act="pick-cover"]');
        if (pickBtn) {
          pickBtn.click();
          const coverIn = this.formEl.querySelector('[name="cover"]');
          const checkInt = setInterval(() => {
            if (coverIn && coverIn.value !== this.cover) {
              this.cover = coverIn.value;
              const drawerCover = shell.querySelector("#zendoc-meta-cover");
              if (drawerCover) drawerCover.value = this.cover;
              this.indicateUnsaved();
              clearInterval(checkInt);
            }
          }, 350);
          setTimeout(() => clearInterval(checkInt), 45000);
        }
      });

      // Custom Art Picker Button Trigger
      shell.querySelector("#zendoc-pick-customart-btn")?.addEventListener("click", () => {
        const pickBtn = this.formEl.querySelector('[data-act="pick-custom-art"]');
        if (pickBtn) {
          pickBtn.click();
          const artIn = this.formEl.querySelector('[name="customArt"]');
          const checkInt = setInterval(() => {
            if (artIn && artIn.value !== this.customArt) {
              this.customArt = artIn.value;
              const drawerArt = shell.querySelector("#zendoc-meta-customArt");
              if (drawerArt) drawerArt.value = this.customArt;
              this.indicateUnsaved();
              clearInterval(checkInt);
            }
          }, 350);
          setTimeout(() => clearInterval(checkInt), 45000);
        }
      });

      // Delete Buttons Trigger (Drawer & Bottom Bar)
      const triggerDelete = () => {
        const delBtn = this.formEl.querySelector('[data-act^="delete-"]');
        if (delBtn) delBtn.click();
      };
      shell.querySelector("#zendoc-delete-btn")?.addEventListener("click", triggerDelete);
      shell.querySelector("#zendoc-bottom-delete-btn")?.addEventListener("click", triggerDelete);

      // Promote Note Buttons
      shell.querySelector("#zendoc-promote-blog-btn")?.addEventListener("click", () => {
        const btn = this.formEl.querySelector('[data-act="promote-note"][data-target="blog"]');
        if (btn) btn.click();
      });
      shell.querySelector("#zendoc-promote-project-btn")?.addEventListener("click", () => {
        const btn = this.formEl.querySelector('[data-act="promote-note"][data-target="project"]');
        if (btn) btn.click();
      });

      // Page Width Selectors (Toolbar & Drawer)
      const toolbarWidth = shell.querySelector("#zendoc-toolbar-width-select");
      toolbarWidth?.addEventListener("change", (e) => {
        this.setPageWidth(e.target.value);
      });
      const drawerWidth = shell.querySelector("#zendoc-meta-page-width");
      drawerWidth?.addEventListener("change", (e) => {
        this.setPageWidth(e.target.value);
      });

      // Word count & reading time stats
      const canvasEl = shell.querySelector("#zendoc-unified-canvas");
      const updateStats = () => {
        const text = (canvasEl?.textContent || "").trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        const readTime = Math.max(1, Math.ceil(words / 200));
        const statsEl = shell.querySelector("#zendoc-doc-stats");
        if (statsEl) {
          statsEl.textContent = `${words.toLocaleString()} words · ~${readTime} min read`;
        }
      };
      canvasEl?.addEventListener("input", updateStats);
      setTimeout(updateStats, 80);

      // Preview Button (Top Header)
      const triggerPreview = () => {
        this.syncBackToForm();
        if (typeof window.triggerEditorPreview === "function") {
          window.triggerEditorPreview(this.formEl);
        }
      };
      shell.querySelector("#zendoc-top-preview-btn")?.addEventListener("click", triggerPreview);

      // Save Draft & Publish (Top Header)
      shell.querySelector("#zendoc-save-draft-btn")?.addEventListener("click", () => {
        this.syncBackToForm();
        const submitBtn = this.formEl.querySelector('button[type="submit"][data-publish="false"]')
          || this.formEl.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
        } else {
          this.formEl.dataset.nextPublish = "false";
          this.formEl.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
      });

      shell.querySelector("#zendoc-publish-btn")?.addEventListener("click", () => {
        this.syncBackToForm();
        const submitBtn = this.formEl.querySelector('button[type="submit"][data-publish="true"]');
        if (submitBtn) {
          submitBtn.click();
        } else {
          this.formEl.dataset.nextPublish = "true";
          this.formEl.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
      });
    }

    updateFontSize() {
      localStorage.setItem("admin_doc_fontsize", this.currentFontSize);
      const canvas = this.shell.querySelector("#zendoc-unified-canvas");
      const display = this.shell.querySelector("#zendoc-size-display");
      if (canvas) {
        canvas.style.setProperty("--doc-font-size", `${this.currentFontSize}px`);
        canvas.style.setProperty("--doc-font-family", this.currentFontFamily);
      }
      if (display) {
        display.textContent = `${this.currentFontSize}px`;
      }
      this.shell.querySelectorAll(".doc-size-preset-btn").forEach((b) => {
        b.classList.toggle("active", parseInt(b.getAttribute("data-size"), 10) === this.currentFontSize);
      });
    }

    setTitleSize(size) {
      this.titleSize = size || "md";
      this.updateTitleSize();
      this.indicateUnsaved();
      this.syncBackToForm();
    }

    updateTitleSize() {
      const paperTitle = this.shell.querySelector("#zendoc-paper-title");
      const display = this.shell.querySelector("#zendoc-title-size-display");
      const drawerSelect = this.shell.querySelector("#zendoc-meta-title-size");

      const sizeMap = {
        sm: "clamp(20px, 2.8vw, 28px)",
        md: "clamp(26px, 3.8vw, 38px)",
        lg: "clamp(34px, 5.2vw, 52px)",
        xl: "clamp(44px, 6.8vw, 68px)"
      };

      if (paperTitle) {
        paperTitle.classList.remove("title-size-sm", "title-size-md", "title-size-lg", "title-size-xl");
        paperTitle.classList.add(`title-size-${this.titleSize || "md"}`);
        const fSize = sizeMap[this.titleSize] || sizeMap.md;
        paperTitle.style.setProperty("font-size", fSize, "important");
      }
      if (display) {
        display.textContent = (this.titleSize || "MD").toUpperCase();
      }
      if (drawerSelect) {
        drawerSelect.value = this.titleSize || "md";
      }
      this.shell.querySelectorAll("[data-title-size]").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-title-size") === (this.titleSize || "md"));
      });
    }

    indicateUnsaved() {
      const dot = this.shell.querySelector("#zendoc-save-dot");
      const txt = this.shell.querySelector("#zendoc-save-text");
      if (dot) dot.classList.add("unsaved");
      if (txt) txt.textContent = "Unsaved changes";
    }

    syncBackToForm() {
      // 1. Sync Title
      const titleIn = this.formEl.querySelector('[name="title"]');
      if (titleIn) titleIn.value = this.title;

      // 2. Sync Metadata fields
      const setFormVal = (name, val, isCheckbox = false) => {
        const el = this.formEl.querySelector(`[name="${name}"]`);
        if (el) {
          if (isCheckbox) el.checked = Boolean(val);
          else el.value = val ?? "";
        }
      };

      setFormVal("published", this.published, true);
      setFormVal("featured", this.featured, true);
      setFormVal("category", this.category);
      setFormVal("date", this.date);
      setFormVal("slug", this.slug);
      setFormVal("technologies", this.technologies);
      setFormVal("tags", this.technologies);
      setFormVal("cover", this.cover);
      setFormVal("live", this.live);
      setFormVal("github", this.github);
      setFormVal("headline", this.headline);
      setFormVal("summary", this.summary);
      setFormVal("description", this.description);
      setFormVal("number", this.number);
      setFormVal("year", this.year);
      setFormVal("art", this.art);
      setFormVal("customArt", this.customArt);
      setFormVal("artLabel", this.artLabel);
      setFormVal("relatedProject", this.relatedProject);
      setFormVal("project", this.relatedProject);
      setFormVal("data", this.data);
      setFormVal("method", this.method);
      setFormVal("result", this.result);
      setFormVal("tools", this.tools);
      setFormVal("titleSize", this.titleSize || "md");
      let titleSizeHidden = this.formEl.querySelector('[name="titleSize"]');
      if (!titleSizeHidden) {
        titleSizeHidden = document.createElement("input");
        titleSizeHidden.type = "hidden";
        titleSizeHidden.name = "titleSize";
        this.formEl.appendChild(titleSizeHidden);
      }
      titleSizeHidden.value = this.titleSize || "md";

      // 3. Convert unified document canvas HTML to Markdown
      const canvas = this.shell.querySelector("#zendoc-unified-canvas");
      const fullMd = htmlToMd(canvas).trim();

      // Parse headings into sections
      const sections = [];
      const blocks = fullMd.split(/(?=^##\s+)/m);
      blocks.forEach((block, idx) => {
        block = block.trim();
        if (!block) return;
        if (block.startsWith("##")) {
          const firstLineEnd = block.indexOf("\n");
          const headingLine = (firstLineEnd !== -1 ? block.slice(2, firstLineEnd) : block.slice(2)).trim();
          const body = (firstLineEnd !== -1 ? block.slice(firstLineEnd) : "").trim();
          
          let label = `0${idx + 1} / SECTION`;
          let heading = headingLine;
          
          const slashMatch = headingLine.match(/^(\d{2}\s*\/[^:\n—\-]+)(?:[:—\-]\s*(.*))?$/i);
          if (slashMatch) {
            label = slashMatch[1].trim();
            heading = (slashMatch[2] || slashMatch[1]).trim();
          }
          sections.push({ label, heading, body });
        } else {
          sections.push({
            label: `0${idx + 1} / OVERVIEW`,
            heading: "OVERVIEW",
            body: block
          });
        }
      });

      if (sections.length === 0 && fullMd) {
        sections.push({ label: "01 / SECTION", heading: "MAIN CONTENT", body: fullMd });
      }

      // Update .section-card elements in formEl
      const originalCards = this.formEl.querySelectorAll(".section-card");
      const cardsList = this.formEl.querySelector("#sections-list-container") || this.formEl.querySelector(".sections-list-container");

      sections.forEach((sec, i) => {
        if (originalCards[i]) {
          const card = originalCards[i];
          const h = card.querySelector(".section-heading-input");
          const l = card.querySelector(".section-label-input");
          const s = card.querySelector(".wysiwyg-source");
          const e = card.querySelector(".wysiwyg-editable");
          if (h) h.value = sec.heading;
          if (l) l.value = sec.label;
          if (s) s.value = sec.body;
          if (e) e.innerHTML = mdToHtml(sec.body);
        } else if (cardsList) {
          if (typeof window.renderAdminSectionHtml === "function") {
            const html = window.renderAdminSectionHtml(sec, i);
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html.trim();
            const newCard = tempDiv.firstElementChild;
            if (newCard) cardsList.appendChild(newCard);
          } else {
            const tempDiv = document.createElement("div");
            tempDiv.className = "section-card";
            tempDiv.setAttribute("data-section-index", i);
            tempDiv.innerHTML = `
              <input type="text" class="section-label-input" name="section-label" value="${esc(sec.label)}">
              <input type="text" class="section-heading-input" name="section-heading" value="${esc(sec.heading)}">
              <div class="wysiwyg-wrapper">
                <div class="wysiwyg-editable" contenteditable="true">${mdToHtml(sec.body)}</div>
                <textarea class="wysiwyg-source" name="section-body">${esc(sec.body)}</textarea>
              </div>
            `;
            cardsList.appendChild(tempDiv);
          }
        }
      });

      // Remove excess cards
      if (originalCards.length > sections.length) {
        for (let j = sections.length; j < originalCards.length; j++) {
          originalCards[j].remove();
        }
      }

      if (cardsList && typeof window.reindexAdminSections === "function") {
        window.reindexAdminSections(cardsList);
      }

      // Sync description
      const descEl = this.formEl.querySelector('[name="description"]');
      if (descEl && !descEl.value && sections[0]) {
        descEl.value = sections[0].body.slice(0, 240);
      }

      // Mark clean status
      const dot = this.shell.querySelector("#zendoc-save-dot");
      const txt = this.shell.querySelector("#zendoc-save-text");
      if (dot) dot.classList.remove("unsaved");
      if (txt) txt.textContent = "Auto-synced";
    }

    setPageWidth(width) {
      this.pageWidth = width || "standard";
      this.updatePageWidth();
    }

    updatePageWidth() {
      const width = this.pageWidth || "standard";
      localStorage.setItem("admin_doc_pagewidth", width);
      const sheet = this.shell?.querySelector("#zendoc-paper-sheet");
      if (sheet) {
        sheet.classList.remove("width-narrow", "width-standard", "width-wide", "width-full");
        sheet.classList.add(`width-${width}`);
      }
      const toolbarSelect = this.shell?.querySelector("#zendoc-toolbar-width-select");
      if (toolbarSelect) toolbarSelect.value = width;
      const drawerSelect = this.shell?.querySelector("#zendoc-meta-page-width");
      if (drawerSelect) drawerSelect.value = width;
    }

    destroy() {
      if (this.imageToolbar) {
        this.imageToolbar.remove();
        this.imageToolbar = null;
      }
      if (this.shell) {
        this.shell.remove();
        this.shell = null;
      }
      this.formEl.style.display = "";
      document.body.classList.remove("mode-zendoc-active");
      const classicBar = document.querySelector(".admin-sticky-bar");
      if (classicBar) classicBar.style.display = "";
    }
  }

  // Global Zendoc Controller — Unified Primary Document Editor
  window.ZendocController = {
    mount() {
      const formEl = document.querySelector('form[data-form="project"], form[data-form="blog"], form[data-form="journal"], form[data-form="note"]');
      if (!formEl) {
        if (currentDocEditor) {
          currentDocEditor.destroy();
          currentDocEditor = null;
        }
        return;
      }
      if (currentDocEditor) {
        if (currentDocEditor.formEl !== formEl || !document.getElementById("zendoc-editor-instance")) {
          currentDocEditor.destroy();
          currentDocEditor = null;
        }
      }
      if (!currentDocEditor) {
        currentDocEditor = new ZendocDocumentEditor(formEl);
      }
    },
    initABToggle() {
      this.mount();
    }
  };

  // Auto-mount on DOM ready, route changes, and dynamic DOM mutations
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.ZendocController.mount());
  } else {
    window.ZendocController.mount();
  }

  window.addEventListener("hashchange", () => {
    if (currentDocEditor) {
      currentDocEditor.destroy();
      currentDocEditor = null;
    }
    setTimeout(() => window.ZendocController.mount(), 30);
  });

  // Dynamic observer ensures Zendoc mounts the instant any form is injected
  if (typeof MutationObserver !== "undefined") {
    const docObserver = new MutationObserver(() => {
      const formEl = document.querySelector('form[data-form="project"], form[data-form="blog"], form[data-form="journal"], form[data-form="note"]');
      if (formEl && (!currentDocEditor || currentDocEditor.formEl !== formEl || !document.getElementById("zendoc-editor-instance"))) {
        window.ZendocController.mount();
      }
    });
    docObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
