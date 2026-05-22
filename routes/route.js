const express = require("express");
const router = express.Router();

const userController = require("../controllers/user");
const { requireUserAuth } = require("../middleware/auth");

router.get("/", requireUserAuth, userController.renderDashboard);
router.get("/investments", requireUserAuth, userController.renderInvestment);
router.get("/goals", requireUserAuth, userController.renderGoals);
router.get("/learnings", requireUserAuth, userController.renderLearnings);
router.get("/family", requireUserAuth, userController.renderFamily);
router.get("/fingpt", requireUserAuth, userController.renderChat);
router.get("/expenses", requireUserAuth, userController.renderExpenses);
router.get("/liabilities", requireUserAuth, userController.renderLiabilities);
router.get("/myprofile", requireUserAuth, userController.renderMyProfile);
router.post("/delete-account", requireUserAuth, userController.deleteAccount);

// Admin Routes
const { requireAdminAuth } = require("../middleware/auth");
router.get("/admin/login", userController.renderAdminLogin);
router.post("/admin/login", userController.handleAdminLogin);
router.get("/admin/dashboard", requireAdminAuth, userController.renderAdminDashboard);

router.get("/login", userController.renderLogin);
router.get("/register", userController.renderRegister);

module.exports = router;
