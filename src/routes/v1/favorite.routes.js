const router = require("express").Router();
const controller = require("../../controllers/engagement.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/engagement.validator");

/**
 * @swagger
 * tags:
 *   name: Favourites
 *   description: Coaches the current user has starred
 */

/**
 * @swagger
 * /favorites/coaches:
 *   get:
 *     summary: List the current user's favourite coaches (full profiles)
 *     tags: [Favourites]
 *     responses:
 *       200: { description: Favourite coaches retrieved }
 * /favorites/coaches/ids:
 *   get:
 *     summary: List just the ids of the current user's favourite coaches
 *     tags: [Favourites]
 *     responses:
 *       200: { description: Favourite coach ids retrieved }
 * /favorites/coaches/{coachId}:
 *   post:
 *     summary: Star a coach (idempotent); returns the updated id list
 *     tags: [Favourites]
 *     parameters:
 *       - { in: path, name: coachId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Coach added to favourites }
 *   delete:
 *     summary: Unstar a coach; returns the updated id list
 *     tags: [Favourites]
 *     parameters:
 *       - { in: path, name: coachId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Coach removed from favourites }
 */
router.get("/coaches", authenticate, controller.listFavoriteCoaches);
router.get("/coaches/ids", authenticate, controller.listFavoriteCoachIds);
router.post("/coaches/:coachId", authenticate, validate(schemas.coachIdParam), controller.addFavoriteCoach);
router.delete("/coaches/:coachId", authenticate, validate(schemas.coachIdParam), controller.removeFavoriteCoach);

module.exports = router;
