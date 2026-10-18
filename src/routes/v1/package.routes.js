const router = require("express").Router();
const packageController = require("../../controllers/package.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/package.validator");
const { ROLES } = require("../../constants/roles");

/**
 * @swagger
 * tags:
 *   name: Packages
 *   description: Membership packages and checkout
 */

/**
 * @swagger
 * /packages:
 *   get:
 *     summary: List active membership packages
 *     tags: [Packages]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Packages retrieved }
 */
router.get("/", authenticate, packageController.list);

/**
 * @swagger
 * /packages/{id}/checkout:
 *   post:
 *     summary: Place an order for a package (records a PENDING payment)
 *     tags: [Packages]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Order placed }
 */
router.post("/:id/checkout", authenticate, validate(schemas.checkout), packageController.checkout);

// ── Admin management ─────────────────────────────────────

/**
 * @swagger
 * /packages/admin/all:
 *   get:
 *     summary: "Admin: list all packages including inactive ones"
 *     tags: [Packages]
 *     responses:
 *       200: { description: Packages retrieved }
 * /packages:
 *   post:
 *     summary: "Admin: create a package"
 *     tags: [Packages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PackageRequest' }
 *     responses:
 *       201: { description: Package created }
 * /packages/{id}:
 *   put:
 *     summary: "Admin: update a package (any subset of fields)"
 *     tags: [Packages]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PackageRequest' }
 *     responses:
 *       200: { description: Package updated }
 *   delete:
 *     summary: "Admin: delete a package"
 *     tags: [Packages]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Package deleted }
 */
router.get("/admin/all", authenticate, requireRole(ROLES.ADMIN), packageController.listAll);
router.post("/", authenticate, requireRole(ROLES.ADMIN), validate(schemas.createPackage), packageController.create);
router.put("/:id", authenticate, requireRole(ROLES.ADMIN), validate(schemas.updatePackage), packageController.update);
router.delete("/:id", authenticate, requireRole(ROLES.ADMIN), validate(schemas.idParam), packageController.remove);

module.exports = router;
