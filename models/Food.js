const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  servings: Number,
  assignedAt: { type: Date, default: Date.now },
});

const foodSchema = new mongoose.Schema({
  title: String,
  description: String,
  totalServings: Number,
  availableServings: Number,
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignments: [assignmentSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Food", foodSchema);
