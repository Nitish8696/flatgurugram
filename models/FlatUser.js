const mongoose = require("mongoose");

const flatUserSchema = new mongoose.Schema({
  flatNumber: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true }, // Store hashed password
  complex: { 
    type: String, 
    required: true, 
    enum: ["RICHMOND PARK", "REGENCY PARK-1", "REGENT HOUSE", "EWS/SP UNITS"] // Restrict values to predefined complexes
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FlatUser", flatUserSchema);
