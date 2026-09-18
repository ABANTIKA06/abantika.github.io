require("./stamp.json");
const { loadAllContent } = require("../lib/content");

module.exports = function () {
  return loadAllContent().projects.filter((item) => item.published);
};
