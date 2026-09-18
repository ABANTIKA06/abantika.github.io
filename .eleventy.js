const path = require("path");
const { renderMarkdown } = require("./src/lib/content");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addWatchTarget("src/assets");
  eleventyConfig.addWatchTarget(path.join(__dirname, "content"));
  eleventyConfig.setWatchThrottleWaitTime(150);
  eleventyConfig.setBrowserSyncConfig({
    middleware: [
      function (req, res, next) {
        res.setHeader("Cache-Control", "no-store");
        next();
      }
    ]
  });

  eleventyConfig.addFilter("markdown", renderMarkdown);
  eleventyConfig.addFilter("published", (items) => (items || []).filter((item) => item.published));
  eleventyConfig.addFilter("featured", (items) =>
    (items || []).filter((item) => item.published && item.featured)
  );
  eleventyConfig.addFilter("joinLines", (lines) => (lines || []).join("<br>"));
  eleventyConfig.addFilter("publicText", (preferred, fallback) => {
    const first = String(preferred || "").trim();
    const second = String(fallback || "").trim();
    if (first && !first.includes("[PLACEHOLDER")) return first;
    return second || first;
  });
  eleventyConfig.addFilter("findBySlug", (items, slug) =>
    (items || []).find((item) => item.slug === slug)
  );
  eleventyConfig.addFilter("relatedTo", (items, slug) =>
    (items || []).filter(
      (item) => item.published && (item.relatedProject === slug || item.project === slug)
    )
  );
  eleventyConfig.addFilter("editorialBreak", (value) => {
    const words = String(value || "")
      .toUpperCase()
      .trim()
      .split(/\s+/);
    if (words.length <= 1) return words.join(" ");
    return `${words.slice(0, -1).join(" ")}<br>${words[words.length - 1]}`;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
