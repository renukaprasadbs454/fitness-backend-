const router = require("express").Router();
const uploadController = require("../../controllers/upload.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware");

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: Profile & progress image uploads
 */

/**
 * @swagger
 * /uploads:
 *   post:
 *     summary: Upload a profile, progress, or coach image
 *     tags: [Uploads]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               type: { type: string, enum: [PROFILE_IMAGE, PROGRESS_IMAGE, COACH_IMAGE] }
 *     responses:
 *       201: { description: Image uploaded }
 *       400: { description: Invalid file type or missing file }
 */
router.post("/", authenticate, upload.single("file"), uploadController.uploadImage);

/**
 * @swagger
 * /uploads:
 *   get:
 *     summary: List the current user's uploaded media
 *     tags: [Uploads]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [PROFILE_IMAGE, PROGRESS_IMAGE, COACH_IMAGE] }
 *     responses:
 *       200: { description: Media retrieved }
 */
router.get("/", authenticate, uploadController.listMyMedia);

/**
 * @swagger
 * /uploads/{id}:
 *   delete:
 *     summary: Delete an uploaded media item
 *     tags: [Uploads]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Media deleted }
 *       403: { description: Not your media }
 *       404: { description: Media not found }
 */
router.delete("/:id", authenticate, uploadController.deleteMedia);

module.exports = router;
