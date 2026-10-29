const router = require("express").Router();
const integrationController = require("../../controllers/integration.controller");

/**
 * @swagger
 * /integrations/google-meet/callback:
 *   get:
 *     summary: OAuth redirect target after an admin connects the platform Google account (opened by Google, not called directly)
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - { in: query, name: code, schema: { type: string } }
 *       - { in: query, name: state, schema: { type: string } }
 *     responses:
 *       302: { description: Redirects back to the admin portal with the result }
 */
router.get("/google-meet/callback", integrationController.googleMeetCallback);

module.exports = router;
