var Complaints;

const mongoose = require("mongoose");

const ComplaintSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true,
  },
  cropID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Crop",
  },
  complainerID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  complainAgainstID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  date: {
    type: Date,
    default: new Date(),
  },
  complainerRole: {
    type: String,
    enum: ["farmer", "buyer"],
  },
});

Complaints = mongoose.model("Complaints", ComplaintSchema);
module.exports = Complaints;
