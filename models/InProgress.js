var InProgress;

const mongoose = require("mongoose");

const InProgressCropSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  buyerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  farmerID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  cropID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Crop",
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  sent: {
    type: Boolean,
    default: 0,
  },
});

InProgress = mongoose.model("InProgress", InProgressCropSchema);
module.exports = InProgress;
