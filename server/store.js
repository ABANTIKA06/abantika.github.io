const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const yaml = require("js-yaml");
const {
  ROOT,
  CONTENT,
  loadProjects,
  loadBlog,
  loadJournal,
  loadNotes,
  loadAbout,
  loadSkills,
  loadSettings
} = require("../src/lib/content");

const IMAGES = path.join(ROOT, "src", "assets", "images");
const FOLDERS = ["projects", "blog", "journal", "about"];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toLines(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function bool(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function isPlaceholder(value) {
  const text = String(value || "").trim();
  return !text || text.includes("[PLACEHOLDER");
}

function preferPublic(preferred, fallback) {
  const first = String(preferred || "").trim();
  const second = String(fallback || "").trim();
  if (!isPlaceholder(first)) return first;
  return second || first;
}

function requireFields(data, fields, label) {
  fields.forEach((field) => {
    const value = data[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) {
      throw new Error(`${label}: missing required field "${field}"`);
    }
  });
}

function safeWriteFile(file, content, encoding = "utf8") {
  try {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, content, encoding);
  } catch (err) {
    if (err.code !== "EROFS" && !String(err.message).includes("read-only")) {
      throw err;
    }
  }
}

function safeUnlinkFile(file) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (err) {
    if (err.code !== "EROFS" && !String(err.message).includes("read-only")) {
      throw err;
    }
  }
}

function writeMarkdown(file, data, body = "") {
  const raw = matter.stringify(body.replace(/^\n+/, ""), data);
  safeWriteFile(file, raw.endsWith("\n") ? raw : `${raw}\n`, "utf8");
}

function overview() {
  const projects = loadProjects();
  const blog = loadBlog();
  const journal = loadJournal();
  const publishedDates = []
    .concat(
      projects.filter((item) => item.published).map((item) => item.date),
      blog.filter((item) => item.published).map((item) => item.date),
      journal.filter((item) => item.published).map((item) => item.date)
    )
    .sort((a, b) => b - a);
  return {
    projects: {
      published: projects.filter((item) => item.published).length,
      draft: projects.filter((item) => !item.published).length,
      total: projects.length
    },
    blog: {
      published: blog.filter((item) => item.published).length,
      draft: blog.filter((item) => !item.published).length,
      total: blog.length
    },
    journal: {
      published: journal.filter((item) => item.published).length,
      draft: journal.filter((item) => !item.published).length,
      total: journal.length
    },
    lastPublished: publishedDates[0] ? publishedDates[0].toISOString().slice(0, 10) : ""
  };
}

function listAll() {
  return {
    projects: loadProjects().map(publicProject),
    blog: loadBlog().map(publicBlog),
    journal: loadJournal().map(publicJournal)
  };
}

function publicProject(item) {
  return {
    title: item.title,
    slug: item.slug,
    number: item.number,
    date: item.dateISO,
    year: item.year,
    category: item.category,
    description: item.description,
    summary: item.summary || "",
    technologies: item.technologies || [],
    featured: Boolean(item.featured),
    published: Boolean(item.published),
    art: item.art,
    artLabel: item.artLabel || "",
    cover: item.cover || "",
    github: item.github || "",
    live: item.live || "",
    headline: item.headline || [],
    sections: item.sections || [],
    body: item.body || "",
    url: item.url
  };
}

function publicBlog(item) {
  return {
    title: item.title,
    slug: item.slug,
    date: item.dateISO,
    category: item.category || "",
    tags: item.tags || [],
    description: item.description,
    cover: item.cover || "",
    published: Boolean(item.published),
    featured: Boolean(item.featured),
    relatedProject: item.relatedProject || "",
    headline: item.headline || [],
    body: item.body || "",
    url: item.url
  };
}

function publicJournal(item) {
  return {
    title: item.title,
    date: item.dateISO,
    headline: item.headline || [],
    project: item.project || "",
    published: Boolean(item.published),
    summary: item.summary || "",
    did: item.sections.did || "",
    learned: item.sections.learned || "",
    next: item.sections.next || "",
    data: item.data || "",
    method: item.method || "",
    result: item.result || "",
    dataset: item.dataset || "",
    tools: item.tools || "",
    url: item.url,
    id: path.basename(item.file, ".md")
  };
}

function projectFile(slug) {
  return path.join(CONTENT, "projects", `${slug}.md`);
}

function blogFile(slug) {
  return path.join(CONTENT, "blog", `${slug}.md`);
}

function journalFile(id) {
  return path.join(CONTENT, "journal", `${id}.md`);
}

function saveProject(input, { isNew = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const title = String(input.title || "").trim() || "Untitled Project";
  const slug = slugify(input.slug || title) || "new-project";
  const date = String(input.date || today).slice(0, 10);
  const category = String(input.category || "Data Analysis").trim();
  const description = String(input.description || input.summary || title).trim();
  const technologies = toList(input.technologies || "Python");

  requireFields({ title, slug, description, date, category, technologies }, ["title", "slug", "description", "date", "category", "technologies"], "project");
  const file = projectFile(slug);
  if (isNew && fs.existsSync(file)) throw new Error(`project "${slug}" already exists`);
  const data = {
    title,
    slug,
    number: String(input.number || "").padStart(2, "0"),
    date,
    year: Number(input.year || date.slice(0, 4)),
    category,
    description,
    summary: preferPublic(input.summary, description),
    technologies,
    featured: bool(input.featured),
    published: bool(input.published),
    art: ["architecture", "chart", "dots"].includes(input.art) ? input.art : "dots",
    artLabel: String(input.artLabel || "").trim(),
    cover: String(input.cover || "").trim(),
    github: String(input.github || "").trim(),
    live: String(input.live || "").trim(),
    headline: toLines(input.headline || title),
    sections: Array.isArray(input.sections)
      ? input.sections.map((section) => ({
          label: String(section.label || "").trim(),
          heading: String(section.heading || "").trim(),
          body: String(section.body || "").trim()
        }))
      : []
  };
  writeMarkdown(file, data, String(input.body || ""));
  return publicProject(loadProjects().find((item) => item.slug === slug));
}

function saveBlog(input, { isNew = false } = {}) {
  const slug = slugify(input.slug || input.title);
  requireFields({ ...input, slug }, ["title", "slug", "description", "date"], "blog");
  const file = blogFile(slug);
  if (isNew && fs.existsSync(file)) throw new Error(`article "${slug}" already exists`);
  const data = {
    type: "blog",
    title: String(input.title).trim(),
    slug,
    date: String(input.date).slice(0, 10),
    category: String(input.category || "").trim(),
    tags: toList(input.tags),
    description: String(input.description).trim(),
    cover: String(input.cover || "").trim(),
    published: bool(input.published),
    featured: bool(input.featured),
    relatedProject: String(input.relatedProject || "").trim(),
    headline: toLines(input.headline)
  };
  writeMarkdown(file, data, String(input.body || ""));
  return publicBlog(loadBlog().find((item) => item.slug === slug));
}

function journalId(date, title) {
  const day = String(date).slice(0, 10);
  const slug = slugify(title) || "note";
  return `${day}-${slug}`;
}

function journalBody(input) {
  return [
    "## What I did",
    "",
    String(input.did || "").trim() || "[PLACEHOLDER — What was done.]",
    "",
    "## What I learned",
    "",
    String(input.learned || "").trim() || "[PLACEHOLDER — What was learned.]",
    "",
    "## Next",
    "",
    String(input.next || "").trim() || "[PLACEHOLDER — Next steps.]"
  ].join("\n");
}

function saveJournal(input, { id, isNew = false } = {}) {
  requireFields(input, ["date", "title"], "journal");
  const nextId = id || journalId(input.date, input.title);
  const file = journalFile(nextId);
  if (isNew && fs.existsSync(file)) throw new Error(`journal entry "${nextId}" already exists`);
  const dateISO = String(input.date).slice(0, 10);
  const duplicate = loadJournal().find((item) => item.dateISO === dateISO && path.basename(item.file, ".md") !== nextId);
  if (duplicate) throw new Error(`a journal entry already exists for ${dateISO}`);
  const data = {
    type: "journal",
    date: dateISO,
    title: String(input.title).trim(),
    headline: toLines(input.headline),
    project: String(input.project || "").trim(),
    published: bool(input.published),
    summary: String(input.summary || input.did || "").trim(),
    data: String(input.data || "").trim(),
    method: String(input.method || "").trim(),
    result: String(input.result || "").trim(),
    dataset: String(input.dataset || "").trim(),
    tools: String(input.tools || "").trim()
  };
  writeMarkdown(file, data, journalBody(input));
  if (id && id !== nextId) {
    const previous = journalFile(id);
    if (fs.existsSync(previous) && previous !== file) fs.unlinkSync(previous);
  }
  return publicJournal(loadJournal().find((item) => path.basename(item.file, ".md") === nextId));
}

function saveAbout(input) {
  requireFields(input, ["title"], "about");
  const data = {
    title: String(input.title).trim(),
    portrait: String(input.portrait || "").trim(),
    headline: toLines(input.headline),
    homeHeadline: toLines(input.homeHeadline),
    intro: String(input.intro || "").trim(),
    homeSummary: preferPublic(input.homeSummary, input.intro),
    approachEyebrow: String(input.approachEyebrow || "").trim(),
    approachHeadline: toLines(input.approachHeadline),
    approach: String(input.approach || "").trim(),
    marginNote: toLines(input.marginNote),
    principles: Array.isArray(input.principles) ? input.principles : []
  };
  writeMarkdown(path.join(CONTENT, "about.md"), data, "");
  return loadAbout();
}

function saveSkills(input) {
  const groups = input.groups || input;
  const data = {
    dataAnalysis: toLines(groups.dataAnalysis),
    statistics: toLines(groups.statistics),
    machineLearning: toLines(groups.machineLearning),
    visualization: toLines(groups.visualization),
    other: toLines(groups.other)
  };
  Object.entries(data).forEach(([key, items]) => {
    if (!items.length) throw new Error(`skills: group "${key}" cannot be empty`);
  });
  safeWriteFile(path.join(CONTENT, "skills.yml"), yaml.dump(data), "utf8");
  return loadSkills();
}

function saveSettings(input) {
  requireFields(input, ["name", "url", "email"], "settings");
  const data = {
    name: String(input.name).trim(),
    role: String(input.role || "").trim(),
    siteTitle: String(input.siteTitle || "").trim(),
    url: String(input.url).trim(),
    email: String(input.email).trim(),
    linkedin: String(input.linkedin || "").trim(),
    github: String(input.github || "").trim(),
    description: String(input.description || "").trim(),
    ogDescription: String(input.ogDescription || "").trim(),
    heroLede: String(input.heroLede || "").trim(),
    contactBlurb: String(input.contactBlurb || "").trim(),
    availability: toLines(input.availability),
    footerNote: String(input.footerNote || "").trim(),
    copyrightYear: Number(input.copyrightYear || new Date().getFullYear())
  };
  safeWriteFile(path.join(CONTENT, "settings.yml"), yaml.dump(data), "utf8");
  return loadSettings();
}

function findMediaReferences(imgPath, imgName) {
  const allDocs = [
    ...loadProjects(),
    ...loadBlog(),
    ...loadJournal(),
    ...loadNotes()
  ];
  const refs = [];
  allDocs.forEach((doc) => {
    const text = `${JSON.stringify(doc || {})} ${doc.body || ""}`;
    if (text.includes(imgPath) || text.includes(imgName)) {
      refs.push({
        title: doc.title || doc.slug || doc.dateISO,
        type: doc.type,
        url: doc.url,
        file: doc.file
      });
    }
  });
  return refs;
}

const mediaBufferCache = new Map();

function getMediaBuffer(relPath) {
  const norm = String(relPath || "").replace(/\\/g, "/");
  return mediaBufferCache.get(norm);
}

function listMedia() {
  const items = [];
  const seenPaths = new Set();
  FOLDERS.forEach((folder) => {
    const dir = path.join(IMAGES, folder);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach((name) => {
      if (name === ".gitkeep") return;
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (!stat.isFile()) return;
      const imgPath = `/assets/images/${folder}/${name}`;
      seenPaths.add(imgPath);
      const references = findMediaReferences(imgPath, name);
      items.push({
        folder,
        name,
        path: imgPath,
        size: stat.size,
        updated: stat.mtime.toISOString(),
        references
      });
    });
  });

  for (const [relPath, buf] of mediaBufferCache.entries()) {
    const parts = relPath.split("/");
    const folder = parts[parts.length - 2];
    const name = parts[parts.length - 1];
    const imgPath = `/assets/images/${folder}/${name}`;
    if (!seenPaths.has(imgPath)) {
      seenPaths.add(imgPath);
      const references = findMediaReferences(imgPath, name);
      items.push({
        folder,
        name,
        path: imgPath,
        size: buf.length,
        updated: new Date().toISOString(),
        references
      });
    }
  }

  return items.sort((a, b) => a.path.localeCompare(b.path));
}

function safeName(name) {
  const base = path.basename(String(name || "")).replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!base || base.startsWith(".")) throw new Error("invalid file name");
  return base;
}

function saveMedia({ folder, filename, data }) {
  if (!FOLDERS.includes(folder)) throw new Error("invalid media folder");
  const name = safeName(filename);
  const buf = Buffer.from(String(data || "").replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buf.length) throw new Error("empty file");
  if (buf.length > 4.5 * 1024 * 1024) throw new Error("file exceeds 4.5MB limit.");
  const dir = path.join(IMAGES, folder);
  const fullPath = path.join(dir, name);
  safeWriteFile(fullPath, buf, null);

  const relPath = `src/assets/images/${folder}/${name}`.replace(/\\/g, "/");
  mediaBufferCache.set(relPath, buf);

  return { folder, name, path: `/assets/images/${folder}/${name}` };
}

function removeMedia({ folder, filename, force }) {
  if (!FOLDERS.includes(folder)) throw new Error("invalid media folder");
  const name = safeName(filename);
  const imgPath = `/assets/images/${folder}/${name}`;
  const file = path.join(IMAGES, folder, name);

  const refs = findMediaReferences(imgPath, name);
  if (refs.length > 0 && !force) {
    const refNames = refs.map((r) => `[${r.type.toUpperCase()}] ${r.title}`).join(", ");
    throw new Error(`Cannot delete. Image is referenced by ${refs.length} document(s): ${refNames}`);
  }

  safeUnlinkFile(file);
  return { ok: true };
}

function listNotes() {
  return loadNotes();
}

function getNote(slugOrFilename) {
  const name = slugOrFilename.endsWith(".md") ? slugOrFilename : `${slugOrFilename}.md`;
  const file = path.join(CONTENT, "notes", name);
  if (!fs.existsSync(file)) throw new Error(`Note not found: ${name}`);
  const parsed = matter(fs.readFileSync(file, "utf8"));
  return {
    filename: name,
    slug: path.basename(name, ".md"),
    data: parsed.data || {},
    body: parsed.content || ""
  };
}

function saveNote(payload) {
  const title = String(payload.title || "").trim();
  if (!title) throw new Error("Note requires a title.");
  const slug = slugify(payload.slug || title);
  if (!slug) throw new Error("Note requires a valid slug.");
  const filename = `${slug}.md`;
  const file = path.join(CONTENT, "notes", filename);
  const data = {
    type: "note",
    title,
    slug,
    date: payload.date || new Date().toISOString().slice(0, 10),
    tags: toList(payload.tags),
    published: bool(payload.published)
  };
  writeMarkdown(file, data, payload.body || "");
  return { filename, slug, data };
}

function deleteNote(slugOrFilename) {
  const name = slugOrFilename.endsWith(".md") ? slugOrFilename : `${slugOrFilename}.md`;
  const file = path.join(CONTENT, "notes", name);
  safeUnlinkFile(file);
  return { ok: true, filename: name };
}

function promoteNote({ slugOrFilename, targetType }) {
  const note = getNote(slugOrFilename);
  const title = note.data.title || note.slug;
  const slug = note.slug;
  const date = note.data.date || new Date().toISOString().slice(0, 10);
  const body = note.body;

  if (targetType === "blog") {
    saveBlog({
      originalSlug: slug,
      slug,
      title,
      description: `Promoted from note: ${title}`,
      date,
      published: false,
      body,
      tags: note.data.tags || []
    });
    deleteNote(slug);
    return { targetType: "blog", slug, message: `Promoted note to Blog draft: ${slug}` };
  } else if (targetType === "project") {
    saveProject({
      originalSlug: slug,
      slug,
      title,
      description: `Promoted from note: ${title}`,
      date,
      category: "DATA SCIENCE",
      technologies: note.data.tags && note.data.tags.length ? note.data.tags : ["Python"],
      published: false,
      body
    });
    deleteNote(slug);
    return { targetType: "project", slug, message: `Promoted note to Project draft: ${slug}` };
  }
  throw new Error(`Invalid promotion target type: ${targetType}`);
}

module.exports = {
  slugify,
  overview,
  listAll,
  loadAbout,
  loadSkills,
  loadSettings,
  publicProject,
  publicBlog,
  publicJournal,
  saveProject,
  saveBlog,
  saveJournal,
  saveAbout,
  saveSkills,
  saveSettings,
  listNotes,
  getNote,
  saveNote,
  deleteNote,
  promoteNote,
  listMedia,
  getMediaBuffer,
  saveMedia,
  removeMedia,
  loadProjects,
  loadBlog,
  loadJournal,
  loadNotes
};

