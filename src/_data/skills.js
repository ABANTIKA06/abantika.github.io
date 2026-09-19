try { require("./stamp.json"); } catch (e) {}
const { loadSkills } = require("../lib/content");

module.exports = function () {
  return loadSkills();
};
