const multer = require("multer");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

// Buffer in memory, then hand off to the storage abstraction (local disk or S3).
// Keeps upload.middleware.js and storage.js decoupled from each other.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.storage.maxUploadSizeMb * 1024 * 1024 }
});

module.exports = upload;
