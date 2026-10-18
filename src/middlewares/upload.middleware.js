const multer = require("multer");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

// A first, cheap filter on the declared type. Some Android pickers report
// "image/jpg" or a generic octet-stream; storage.saveFile() then verifies the
// actual bytes, so a mislabelled real photo still goes through.
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/octet-stream"
];

// Buffer in memory, then hand off to the storage abstraction (local disk or S3).
// Keeps upload.middleware.js and storage.js decoupled from each other.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(ApiError.badRequest(`Unsupported file type (${file.mimetype}). Please choose a JPEG, PNG, WebP or HEIC photo.`));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.storage.maxUploadSizeMb * 1024 * 1024 }
});

module.exports = upload;
