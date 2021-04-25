const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  cropID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Crop",
  },
  quantity: {
    type: Number,
    required: true,
  },
  buyerID: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  price: {
    type: Number,
    required: true,
  },
});

const Transaction = mongoose.model("Transaction", TransactionSchema);
module.exports = Transaction;
