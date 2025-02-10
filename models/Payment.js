const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  billId: { type: String },
  flatNumber: { type: String, required: true },
  amountPaid: { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now },
  paymentMethod: { type: String, default: "Online" },
  transactionId: { type: String, required: true },
  status: { type: String, enum: ["successful", "failed"], required: true }
});

module.exports = mongoose.model("Payment", paymentSchema);
