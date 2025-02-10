const Bill = require("../models/Bill");
const Payment = require("../models/Payment");

exports.makePayment = async (req, res) => {
  try {
    const { userId, billId, amountPaid, paymentMethod, transactionId } = req.body;

    // Create payment record
    const payment = await Payment.create({
      userId,
      billId,
      flatNumber: req.body.flatNumber, // Ensure flat number is passed
      amountPaid,
      paymentMethod,
      transactionId,
      status: "successful"
    });

    // Update bill record
    const bill = await Bill.findById(billId);
    bill.amountPaid += amountPaid;
    bill.remainingAmount = bill.totalAmount - bill.amountPaid;
    bill.paymentDetails.push({ paymentId: payment._id, amountPaid, paymentDate: new Date() });
    bill.status = bill.remainingAmount === 0 ? "paid" : "partial";
    await bill.save();

    res.status(200).json({ success: true, bill, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
