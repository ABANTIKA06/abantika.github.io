const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { NodeHttpHandler } = require("@smithy/node-http-handler");
const env = require("./env");

function getCredentials() {
  const accountId = String(env.r2AccountId || process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = String(env.r2AccessKeyId || process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(env.r2SecretAccessKey || process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(env.r2BucketName || process.env.R2_BUCKET_NAME || "").trim();
  const publicDomain = String(env.r2PublicDomain || process.env.R2_PUBLIC_DOMAIN || "").trim().replace(/\/$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicDomain };
}

function getR2Client() {
  const creds = getCredentials();
  if (!creds) return null;

  return new S3Client({
    region: "auto",
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    maxAttempts: 1,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 2000,
      requestTimeout: 2500
    }),
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey
    }
  });
}

function isConfigured() {
  return Boolean(getCredentials());
}

let r2Cache = null;
let r2CacheTime = 0;
const R2_CACHE_TTL = 20000;

function invalidateR2Cache() {
  r2Cache = null;
  r2CacheTime = 0;
}

async function uploadMedia({ folder = "about", filename, buffer, contentType = "application/octet-stream" }) {
  const creds = getCredentials();
  const client = getR2Client();
  if (!creds || !client) throw new Error("Cloudflare R2 is not configured.");

  const key = `${folder}/${filename}`.replace(/^\/+/, "");

  await client.send(
    new PutObjectCommand({
      Bucket: creds.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );

  invalidateR2Cache();

  const publicUrl = creds.publicDomain
    ? `${creds.publicDomain}/${key}`
    : `https://${creds.bucket}.${creds.accountId}.r2.cloudflarestorage.com/${key}`;

  return {
    name: filename,
    folder,
    path: publicUrl,
    r2: true,
    key
  };
}

async function removeMedia({ folder = "about", filename, key }) {
  const creds = getCredentials();
  const client = getR2Client();
  if (!creds || !client) return false;

  const objectKey = key || `${folder}/${filename}`.replace(/^\/+/, "");

  await client.send(
    new DeleteObjectCommand({
      Bucket: creds.bucket,
      Key: objectKey
    })
  );

  invalidateR2Cache();
  return true;
}

async function getSignedUploadUrl({ folder = "about", filename, contentType = "application/octet-stream" }) {
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
  const creds = getCredentials();
  const client = getR2Client();
  if (!creds || !client) return null;

  const key = `${folder}/${filename}`.replace(/^\/+/, "");
  const command = new PutObjectCommand({
    Bucket: creds.bucket,
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });
  const publicUrl = creds.publicDomain
    ? `${creds.publicDomain}/${key}`
    : `https://${creds.bucket}.${creds.accountId}.r2.cloudflarestorage.com/${key}`;

  invalidateR2Cache();
  return { uploadUrl, publicUrl, key };
}

async function listMedia(forceRefresh = false) {
  if (!forceRefresh && r2Cache && (Date.now() - r2CacheTime < R2_CACHE_TTL)) {
    return r2Cache;
  }

  const creds = getCredentials();
  const client = getR2Client();
  if (!creds || !client) return [];

  try {
    const command = new ListObjectsV2Command({
      Bucket: creds.bucket
    });
    const res = await client.send(command);
    const contents = res.Contents || [];
    const items = contents.map((obj) => {
      const key = obj.Key || "";
      const parts = key.split("/");
      const folder = parts.length > 1 ? parts[0] : "about";
      const name = parts.length > 1 ? parts.slice(1).join("/") : key;
      const publicUrl = creds.publicDomain
        ? `${creds.publicDomain}/${key}`
        : `https://${creds.bucket}.${creds.accountId}.r2.cloudflarestorage.com/${key}`;

      return {
        folder,
        name,
        path: publicUrl,
        size: obj.Size || 0,
        updated: obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString(),
        r2: true,
        key
      };
    });

    r2Cache = items;
    r2CacheTime = Date.now();
    return items;
  } catch (err) {
    console.error("Cloudflare R2 listMedia error:", err);
    return [];
  }
}

module.exports = {
  isConfigured,
  uploadMedia,
  removeMedia,
  getSignedUploadUrl,
  listMedia,
  invalidateR2Cache
};
