try { require("./stamp.json"); } catch (e) {}
const { loadAbout } = require("../lib/content");

module.exports = function () {
  return loadAbout();
};
