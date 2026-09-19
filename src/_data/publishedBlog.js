try { require("./stamp.json"); } catch (e) {}
const { loadAllContent } = require("../lib/content");

module.exports = function () {
  return loadAllContent().blog.filter((item) => item.published);
};
