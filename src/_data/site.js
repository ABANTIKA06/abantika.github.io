try { require("./stamp.json"); } catch (e) {}
const { loadSettings } = require("../lib/content");

function urlFix(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed || trimmed === "#") return "";
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

module.exports = function () {
  const settings = loadSettings();
  return {
    name: settings.siteTitle || `${settings.name} — ${settings.role}`,
    shortName: settings.name,
    role: settings.role,
    url: urlFix(settings.url).replace(/\/$/, ""),
    email: settings.email,
    linkedin: urlFix(settings.linkedin),
    github: urlFix(settings.github),
    description: settings.description,
    ogDescription: settings.ogDescription || settings.description,
    heroLede: settings.heroLede,
    contactBlurb: settings.contactBlurb,
    availabilityLines: Array.isArray(settings.availability)
      ? settings.availability
      : [settings.availability],
    footerNote: settings.footerNote,
    copyrightYear: settings.copyrightYear
  };
};
