require("./stamp.json");
const { loadAbout } = require("../lib/content");

module.exports = function () {
  return loadAbout();
};
