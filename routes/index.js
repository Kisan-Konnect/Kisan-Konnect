const express = require("express");
const mongoose = require("mongoose");
const assert = require("assert");
const router = express.Router();
const { ensureFarmerAuthenticated } = require("../config/auth");
const bodyParser = require("body-parser");
const path = require("path");
var Grid = require("gridfs-stream");
const GridFsStorage = require("multer-gridfs-storage");
const multer = require("multer");
const crypto = require("crypto");
const conn = mongoose.connection;
const mongoURI = require("../config/keys").MongoURI;
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = file.filename;
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
        };
        resolve(fileInfo);
      });
    });
  },
});
const upload = multer({ storage });
router.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "farmer") {
      res.redirect("/farmer/dashboard");
    }
    if (req.user.role == "buyer") {
      res.redirect("/buyer/dashboard");
    }
  } else {
    res.render("welcome", { req: req });
  }
});
let gfs;
conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
  console.log("Connection Successful");
});
module.exports = router;
