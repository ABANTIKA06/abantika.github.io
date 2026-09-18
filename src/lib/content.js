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

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const href = tokens[idx].attrGet("href") || "";
  if (/^\s*javascript:/i.test(href) || /^\s*data:/i.test(href)) {
    tokens[idx].attrSet("href", "#");
  } else if (/^https?:/i.test(href)) {
    tokens[idx].attrSet("rel", "noopener noreferrer");
    tokens[idx].attrSet("target", "_blank");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const defaultImage =
  md.renderer.rules.image ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const src = tokens[idx].attrGet("src") || "";
  if (!src.startsWith("/assets/")) {
    tokens[idx].attrSet("src", "");
    tokens[idx].attrSet("alt", tokens[idx].content || "");
  }
  return defaultImage(tokens, idx, options, env, self);
};

function renderMarkdown(value) {
  if (!value) return "";
  return md.render(String(value));
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

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => path.join(dir, name));
}

function loadMarkdownFile(file, type) {
  const parsed = matter(fs.readFileSync(file, "utf8"));
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
      const art = item.art === "architecture" || item.art === "chart" ? item.art : "dots";
      return {
        ...item,
        art,
        artClass: art === "chart" ? "line-chart" : art === "architecture" ? "architecture" : "dots",
        rowArtClass:
          art === "chart" ? "row-art-chart" : art === "architecture" ? "row-art-architecture" : "row-art-dots",
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
  if (!fs.existsSync(file)) fail("content/about.md", "file is required");
  const parsed = matter(fs.readFileSync(file, "utf8"));
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
  loadSettings
};

