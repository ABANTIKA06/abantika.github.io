const crypto = require("crypto");
const env = require("./env");

const COOKIE = "abantika_admin";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 Days (Extended Session)

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload) {
  const secret = env.sessionSecret;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function encode(data) {
  const payload = b64url(JSON.stringify(data));
  return `${payload}.${sign(payload)}`;
}

function decode(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expectedSig = sign(payload);
  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 1) return;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  });
  return out;
}

function cookieHeader(value, { clear = false } = {}) {
  const parts = [
    `${COOKIE}=${clear ? "" : value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (clear) parts.push("Max-Age=0");
  else parts.push(`Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`);
  if (env.publicOrigin.startsWith("https://")) parts.push("Secure");
  return parts.join("; ");
}

function read(req) {
  return decode(parseCookies(req)[COOKIE]);
}

function write(res, data) {
  const token = encode({ ...data, exp: Date.now() + MAX_AGE_MS });
  const current = res.getHeader("Set-Cookie");
  const next = cookieHeader(token);
  res.setHeader("Set-Cookie", current ? [].concat(current, next) : next);
}

function clear(res) {
  res.setHeader("Set-Cookie", cookieHeader("", { clear: true }));
}

function randomState() {
  return crypto.randomBytes(16).toString("hex");
}

module.exports = {
  COOKIE,
  parseCookies,
  read,
  write,
  clear,
  encode,
  randomState
};
