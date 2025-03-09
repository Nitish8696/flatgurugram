const User = require("../models/FlatUser");
const bcrypt = require("bcryptjs");
const xlsx = require("xlsx");
const jwt = require("jsonwebtoken");
const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const fs = require("fs");
const path = require("path");
const FlatUser = require("../models/FlatUser");
const axios = require("axios");

const API_KEY = "78E1A43D5B2456FA8CF5369DBFB9EF";
const MERCHANT_ID = "SG2119";
const API_URL = "https://smartgatewayuat.hdfcbank.com/session";

exports.registerUser = async (req, res) => {
  try {
    const { name, flatNumber, email, phone, password, complex } = req.body;

    // Validate complex input
    const validComplexes = [
      "RICHMOND PARK",
      "REGENCY PARK-1",
      "REGENT HOUSE",
      "EWS/SP UNITS",
    ];
    if (!validComplexes.includes(complex)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complex. Choose from Complex A, B, C, or D.",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ flatNumber });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Flat number already registered." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await User.create({
      name,
      flatNumber,
      email,
      phone,
      password: hashedPassword,
      complex,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully.",
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { complex } = req.query; // Get complex from query params

    let query = {};
    if (complex) {
      query.complex = complex; // Filter users by complex if provided
    }

    const users = await User.find(query);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { flatNumber, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ flatNumber });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid password." });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res
      .status(200)
      .json({ success: true, message: "Login successful.", token, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id; // Extracted from JWT middleware

    // Fetch pending bills
    const pendingBills = await Bill.find({
      userId,
      status: { $ne: "paid" },
    }).sort({ dueDate: 1 });

    // Fetch payment history
    const paymentHistory = await Payment.find({ userId })
      .sort({
        paymentDate: -1,
      })
      .limit(10);

    res.status(200).json({
      success: true,
      dashboard: {
        pendingBills,
        paymentHistory,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.payBill = async (req, res) => {
  const { billId, amount } = req.body;

  const transactionId = "TR" + Date.now() + 869670;

  if (!billId || !amount) {
    return res
      .status(400)
      .json({ message: "Bill ID and amount are required." });
  }

  try {
    const bill = await Bill.findById(billId);

    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    // Validate payment amount
    if (amount > bill.remainingAmount) {
      return res
        .status(400)
        .json({ message: "Payment amount exceeds the remaining amount." });
    }

    if (amount < 10) {
      return res
        .status(400)
        .json({ message: "Payment amount must be at least Rs 10." });
    }

    // return res.status(200).json({
    //   message: "Payment successful.",
    //   updatedBill: {
    //     billId: bill.billType,
    //     flatNumber: bill.flatNumber,
    //     totalAmount: bill.totalAmount,
    //     remainingAmount: bill.remainingAmount,
    //     status: bill.status,
    //     paymentDetails: bill.paymentDetails,
    //   },
    // });
    // const customerDetails = await FlatUser.findById(req.user.id);

    const base64ApiKey = "base_64_encoded_api_key=="; // Your base64 encoded API key

    try {
      // Extracting details from request body
      // const { amount, currency, orderId, customerDetails } = req.body;

      const requestData = {
        order_id: transactionId,
        amount: amount,
        customer_id: billId,
        customer_email: "test@mail.com",
        customer_phone: "8604613494",
        payment_page_client_id: "your_client_id",
        action: "paymentPage",
        currency: "INR",
        return_url: `https://pay2rrca.com/user/payment/${transactionId}`,
        description: "Complete your payment",
        first_name: "John",
        last_name: "wick",
      };

      const config = {
        method: "post",
        url: "https://smartgatewayuat.hdfcbank.com/session",
        headers: {
          Authorization: `Basic ${base64ApiKey}`,
          "Content-Type": "application/json",
          "x-merchantid": "SG2119",
          "x-customerid": "123",
        },
        auth: {
          username: "78E1A43D5B2456FA8CF5369DBFB9EF",
          password: "", // Keep empty if not required
        },
        data: requestData,
      };

      axios(config)
        .then((response) => {
          console.log("Response:", response.data);
          console.log(response.data.sdk_payload.payload.amount);
          if (Number(response.data.sdk_payload.payload.amount) !== amount) {
            return res
              .status(400)
              .json({ msg: "something went wrong try again later" });
          }
          res.status(200).json({ paymentUrl: response.data.payment_links.web });
        })
        .catch((error) => {
          console.log(error);
          console.error(
            "Error:",
            error.response ? error.response.data : error.message
          );
        });

      // Respond to frontend with Payment URL
    } catch (error) {
      console.error(
        "Payment initiation failed:",
        error.response?.data || error.message
      );
      res.status(500).json({ error: "Payment initiation failed" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};

exports.checkStatus = async (req, res) => {
  const { transactionId } = req.params;

  try {
    const payment = await Payment.findOne({ transactionId: transactionId });

    if (payment && payment.status === "failed") {
      return res.status(200).json({ msg: "Failed", newPayment: payment });
    }

    if (payment && payment.status === "successful") {
      return res.status(200).json({ msg: "SUCCESS", newPayment: payment });
    }

    const response = await axios.get(
      `https://smartgatewayuat.hdfcbank.com/orders/${transactionId}`,
      {
        headers: {
          Authorization: `Basic base_64_encoded_api_key==`,
          version: "2023-06-30",
          "Content-Type": "application/x-www-form-urlencoded",
          "x-merchantid": "merchant_id",
          "x-customerid": "customer_id",
        },
        auth: {
          username: "78E1A43D5B2456FA8CF5369DBFB9EF",
          password: "",
        },
      }
    );
    if (response.data.status === "CHARGED") {
      const bill = await Bill.findById(response.data.customer_id);

      const newPayment = new Payment({
        userId: bill.userId,
        billId: bill.billType,
        flatNumber: bill.flatNumber,
        amountPaid: response.data.amount,
        transactionId,
        status: "successful", // Assuming success for this case
      });

      await newPayment.save();

      // Update payment details
      bill.amountPaid += response.data.amount;
      bill.remainingAmount -= response.data.amount;

      // Update status
      if (bill.remainingAmount === 0) {
        bill.status = "paid";
      } else {
        bill.status = "partial";
      }
      // Add payment record
      bill.paymentDetails.push({
        paymentId: newPayment._id,
        amountPaid: response.data.amount,
        paymentDate: newPayment.paymentDate,
      });

      // Save updates to the database
      await bill.save();
      return res
        .status(200)
        .json({ msg: "SUCCESSFUL", newPayment: newPayment });
    }
    if (response.data.status === "AUTHENTICATION_FAILED") {
      const bill = await Bill.findById(response.data.customer_id);

      const newPayment = new Payment({
        userId: bill.userId,
        billId: bill.billType,
        flatNumber: bill.flatNumber,
        amountPaid: response.data.amount,
        transactionId,
        status: "failed",
      });

      await newPayment.save();

      bill.paymentDetails.push({
        paymentId: newPayment._id,
        amountPaid: response.data.amount,
        paymentDate: newPayment.paymentDate,
      });

      // Save updates to the database
      await bill.save();
      return res.status(200).json({ msg: "Failed", newPayment: newPayment });
    }
    if (response.data.status === "AUTHORIZATION_FAILED") {
      const bill = await Bill.findById(response.data.customer_id);

      const newPayment = new Payment({
        userId: bill.userId,
        billId: bill.billType,
        flatNumber: bill.flatNumber,
        amountPaid: response.data.amount,
        transactionId,
        status: "Failed", // Assuming success for this case
      });

      await newPayment.save();

      bill.paymentDetails.push({
        paymentId: newPayment._id,
        amountPaid: response.data.amount,
        paymentDate: newPayment.paymentDate,
      });

      // Save updates to the database
      await bill.save();
      return res.status(200).json({ msg: "Failed", newPayment: newPayment });
    } else {
      const bill = await Bill.findById(response.data.customer_id);

      const newPayment = new Payment({
        userId: bill.userId,
        billId: bill.billType,
        flatNumber: bill.flatNumber,
        amountPaid: response.data.amount,
        transactionId,
        status: "Failed", // Assuming success for this case
      });

      await newPayment.save();

      bill.paymentDetails.push({
        paymentId: newPayment._id,
        amountPaid: response.data.amount,
        paymentDate: newPayment.paymentDate,
      });

      // Save updates to the database
      await bill.save();
      res.status(200).json({ msg: "Failed", newPayment: newPayment });
    }
  } catch (error) {
    console.log("Response" + error)
  }
};

exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id; // Extracted from JWT middleware
    const { page = 1, limit = 10 } = req.query; // Default to page 1 and 10 items per page

    // Convert page and limit to numbers for calculation
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Fetch payments with pagination
    const payments = await Payment.find({ userId })
      .sort({ paymentDate: -1 })
      .skip((pageNumber - 1) * limitNumber) // Skip items for previous pages
      .limit(limitNumber); // Limit items for current page

    // Get the total number of payments for pagination metadata
    const totalPayments = await Payment.countDocuments({ userId });

    res.status(200).json({
      success: true,
      payments,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalPayments / limitNumber),
        totalPayments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadUsers = async (req, res) => {
  try {
    // Ensure a file is uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // Read the uploaded Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0]; // Assuming data is in the first sheet
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Validate if required columns are present
    const requiredColumns = [
      "flatNumber",
      "name",
      "email",
      "phone",
      "password",
      "complex",
    ];

    const missingColumns = requiredColumns.filter(
      (col) => !sheetData[0] || !Object.keys(sheetData[0]).includes(col)
    );

    if (missingColumns.length > 0) {
      return res
        .status(400)
        .json({ error: `Missing columns: ${missingColumns.join(", ")}` });
    }

    const validComplexes = [
      "RICHMOND PARK",
      "REGENCY PARK-1",
      "REGENT HOUSE",
      "EWS/SP UNITS",
    ];

    // Prepare users for bulk insertion
    const users = [];

    for (const row of sheetData) {
      try {
        // Validate complex field
        if (!validComplexes.includes(row.complex)) {
          console.log(`Skipping user: Invalid complex value (${row.complex})`);
          continue; // Skip invalid entries
        }

        // Check for existing flatNumber or email
        const existingUser = await User.findOne({
          $or: [{ flatNumber: row.flatNumber }, { email: row.email }],
        });

        if (existingUser) {
          console.log(
            `Skipping user: Flat Number (${row.flatNumber}) or Email (${row.email}) already exists.`
          );
          continue; // Skip duplicates
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(row.password, 10);

        users.push({
          flatNumber: row.flatNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          password: hashedPassword,
          complex: row.complex,
        });
      } catch (err) {
        console.error("Error processing row:", row, err);
      }
    }

    // Insert users into the database
    if (users.length > 0) {
      await User.insertMany(users);
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error("Error deleting file:", err);
        }
      });
      res.status(201).json({ message: "Users created successfully." });
    } else {
      res.status(400).json({ error: "No valid users to insert." });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Failed to create users.", details: error.message });
  }
};
