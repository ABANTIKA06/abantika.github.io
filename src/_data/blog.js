require("./stamp.json");
const { loadAllContent } = require("../lib/content");

module.exports = function () {
  return loadAllContent().blog;
};
