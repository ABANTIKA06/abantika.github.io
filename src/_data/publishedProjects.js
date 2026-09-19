try { require("./stamp.json"); } catch (e) {}

module.exports = function () {
  const { loadAllContent } = require("../lib/content");
  return loadAllContent().projects.filter((item) => item.published);
};
