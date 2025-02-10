const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const xlsx = require("xlsx");
const FlatUser = require("../models/FlatUser"); // Import User model
const fs = require("fs");
const path = require("path");

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found." });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid password." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, isAdmin: admin.isAdmin },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res
      .status(200)
      .json({ success: true, message: "Login successful.", token });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.registerAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    console.log(email, password, name);

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin
    const newAdmin = new Admin({
      email,
      password: hashedPassword,
      name,
      isAdmin: false,
    });

    // Save to database
    await newAdmin.save();

    res.status(201).json({ message: "Admin registered successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Registration failed.", error: error.message });
  }
};
exports.getUserPayments = async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    // Base query for payments by user
    let query = { userId };

    // Add date filter if startDate and endDate are provided
    if (startDate && endDate) {
      query.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const payments = await Payment.find(query)
      .sort({ paymentDate: -1 })
      .populate("billId"); // Sort by paymentDate (most recent first)

    if (!payments.length) {
      return res.status(404).json({ message: "No payments found." });
    }

    res.status(200).json({ payments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

exports.uploadBill = async (req, res) => {
  try {
    const { userId, flatNumber, billType, originalAmount, dueDate } = req.body;
    const numericOriginalAmount = Number(originalAmount);

    // Fetch past bills of the same type where dueDate has passed
    const pastDueBills = await Bill.find({
      userId,
      billType,
      remainingAmount: { $gt: 0 },
      dueDate: { $lt: new Date() }, // Check if dueDate has passed
    });

    // Calculate total outstanding amount from past due bills
    const outstandingAmount = pastDueBills.reduce(
      (acc, bill) => acc + bill.remainingAmount,
      0
    );

    // Delete past due bills
    await Bill.deleteMany({
      userId,
      billType,
      remainingAmount: { $gt: 0 },
      dueDate: { $lt: new Date() },
    });

    // Create a new bill with updated total and remaining amounts
    const newBill = new Bill({
      userId,
      flatNumber,
      billType,
      originalAmount: numericOriginalAmount,
      totalAmount: numericOriginalAmount + outstandingAmount,
      remainingAmount: numericOriginalAmount + outstandingAmount,
      dueDate,
    });

    // Save to database
    await newBill.save();

    res.status(201).json({
      message: "Bill uploaded successfully.",
      bill: newBill,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to upload bill.",
      details: error.message,
    });
  }
};

exports.uploadBillsFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // Read the Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0]; // Read the first sheet
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Required columns
    const requiredColumns = [
      "flatNumber",
      "billType",
      "originalAmount",
      "dueDate",
    ];

    // Validate if required columns are present
    const missingColumns = requiredColumns.filter(
      (col) => !sheetData[0] || !Object.keys(sheetData[0]).includes(col)
    );
    if (missingColumns.length > 0) {
      return res
        .status(400)
        .json({ error: `Missing columns: ${missingColumns.join(", ")}` });
    }

    let billsToInsert = [];

    for (let row of sheetData) {
      const { flatNumber, billType, originalAmount, dueDate } = row;
      const numericOriginalAmount = Number(originalAmount);

      // Find the user by flatNumber
      const user = await FlatUser.findOne({ flatNumber });
      if (!user) {
        return res
          .status(400)
          .json({ error: `User with flatNumber ${flatNumber} not found.` });
      }

      // Fetch past due bills of the same type
      const pastDueBills = await Bill.find({
        userId: user._id,
        billType,
        remainingAmount: { $gt: 0 },
        dueDate: { $lt: new Date() }, // Check if dueDate has passed
      });

      // Calculate outstanding amount
      const outstandingAmount = pastDueBills.reduce(
        (acc, bill) => acc + bill.remainingAmount,
        0
      );

      // Delete past due bills
      await Bill.deleteMany({
        userId: user._id,
        billType,
        remainingAmount: { $gt: 0 },
        dueDate: { $lt: new Date() },
      });

      // Prepare the new bill object
      const newBill = {
        userId: user._id,
        flatNumber,
        billType,
        originalAmount: numericOriginalAmount,
        totalAmount: numericOriginalAmount + outstandingAmount,
        remainingAmount: numericOriginalAmount + outstandingAmount,
        dueDate,
      };

      billsToInsert.push(newBill);
    }

    // Insert all bills at once
    if (billsToInsert.length > 0) {
      await Bill.insertMany(billsToInsert);
    }

    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      }
    });

    res.status(201).json({
      message: "Bills uploaded successfully.",
      bills: billsToInsert,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to upload bills.", details: error.message });
  }
};

exports.getAllBills = async (req, res) => {
  try {
    const bills = await Bill.find().populate("userId", "name email flatNumber");

    res.status(200).json({ bills });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch bills.", details: error.message });
  }
};

exports.getUserBills = async (req, res) => {
  try {
    const { userId } = req.params;

    const userBills = await Bill.find({ userId }).sort({ dueDate: -1 });

    if (!userBills.length) {
      return res.status(404).json({ message: "No bills found for this user." });
    }

    res.status(200).json({ bills: userBills });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch user's bills.", details: error.message });
  }
};

exports.updateBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const updates = req.body;

    const updatedBill = await Bill.findByIdAndUpdate(billId, updates, {
      new: true,
    });

    if (!updatedBill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    res
      .status(200)
      .json({ message: "Bill updated successfully.", bill: updatedBill });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to update bill.", details: error.message });
  }
};

const nodemailer = require("nodemailer");
const isAdmin = require("../middleware/isAdmin");

exports.sendBillNotification = async (userEmail, billDetails) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: "admin@example.com",
      to: userEmail,
      subject: "New Bill Generated",
      text: `Dear User, a new ${billDetails.billType} bill has been generated. 
      Total Amount: ₹${billDetails.totalAmount}
      Due Date: ${billDetails.dueDate}.
      Please log in to your account to make a payment.`,
    };

    await transporter.sendMail(mailOptions);
    console.log("Notification sent successfully.");
  } catch (error) {
    console.error("Failed to send notification:", error.message);
  }
};

exports.generateReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    const report = await Bill.aggregate([
      {
        $match: {
          uploadedAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
        },
      },
      {
        $group: {
          _id: "$billType",
          totalBills: { $sum: 1 },
          totalRevenue: { $sum: "$amountPaid" },
          outstanding: { $sum: "$remainingAmount" },
        },
      },
    ]);

    res.status(200).json({ report });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to generate report.", details: error.message });
  }
};
