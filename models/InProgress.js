var InProgressCrop;

const mongoose = require("mongoose");

const InProgressCropSchema = new mongoose.Schema({
  buyerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
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

InProgressCrop = mongoose.model("InProgress", InProgressCropSchema);
module.exports = InProgressCrop;
