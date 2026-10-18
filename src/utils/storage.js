const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const logger = require("../config/logger");
const ApiError = require("./ApiError");

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

// The type is read from the file's own bytes, never from the client-supplied
// name or MIME type: web uploads arrive with data:/blob: URIs as "names", and a
// renamed file must not be stored (and later served) as something it isn't.
const BRANDS_HEIC = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"];

function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", ext: ".jpg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: ".png" };
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { mime: "image/webp", ext: ".webp" };
  }
  if (buffer.toString("ascii", 4, 8) === "ftyp" && BRANDS_HEIC.includes(buffer.toString("ascii", 8, 12))) {
    return { mime: "image/heic", ext: ".heic" };
  }
  return null;
}

function newFilename(ext) {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

async function saveLocal(file, subfolder, type) {
  const dir = path.join(process.cwd(), env.storage.localUploadDir, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const filename = newFilename(type.ext);
  const destPath = path.join(dir, filename);
  fs.writeFileSync(destPath, file.buffer);
  const storageKey = path.posix.join(env.storage.localUploadDir, subfolder, filename);
  return {
    url: `/${storageKey}`,
    storageKey
  };
}

async function saveS3(file, subfolder, type) {
  const s3 = getS3();
  const filename = newFilename(type.ext);
  const key = `${subfolder}/${filename}`;
  const bucket = env.storage.aws.bucket;
  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: type.mime,
      // Keys are unique per upload, so the object never changes once written.
      CacheControl: "public, max-age=31536000, immutable"
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

/** Stores an uploaded image. Returns { url, storageKey, mimeType } — mimeType is the detected one. */
async function saveFile(file, subfolder) {
  const type = detectImageType(file?.buffer);
  if (!type) {
    throw ApiError.badRequest("That file isn't a supported image. Please choose a JPEG, PNG, WebP or HEIC photo.");
  }

  const saved = env.storage.driver === "s3" ? await saveS3(file, subfolder, type) : await saveLocal(file, subfolder, type);
  return { ...saved, mimeType: type.mime };
}

// The bucket behind this endpoint is private (confirmed: uploads succeed but
// unauthenticated GETs 403, and canned ACLs like public-read are silently
// ignored — common for providers that gate access via bucket policy, not
// per-object ACL). Presigned URLs are the standard, provider-agnostic fix:
// they work regardless of the bucket's public/private setting.
const SIGNED_URL_EXPIRES_SECONDS = 24 * 60 * 60; // 24h — plenty for a client session

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Recovers the object key from a URL we stored, whichever way it was built:
//  - path-style on a custom endpoint (Tigris, MinIO, R2):  <endpoint>/<bucket>/<key>
//  - a configured public URL template:                     S3_PUBLIC_URL_TEMPLATE with {bucket}/{key}
//  - AWS virtual-hosted style:                             https://<bucket>.s3.<region>.amazonaws.com/<key>
// Returns null for anything that isn't ours (so local "/uploads/..." paths and
// third-party URLs pass through untouched). A private bucket only serves images
// once their URL is re-signed, so missing a form here means broken images.
function s3KeyFromStoredUrl(storedUrl) {
  if (env.storage.driver !== "s3" || !storedUrl || typeof storedUrl !== "string") return null;

  const { bucket, endpoint, region, publicUrlTemplate } = env.storage.aws;
  if (!bucket) return null;
  const withoutQuery = storedUrl.split("?")[0];

  if (endpoint) {
    const prefix = `${endpoint.replace(/\/$/, "")}/${bucket}/`;
    if (withoutQuery.startsWith(prefix)) return decodeURIComponent(withoutQuery.slice(prefix.length));
  }

  if (publicUrlTemplate && publicUrlTemplate.includes("{key}")) {
    const pattern = publicUrlTemplate
      .split(/(\{bucket\}|\{key\})/)
      .map((part) => (part === "{bucket}" ? escapeRegex(bucket) : part === "{key}" ? "(.+)" : escapeRegex(part)))
      .join("");
    const match = new RegExp(`^${pattern}$`).exec(withoutQuery);
    if (match) return decodeURIComponent(match[1]);
  }

  if (!endpoint) {
    const prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
    if (withoutQuery.startsWith(prefix)) return decodeURIComponent(withoutQuery.slice(prefix.length));
  }

  return null;
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

// 1x1 transparent PNG used to exercise the whole upload -> sign -> download path.
const DIAGNOSTIC_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * Admin-facing self-test of image storage. Uploads a tiny image, builds the URL
 * the apps would receive, downloads it exactly as a client would, then cleans up.
 * Reports each step so a misconfigured bucket/endpoint/region is obvious.
 */
async function diagnose() {
  const { bucket, endpoint, region, publicUrlTemplate } = env.storage.aws;
  const report = {
    driver: env.storage.driver,
    config: {
      bucketSet: Boolean(bucket),
      endpointSet: Boolean(endpoint),
      region,
      publicUrlTemplateSet: Boolean(publicUrlTemplate)
    },
    steps: [],
    ok: false
  };
  const step = (name, ok, detail) => report.steps.push({ name, ok, detail });

  let saved;
  try {
    saved = await saveFile({ buffer: DIAGNOSTIC_PNG, mimetype: "image/png", originalname: "diagnostic.png" }, "diagnostics");
    step("upload", true, `stored as ${saved.storageKey}`);
  } catch (err) {
    step("upload", false, err.code ? `${err.code}: ${err.message}` : err.message);
    return report;
  }

  try {
    const readUrl = resolveReadUrl(saved.url);
    const signed = readUrl !== saved.url;
    if (env.storage.driver === "s3") {
      step("sign", signed, signed ? "stored URL was recognised and signed" : "stored URL was NOT recognised, so clients get an unsigned link (private buckets will return 403)");
    }

    if (/^https?:\/\//i.test(readUrl)) {
      const res = await fetch(readUrl);
      const bytes = Buffer.from(await res.arrayBuffer());
      const type = res.headers.get("content-type") || "";
      step("download", res.ok, `HTTP ${res.status}, ${type || "no content-type"}, ${bytes.length} bytes`);
      step("content-type", type.startsWith("image/"), type.startsWith("image/") ? type : `expected image/*, got "${type}"`);
      step("integrity", res.ok && bytes.equals(DIAGNOSTIC_PNG), res.ok && bytes.equals(DIAGNOSTIC_PNG) ? "downloaded bytes match the upload" : "downloaded bytes differ from the upload");
    } else {
      const exists = fs.existsSync(path.join(process.cwd(), saved.storageKey));
      step("local file", exists, `${saved.storageKey} ${exists ? "written to this server's disk (lost on redeploy on ephemeral hosts)" : "missing"}`);
    }
  } catch (err) {
    step("download", false, err.message);
  } finally {
    await deleteFile(saved.storageKey);
  }

  report.ok = report.steps.every((s) => s.ok);
  return report;
}

module.exports = { saveFile, deleteFile, resolveReadUrl, detectImageType, diagnose };
