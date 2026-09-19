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

async function uploadMedia({ folder = "about", filename, buffer, contentType = "image/webp" }) {
  const creds = getCredentials();
  const client = getR2Client();
  if (!creds || !client) {
    throw new Error("Cloudflare R2 is not configured properly.");
  }

  const key = `${folder}/${filename}`.replace(/^\/+/, "");

  await client.send(
    new PutObjectCommand({
      Bucket: creds.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );

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
  return true;
}

module.exports = {
  isConfigured,
  uploadMedia,
  removeMedia
};
