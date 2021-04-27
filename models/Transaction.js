const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  cropID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Crop",
  },
  farmerID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  buyerID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  quantity: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: new Date(),
  },
  price: {
    type: Number,
    required: true,
  },
});

const Transaction = mongoose.model("Transaction", TransactionSchema);
module.exports = Transaction;
