const { handle } = require("../server/api");

module.exports = async (req, res) => {
  try {
    const handled = await handle(req, res);
    if (!handled && !res.writableEnded) {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Endpoint not found" }));
    }
  } catch (err) {
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: err.message || "Internal Server Error" }));
    }
  }
};
