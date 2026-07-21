const router = require("express").Router();
const userController = require("../../controllers/user.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/user.validator");

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Authenticated user profile
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile retrieved }
 *       401: { description: Not authenticated }
 */
router.get("/me", authenticate, userController.getMe);

/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Update the current user's profile (height, weight, age, gender, goal)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateProfileRequest' }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put("/me", authenticate, validate(schemas.updateProfile), userController.updateMe);

module.exports = router;
