const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  number: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  role: {
    type: String,
    enum: ["farmer", "buyer", "mod"],
    default: "farmer",
  },
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
