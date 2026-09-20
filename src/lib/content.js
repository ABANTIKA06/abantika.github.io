const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const yaml = require("js-yaml");
const MarkdownIt = require("markdown-it");

const ROOT = path.join(__dirname, "..", "..");
const CONTENT = path.join(ROOT, "content");

const REQUIRED = {
  project: ["title", "slug", "description", "date", "category", "technologies", "published"],
  blog: ["title", "slug", "description", "date", "published"],
  journal: ["date", "title", "published"],
  note: ["title", "date"]
};

const katex = require("katex");

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  let href = tokens[idx].attrGet("href") || "";
  if (/^\s*javascript:/i.test(href) || /^\s*data:/i.test(href)) {
    tokens[idx].attrSet("href", "#");
  } else {
    if (/^(www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(href) && !/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href)) {
      href = `https://${href}`;
      tokens[idx].attrSet("href", href);
    }
    if (/^https?:/i.test(href)) {
      tokens[idx].attrSet("rel", "noopener noreferrer");
      tokens[idx].attrSet("target", "_blank");
    }
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const defaultImage =
  md.renderer.rules.image ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  let src = tokens[idx].attrGet("src") || "";
  if (/^\s*javascript:/i.test(src) || /^\s*data:text\/html/i.test(src)) {
    tokens[idx].attrSet("src", "");
  }
  return defaultImage(tokens, idx, options, env, self);
};

function renderLatexMath(text) {
  if (!text || typeof text !== "string") return "";

  // 1. Process block math $$ ... $$ or \[ ... \]
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr) => {
    try {
      return `<div class="katex-block-container">${katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return match;
    }
  }).replace(/\\\[([\s\S]+?)\\\]/g, (match, expr) => {
    try {
      return `<div class="katex-block-container">${katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return match;
    }
  });

  // 2. Process inline math $ ... $ or \( ... \)
  processed = processed.replace(/(^|[^\\$])\$([^\$\n]+?)\$/g, (match, prefix, expr) => {
    if (/^\d+(\.\d+)?$/.test(expr.trim())) return match;
    try {
      const html = katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
      return `${prefix}<span class="katex-inline-container">${html}</span>`;
    } catch (e) {
      return match;
    }
  }).replace(/\\\(([\s\S]+?)\\\)/g, (match, expr) => {
    try {
      const html = katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
      return `<span class="katex-inline-container">${html}</span>`;
    } catch (e) {
      return match;
    }
  });

  return processed;
}

function renderMarkdown(value) {
  if (!value) return "";
  const mathProcessed = renderLatexMath(String(value));
  return md.render(mathProcessed);
}

function renderWikilinks(htmlOrMd, contentMap = new Map()) {
  if (!htmlOrMd) return "";
  return String(htmlOrMd).replace(/\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]/g, (match, target, alias) => {
    const rawTarget = target.trim();
    const label = (alias || rawTarget).trim();
    const key = rawTarget.toLowerCase();
    const found = contentMap.get(key);
    if (found && found.url && (found.published !== false)) {
      return `<a href="${found.url}" class="wikilink" title="${found.title}">${label}</a>`;
    }
    return `<span class="wikilink-unresolved" title="Unresolved link: ${rawTarget}">${label}</span>`;
  });
}

function fail(file, message) {
  throw new Error(`Content validation failed in ${file}: ${message}`);
}

function requireFields(data, fields, file) {
  fields.forEach((field) => {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      fail(file, `missing required field "${field}"`);
    }
  });
}

function toDate(value, file) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [year, month, day] = raw.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(file, `invalid date "${value}"`);
  return date;
}

function dateParts(date) {
  const iso = date.toISOString().slice(0, 10);
  const [year, month, day] = iso.split("-");
  return { iso, year, month, day };
}

function parseJournalSections(markdown) {
  const sections = { did: "", learned: "", next: "" };
  String(markdown || "")
    .split(/(?=^##\s+)/m)
    .forEach((block) => {
      const match = block.match(/^##\s+([^\n]+)\n?([\s\S]*)$/);
      if (!match) return;
      const heading = match[1].trim().toLowerCase();
      const body = match[2].trim();
      if (heading.startsWith("what i did")) sections.did = body;
      else if (heading.startsWith("what i learned")) sections.learned = body;
      else if (heading === "next" || heading.startsWith("next ")) sections.next = body;
    });
  return {
    ...sections,
    didHtml: renderMarkdown(sections.did),
    learnedHtml: renderMarkdown(sections.learned),
    nextHtml: renderMarkdown(sections.next)
  };
}

function padNumber(value) {
  const raw = String(value == null ? "" : value).replace(/\D/g, "");
  if (!raw) return "";
  return raw.padStart(2, "0");
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEPT", "OCT", "NOV", "DEC"];

function monthShort(date) {
  const month = Number(dateParts(date).month);
  return MONTHS[month - 1];
}

const virtualFileStore = new Map();

function setVirtualFile(filePath, content) {
  if (!filePath) return;
  const abs = path.isAbsolute(filePath) ? path.normalize(filePath) : path.normalize(path.join(ROOT, filePath));
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  virtualFileStore.set(abs, content);
  virtualFileStore.set(rel, content);
  virtualFileStore.delete(abs + ":deleted");
  virtualFileStore.delete(rel + ":deleted");
}

function getVirtualFile(filePath) {
  if (!filePath) return null;
  const abs = path.isAbsolute(filePath) ? path.normalize(filePath) : path.normalize(path.join(ROOT, filePath));
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  if (virtualFileStore.get(abs + ":deleted") || virtualFileStore.get(rel + ":deleted")) {
    return null;
  }
  return virtualFileStore.get(abs) || virtualFileStore.get(rel);
}

function deleteVirtualFile(filePath) {
  if (!filePath) return;
  const abs = path.isAbsolute(filePath) ? path.normalize(filePath) : path.normalize(path.join(ROOT, filePath));
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  virtualFileStore.delete(abs);
  virtualFileStore.delete(rel);
  virtualFileStore.set(abs + ":deleted", true);
  virtualFileStore.set(rel + ":deleted", true);
}

function isVirtualDeleted(filePath) {
  if (!filePath) return false;
  const abs = path.isAbsolute(filePath) ? path.normalize(filePath) : path.normalize(path.join(ROOT, filePath));
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  return Boolean(virtualFileStore.get(abs + ":deleted") || virtualFileStore.get(rel + ":deleted"));
}

function listMarkdown(dir) {
  const normDir = path.normalize(dir);
  const diskFiles = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith(".md")).map((name) => path.join(normDir, name))
    : [];
  
  const set = new Set(diskFiles.filter((f) => !isVirtualDeleted(f)));
  for (const [key] of virtualFileStore.entries()) {
    if (key.endsWith(".md") && !key.includes(":deleted")) {
      const absKey = path.isAbsolute(key) ? path.normalize(key) : path.normalize(path.join(ROOT, key));
      if (path.dirname(absKey) === normDir) {
        if (!isVirtualDeleted(absKey)) {
          set.add(absKey);
        }
      }
    }
  }
  return Array.from(set).sort();
}

function loadMarkdownFile(file, type) {
  const virt = getVirtualFile(file);
  let parsed;
  if (virt) {
    parsed = matter(virt);
  } else {
    parsed = matter(fs.readFileSync(file, "utf8"));
  }
  const data = parsed.data || {};
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  requireFields(data, REQUIRED[type], rel);

  if (typeof data.published !== "boolean" && type !== "note") {
    fail(rel, `"published" must be a boolean`);
  }

  if (type === "project" || type === "blog") {
    const expected = path.basename(file, ".md");
    if (data.slug !== expected) {
      fail(rel, `slug "${data.slug}" must match filename "${expected}"`);
    }
  }

  if (type === "project" && !Array.isArray(data.technologies)) {
    fail(rel, `"technologies" must be a list`);
  }

  const date = toDate(data.date, rel);
  const parts = dateParts(date);
  const body = parsed.content.trim();

  return {
    ...data,
    type,
    file: rel,
    date,
    dateISO: parts.iso,
    year: data.year || Number(parts.year),
    yearShort: parts.year.slice(2),
    month: parts.month,
    day: parts.day,
    monthShort: monthShort(date),
    number: padNumber(data.number),
    published: typeof data.published === "boolean" ? data.published : true,
    body,
    html: renderMarkdown(body),
    backlinks: []
  };
}

function loadNotes() {
  const notesDir = path.join(CONTENT, "notes");
  return listMarkdown(notesDir).map((file) => {
    const item = loadMarkdownFile(file, "note");
    const slug = item.slug || path.basename(file, ".md");
    return {
      ...item,
      slug,
      url: `/notes/${slug}/`,
      tags: Array.isArray(item.tags) ? item.tags : []
    };
  });
}

function computeBacklinksAndWikilinks(projects, blog, journal, notes = []) {
  const allContent = [...projects, ...blog, ...journal, ...notes];
  const lookupMap = new Map();

  allContent.forEach((item) => {
    if (item.title) lookupMap.set(item.title.toLowerCase(), item);
    if (item.slug) lookupMap.set(item.slug.toLowerCase(), item);
    if (item.dateISO) lookupMap.set(item.dateISO.toLowerCase(), item);
  });

  // Calculate incoming backlinks
  allContent.forEach((sourceItem) => {
    const textToScan = `${sourceItem.title || ""} ${sourceItem.body || ""}`;
    const matches = textToScan.match(/\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]/g) || [];
    
    matches.forEach((match) => {
      const innerMatch = match.match(/\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]/);
      if (!innerMatch) return;
      const targetName = innerMatch[1].trim().toLowerCase();
      const targetItem = lookupMap.get(targetName);
      if (targetItem && targetItem !== sourceItem) {
        const existing = targetItem.backlinks.find((b) => b.file === sourceItem.file);
        if (!existing) {
          targetItem.backlinks.push({
            title: sourceItem.title || sourceItem.slug || sourceItem.dateISO,
            type: sourceItem.type,
            url: sourceItem.url,
            file: sourceItem.file,
            dateISO: sourceItem.dateISO,
            published: sourceItem.published !== false
          });
        }
      }
    });
  });

  // Process Wikilinks in HTML outputs
  allContent.forEach((item) => {
    if (item.html) item.html = renderWikilinks(item.html, lookupMap);
    if (item.sections) {
      if (item.sections.didHtml) item.sections.didHtml = renderWikilinks(item.sections.didHtml, lookupMap);
      if (item.sections.learnedHtml) item.sections.learnedHtml = renderWikilinks(item.sections.learnedHtml, lookupMap);
      if (item.sections.nextHtml) item.sections.nextHtml = renderWikilinks(item.sections.nextHtml, lookupMap);
    }
  });

  return { projects, blog, journal, notes };
}

function loadProjects() {
  return listMarkdown(path.join(CONTENT, "projects"))
    .map((file) => {
      const item = loadMarkdownFile(file, "project");
      const art = item.art || "dots";
      const customArt = item.customArt || "";
      const artClassMap = {
        dots: "dots",
        architecture: "architecture",
        chart: "line-chart",
        bars: "data-bars",
        scatter: "scatter-plot",
        waves: "sine-waves",
        matrix: "matrix-grid",
        geometric: "geometric-mesh",
        circuit: "circuit-nodes",
        radial: "radial-burst",
        heatmap: "heatmap-grid",
        custom: "custom-art"
      };
      const rowArtClassMap = {
        dots: "row-art-dots",
        architecture: "row-art-architecture",
        chart: "row-art-chart",
        bars: "row-art-bars",
        scatter: "row-art-scatter",
        waves: "row-art-waves",
        matrix: "row-art-matrix",
        geometric: "row-art-geometric",
        circuit: "row-art-circuit",
        radial: "row-art-radial",
        heatmap: "row-art-heatmap",
        custom: "row-art-custom"
      };
      const artClass = artClassMap[art] || (customArt ? "custom-art" : "dots");
      const rowArtClass = rowArtClassMap[art] || (customArt ? "row-art-custom" : "row-art-dots");
      return {
        ...item,
        art,
        customArt,
        artClass,
        rowArtClass,
        url: `/projects/${item.slug}/`,
        techLabel: (item.technologies || []).map((tech) => String(tech).toUpperCase()).join(" / "),
        headline: item.headline && item.headline.length ? item.headline : [item.title.toUpperCase()],
        sections: item.sections || []
      };
    })
    .sort((a, b) => String(a.number).localeCompare(String(b.number)) || a.date - b.date);
}

function loadBlog() {
  return listMarkdown(path.join(CONTENT, "blog"))
    .map((file) => {
      const item = loadMarkdownFile(file, "blog");
      return {
        ...item,
        url: `/blog/${item.slug}/`,
        headline: item.headline && item.headline.length ? item.headline : [item.title.toUpperCase()],
        relatedProject: item.relatedProject || "",
        tags: Array.isArray(item.tags) ? item.tags : []
      };
    })
    .sort((a, b) => b.date - a.date);
}

function loadJournal() {
  const entries = listMarkdown(path.join(CONTENT, "journal")).map((file) => {
    const item = loadMarkdownFile(file, "journal");
    const sections = parseJournalSections(item.body);
    return {
      ...item,
      url: `/journal/${item.year}/${item.month}/${item.day}/`,
      headline: item.headline && item.headline.length ? item.headline : [item.title.toUpperCase()],
      project: item.project || "",
      sections,
      data: item.data || "",
      method: item.method || "",
      result: item.result || "",
      dataset: item.dataset || "",
      tools: item.tools || ""
    };
  });

  const seen = new Map();
  entries.forEach((entry) => {
    if (seen.has(entry.dateISO)) {
      fail(entry.file, `duplicate journal date ${entry.dateISO}; each public note needs a unique date`);
    }
    seen.set(entry.dateISO, entry.file);
  });

  return entries.sort((a, b) => b.date - a.date);
}

function loadAllContent() {
  const projects = loadProjects();
  const blog = loadBlog();
  const journal = loadJournal();
  const notes = loadNotes();
  return computeBacklinksAndWikilinks(projects, blog, journal, notes);
}

function loadAbout() {
  const file = path.join(CONTENT, "about.md");
  const virt = getVirtualFile(file);
  let parsed;
  if (virt) {
    parsed = matter(virt);
  } else {
    if (!fs.existsSync(file)) fail("content/about.md", "file is required");
    parsed = matter(fs.readFileSync(file, "utf8"));
  }
  const data = parsed.data || {};
  if (!data.title) fail("content/about.md", `missing required field "title"`);
  return {
    ...data,
    body: parsed.content.trim(),
    html: renderMarkdown(parsed.content.trim()),
    headline: data.headline || [data.title.toUpperCase()],
    homeHeadline: data.homeHeadline || data.headline || [data.title.toUpperCase()],
    principles: data.principles || []
  };
}

function loadYaml(name) {
  const file = path.join(CONTENT, name);
  const virt = getVirtualFile(file);
  if (virt) {
    return yaml.load(virt) || {};
  }
  if (!fs.existsSync(file)) fail(`content/${name}`, "file is required");
  return yaml.load(fs.readFileSync(file, "utf8")) || {};
}

function loadSkills() {
  const data = loadYaml("skills.yml");
  const groups = [
    ["dataAnalysis", "DATA ANALYSIS"],
    ["statistics", "STATISTICS"],
    ["machineLearning", "MACHINE LEARNING"],
    ["visualization", "VISUALIZATION"],
    ["other", "OTHER"]
  ];
  return groups.map(([key, title], index) => {
    const items = data[key];
    if (!Array.isArray(items) || !items.length) {
      fail("content/skills.yml", `missing skill group "${key}"`);
    }
    return {
      key,
      title,
      number: String(index + 1).padStart(2, "0"),
      items
    };
  });
}

function loadSettings() {
  const data = loadYaml("settings.yml");
  ["name", "url", "email"].forEach((field) => {
    if (!data[field]) fail("content/settings.yml", `missing required field "${field}"`);
  });
  return data;
}

module.exports = {
  ROOT,
  CONTENT,
  REQUIRED,
  renderMarkdown,
  renderWikilinks,
  loadProjects,
  loadBlog,
  loadJournal,
  loadNotes,
  loadAllContent,
  loadAbout,
  loadSkills,
  loadSettings,
  setVirtualFile,
  getVirtualFile,
  deleteVirtualFile,
  isVirtualDeleted
};

