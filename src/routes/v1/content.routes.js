const router = require("express").Router();
const contentController = require("../../controllers/content.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const upload = require("../../middlewares/upload.middleware");
const schemas = require("../../validators/content.validator");
const { cacheResponse, invalidate } = require("../../middlewares/cache.middleware");

const CACHE_PREFIX = "/api/v1/content";

/**
 * @swagger
 * tags:
 *   name: Content
 *   description: Blogs, workout tips, nutrition tips, and educational videos (CMS)
 */

// ── Public/authenticated reads ────────────────────────────

/**
 * @swagger
 * /content/categories:
 *   get:
 *     summary: List content categories
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Categories retrieved }
 */
router.get("/categories", authenticate, cacheResponse(300), contentController.listCategories);

/**
 * @swagger
 * /content/blogs:
 *   get:
 *     summary: List published blog posts
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Content retrieved }
 */
router.get(
  "/blogs",
  authenticate,
  cacheResponse(60),
  (req, res, next) => {
    req.query.type = "BLOG";
    next();
  },
  validate(schemas.listPublished),
  contentController.listPublished
);

/**
 * @swagger
 * /content/videos:
 *   get:
 *     summary: List published educational videos
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Content retrieved }
 */
router.get(
  "/videos",
  authenticate,
  cacheResponse(60),
  (req, res, next) => {
    req.query.type = "VIDEO";
    next();
  },
  validate(schemas.listPublished),
  contentController.listPublished
);

/**
 * @swagger
 * /content/tips:
 *   get:
 *     summary: List published workout + nutrition tips
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Content retrieved }
 */
router.get(
  "/tips",
  authenticate,
  cacheResponse(60),
  (req, res, next) => {
    req.query.type = ["WORKOUT_TIP", "NUTRITION_TIP"];
    next();
  },
  contentController.listPublished
);

/**
 * @swagger
 * /content/posts/{slug}:
 *   get:
 *     summary: Get a single published content post by slug (increments view count)
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Content retrieved }
 *       404: { description: Not found }
 */
router.get("/posts/:slug", authenticate, validate(schemas.slugParam), contentController.getBySlug);

// ── Admin/coach authoring ──────────────────────────────────

/**
 * @swagger
 * /content/admin:
 *   get:
 *     summary: List all content (any status) — admin/coach authoring view
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Content retrieved }
 */
router.get(
  "/admin",
  authenticate,
  requireRole("ADMIN", "COACH"),
  validate(schemas.listAll),
  contentController.listAll
);

/**
 * @swagger
 * /content/admin/{id}:
 *   get:
 *     summary: Get any content post by id (admin/coach)
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Content retrieved }
 */
router.get(
  "/admin/:id",
  authenticate,
  requireRole("ADMIN", "COACH"),
  validate(schemas.idParam),
  contentController.getById
);

/**
 * @swagger
 * /content:
 *   post:
 *     summary: Create a content post (draft or published)
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Content created }
 */
router.post(
  "/",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole("ADMIN", "COACH"),
  validate(schemas.create),
  contentController.create
);

/**
 * @swagger
 * /content/{id}:
 *   patch:
 *     summary: Update a content post
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Content updated }
 */
router.patch(
  "/:id",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole("ADMIN", "COACH"),
  validate(schemas.update),
  contentController.update
);

/**
 * @swagger
 * /content/{id}:
 *   delete:
 *     summary: Delete a content post
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Content deleted }
 */
router.delete(
  "/:id",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole("ADMIN", "COACH"),
  validate(schemas.idParam),
  contentController.remove
);

/**
 * @swagger
 * /content/cover-image:
 *   post:
 *     summary: Upload a cover image for a content post
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: Cover image uploaded }
 */
router.post(
  "/cover-image",
  authenticate,
  requireRole("ADMIN", "COACH"),
  upload.single("file"),
  contentController.uploadCoverImage
);

/**
 * @swagger
 * /content/categories:
 *   post:
 *     summary: Create a content category
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Category created }
 */
router.post(
  "/categories",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole("ADMIN"),
  validate(schemas.createCategory),
  contentController.createCategory
);

/**
 * @swagger
 * /content/categories/{id}:
 *   delete:
 *     summary: Delete a content category
 *     tags: [Content]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Category deleted }
 */
router.delete(
  "/categories/:id",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole("ADMIN"),
  validate(schemas.idParam),
  contentController.deleteCategory
);

module.exports = router;
