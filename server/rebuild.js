const fs = require("fs");
const path = require("path");
const env = require("./env");

const STAMP = path.join(env.ROOT, "src", "_data", "stamp.json");

let queue = Promise.resolve();

function writeStamp() {
  try {
    const dir = path.dirname(STAMP);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STAMP, `${JSON.stringify({ rebuiltAt: new Date().toISOString() }, null, 2)}\n`);
  } catch (err) {
    // Ignore read-only filesystem errors on Vercel serverless environment
  }
}

function bustRequire(file) {
  try {
    delete require.cache[require.resolve(file)];
  } catch (err) {
    /* not loaded */
  }
}

async function runEleventy() {
  try {
    const dataDir = path.join(env.ROOT, "src", "_data");
    if (fs.existsSync(dataDir)) {
      fs.readdirSync(dataDir).forEach((file) => {
        bustRequire(path.join(dataDir, file));
      });
    }
    bustRequire(path.join(env.ROOT, "src", "lib", "content.js"));
    const Eleventy = require("@11ty/eleventy");
    const elev = new Eleventy();
    await elev.init();
    await elev.write();
  } catch (err) {
    // Ignore write errors on Vercel serverless environment
  }
}

function rebuild() {
  queue = queue
    .catch(() => {})
    .then(async () => {
      writeStamp();
      await runEleventy();
    });
  return queue;
}

module.exports = { rebuild, writeStamp };
