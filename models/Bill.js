const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  flatNumber: { type: String, required: true },
  billType: { type: String, enum: ["electricity", "maintenance"], required: true },
  totalAmount: { type: Number, required: true },
  originalAmount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  uploadedAt: { type: Date, default: Date.now },
  amountPaid: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 0 },
  status: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },
  paymentDetails: [
    {
      paymentId: mongoose.Schema.Types.ObjectId,
      amountPaid: Number,
      paymentDate: Date
    }
  ]
});

module.exports = mongoose.model("Bill", billSchema);
