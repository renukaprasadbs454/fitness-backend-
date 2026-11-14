const router = require("express").Router();
const { authenticate } = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/privacy.controller");

router.get("/notice", controller.publicNotice);
router.use(authenticate);
router.get("/me", controller.dashboard);
router.put("/me/consents/:purposeKey", controller.setConsent);
router.post("/me/requests", controller.createRequest);
router.post("/me/grievances", controller.createGrievance);
router.post("/me/nominees", controller.addNominee);
router.delete("/me/nominees/:id", controller.removeNominee);
router.get("/me/export", controller.exportData);

module.exports = router;
