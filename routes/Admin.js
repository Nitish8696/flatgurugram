const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// Middleware (if required, e.g., authentication or role checking)
const isAuthenticated = require("../middleware/adminAuthMiddleware");
const isAdmin = require("../middleware/isAdmin");

const multer = require("multer");

const upload = multer({ dest: "uploads/" }); 

// Admin Routes

// Upload a new bill
router.post("/login", adminController.loginAdmin)
router.post("/register", adminController.registerAdmin);

router.post("/upload-bill",isAuthenticated, isAdmin, adminController.uploadBill);
router.post("/upload-bill/xcel",isAuthenticated, isAdmin, upload.single("file"), adminController.uploadBillsFromExcel);

router.get("/payments/:userId",isAuthenticated, isAdmin, adminController.getUserPayments)

// Get all bills
router.get("/all-bills/:userId", isAuthenticated, isAdmin, adminController.getAllBills);

// Get bills for a specific user
router.get("/user-bills/:userId", isAuthenticated, isAdmin, adminController.getUserBills);

// Update a specific bill
router.put("/update-bill/:billId", isAuthenticated, isAdmin, adminController.updateBill);

// Generate report
router.post("/generate-report", isAuthenticated, isAdmin, adminController.generateReport);

module.exports = router;
