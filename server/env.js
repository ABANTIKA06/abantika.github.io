const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq < 1) return;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    });
}

loadEnv();

function required(name) {
  return String(process.env[name] || "").trim();
}

module.exports = {
  ROOT,
  port: Number(process.env.ADMIN_PORT || 8080),
  eleventyPort: Number(process.env.ELEVENTY_PORT || 8080),
  publicOrigin: required("PUBLIC_ORIGIN") || "http://localhost:8080",
  githubClientId: required("GITHUB_CLIENT_ID"),
  githubClientSecret: required("GITHUB_CLIENT_SECRET"),
  allowedGithubUser: required("ALLOWED_GITHUB_USER"),
  sessionSecret: required("SESSION_SECRET") || "abantika-session-secret-default-key-2026",
  adminDevLogin: required("ADMIN_DEV_LOGIN"),
  adminPasscode: required("ADMIN_PASSCODE") || "abantika2026",
  githubToken: required("GITHUB_TOKEN"),
  githubRepoOwner: required("GITHUB_REPO_OWNER"),
  githubRepoName: required("GITHUB_REPO_NAME"),
  githubBranch: required("GITHUB_BRANCH") || "main",
  isLocalHost(host) {
    const name = String(host || "").split(":")[0];
    return name === "localhost" || name === "127.0.0.1";
  }
};
