const express = require("express");
const userController = require("../controllers/userController");
const { verifyToken } = require("../middleware/authMiddleware");
const isAuthenticated = require("../middleware/adminAuthMiddleware");
const isAdmin = require("../middleware/isAdmin");
const multer = require("multer");

const upload = multer({ dest: "uploads/" }); // Files will be temporarily stored in the 'uploads' folder


const router = express.Router();

// User Registration
router.post("/register", userController.registerUser);

// User Login
router.post("/login", userController.loginUser);
router.get("/users", verifyToken, isAdmin, userController.getUsers);
router.post("/pay-bill", verifyToken, userController.payBill);
router.get("/pay-status/:transactionId",userController.checkStatus);
router.post("/upload-users",verifyToken,isAdmin, upload.single("file"), userController.uploadUsers);

// User Dashboard
router.get("/dashboard", verifyToken, userController.getUserDashboard);
router.get("/payments", verifyToken, userController.getUserPayments);

module.exports = router;
