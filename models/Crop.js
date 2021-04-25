var Crop

const mongoose = require("mongoose");

const CropSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  farmerID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  price:{
    type: Number,
    required: true,
  },
  available:{
    type: Number,
    required:true,
    default:true,
  },
});

Crop = mongoose.model("Crop", CropSchema);
module.exports = Crop;
