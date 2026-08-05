const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const logger = require("../config/logger");

/**
 * Storage abstraction. Two drivers:
 *  - "local": writes to disk under LOCAL_UPLOAD_DIR, returns a relative URL.
 *  - "s3": uploads to AWS S3, returns the public/CDN URL.
 * Controlled entirely by STORAGE_DRIVER env var — no controller/service
 * code needs to know which one is active.
 */

let s3Client = null;
function getS3() {
  if (!s3Client) {
    const AWS = require("aws-sdk");
    const s3Config = {
      accessKeyId: env.storage.aws.accessKeyId,
      secretAccessKey: env.storage.aws.secretAccessKey,
      region: env.storage.aws.region
    };
    if (env.storage.aws.endpoint) {
      s3Config.endpoint = env.storage.aws.endpoint;
    }
    if (env.storage.aws.forcePathStyle) {
      s3Config.s3ForcePathStyle = true;
    }
    s3Config.signatureVersion = "v4";
    s3Client = new AWS.S3(s3Config);
  }
  return s3Client;
}

async function saveLocal(file, subfolder) {
  const dir = path.join(process.cwd(), env.storage.localUploadDir, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
  const destPath = path.join(dir, filename);
  fs.writeFileSync(destPath, file.buffer);
  const storageKey = path.posix.join(env.storage.localUploadDir, subfolder, filename);
  return {
    url: `/${storageKey}`,
    storageKey
  };
}

async function saveS3(file, subfolder) {
  const s3 = getS3();
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
  const key = `${subfolder}/${filename}`;
  const bucket = env.storage.aws.bucket;
  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    })
    .promise();

  let url;
  if (env.storage.aws.publicUrlTemplate) {
    url = env.storage.aws.publicUrlTemplate.replace("{bucket}", bucket).replace("{key}", key);
  } else if (env.storage.aws.endpoint) {
    // Non-AWS S3-compatible endpoint (Tigris, MinIO, R2, ...) — path-style
    // public URL. Real AWS S3 (no custom endpoint) keeps its own domain
    // pattern below since amazonaws.com virtual-hosted URLs still apply there.
    url = `${env.storage.aws.endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  } else {
    url = `https://${bucket}.s3.${env.storage.aws.region}.amazonaws.com/${key}`;
  }

  return { url, storageKey: key };
}

async function saveFile(file, subfolder) {
  if (env.storage.driver === "s3") {
    return saveS3(file, subfolder);
  }
  return saveLocal(file, subfolder);
}

// The bucket behind this endpoint is private (confirmed: uploads succeed but
// unauthenticated GETs 403, and canned ACLs like public-read are silently
// ignored — common for providers that gate access via bucket policy, not
// per-object ACL). Presigned URLs are the standard, provider-agnostic fix:
// they work regardless of the bucket's public/private setting.
const SIGNED_URL_EXPIRES_SECONDS = 24 * 60 * 60; // 24h — plenty for a client session

function s3KeyFromStoredUrl(storedUrl) {
  if (env.storage.driver !== "s3" || !env.storage.aws.endpoint) return null;

  const prefix = `${env.storage.aws.endpoint.replace(/\/$/, "")}/${env.storage.aws.bucket}/`;
  if (!storedUrl || !storedUrl.startsWith(prefix)) return null;

  return storedUrl.slice(prefix.length);
}

/** Re-signs one of our own stored S3 URLs into a fresh, time-limited GET URL.
 * Returns the input unchanged if it isn't one of ours (e.g. local /uploads
 * paths, or driver isn't "s3") — safe to call on any string. */
function resolveReadUrl(storedUrl) {
  const key = s3KeyFromStoredUrl(storedUrl);
  if (!key) return storedUrl;

  return getS3().getSignedUrl("getObject", {
    Bucket: env.storage.aws.bucket,
    Key: key,
    Expires: SIGNED_URL_EXPIRES_SECONDS
  });
}

async function deleteFile(storageKey) {
  try {
    if (env.storage.driver === "s3") {
      const s3 = getS3();
      await s3.deleteObject({ Bucket: env.storage.aws.bucket, Key: storageKey }).promise();
    } else {
      const fullPath = path.join(process.cwd(), storageKey);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
  } catch (err) {
    logger.warn(`Failed to delete file ${storageKey}: ${err.message}`);
  }
}

module.exports = { saveFile, deleteFile, resolveReadUrl };
