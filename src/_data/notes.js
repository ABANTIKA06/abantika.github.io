try { require("./stamp.json"); } catch (e) {}

module.exports = function () {
  const { loadAllContent } = require("../lib/content");
  return loadAllContent().notes;
};
