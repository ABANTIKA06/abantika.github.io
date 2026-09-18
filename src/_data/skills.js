require("./stamp.json");
const { loadSkills } = require("../lib/content");

module.exports = function () {
  return loadSkills();
};
