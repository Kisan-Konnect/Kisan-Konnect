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

const findDocuments = function (db, callback) {
  // Get the documents collection
  const collection = db.collection(collectionName);
  // Find some documents
  collection.find({}).toArray(function (err, docs) {
    assert.equal(err, null);
    files = docs;
    //console.log("Found the following records");
    //console.log(docs);
    callback(docs);
  });
};

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

// router.get("/images", (req, res) => {
//   gfs.files.find({}).toArray(function (err, files) {
//     a = [];
//     if (err) console.error(err);
//     files
//       .forEach(function (file) {
//         // console.log(file);
//         if (!file || file.length === 0) {
//           return res.status(404).json({ err: "No file exists" });
//         } // Check if image
//         if (
//           file.contentType === "image/jpeg" ||
//           file.contentType === "image/png"
//         ) {
//           // Read output to browser
//           const readstream = gfs.createReadStream(file.filename);
//           readstream.on("data", (chunk) => {
//             var ret = chunk.toString("base64");
//             a.push(ret);
//             //console.log("RET", ret);
//           });
//           //console.log(readstream);
//         } else {
//           res.status(404).json({ err: "Not an image" });
//         }
//       })
//       .then(() => {
//         res.render("imagesPage", { items: a });
//       });
//   });
// });

// router.get("/files/:filename", (req, res) => {
//   gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
//     // Check if file
//     if (!file || file.length === 0) {
//       return res.status(404).json({ err: "No file exists" });
//     } // Check if image
//     if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
//       // Read output to browser
//       const readstream = gfs.createReadStream(file.filename);
//       readstream.on("data", (chunk) => {
//         return chunk.toString("base64");
//       });
//       //console.log(readstream);
//     } else {
//       res.status(404).json({ err: "Not an image" });
//     }
//   });
// });
// // router.post("/images", upload.single("image"), (req, res, next) => {
// //   console.log(req.file);
// //   var obj = {
// //     name: req.body.name,
// //     desc: req.body.desc,
// //     img: {
// //       data: fs.readFileSync(
// //         path.join(__dirname + "/uploads/" + req.file.originalname)
// //       ),
// //       contentType: "image/png",
// //     },
// //   };
// //   imgModel.save(obj, (err, item) => {
// //     if (err) {
// //       console.log(err);
// //     } else {
// //       // item.save();
// //       res.redirect("/images");
// //     }
// //   });
// // });

// router.post("/images", upload.single("image"), (req, res, next) => {
//   res.redirect("/images");
// });

// Post = (e) => {
//   e.preventDefault();
//   const file = document.getElementById("inputGroupFile01").files;
//   const formData = new FormData();
//   formData.append("img", file[0]);
//   fetch("http://localhost:5000/", { method: "POST", body: formData }).then(
//     (r) => {
//       console.log(r);
//     }
//   );
//   console.log(file[0]);
// };

module.exports = router;
