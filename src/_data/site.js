try { require("./stamp.json"); } catch (e) {}
const { loadSettings } = require("../lib/content");

module.exports = function () {
  const settings = loadSettings();
  return {
    name: settings.siteTitle || `${settings.name} — ${settings.role}`,
    shortName: settings.name,
    role: settings.role,
    url: settings.url.replace(/\/$/, ""),
    email: settings.email,
    linkedin: settings.linkedin || "",
    github: settings.github || "",
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
