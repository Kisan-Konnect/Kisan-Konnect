const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const Crops = require("../models/Crop");
const Transaction = require("../models/Transaction");
const InProgress = require("../models/InProgress");
const Farmers = require("../models/User");

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
        const filename = req.params.cropID;
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

let gfs;

conn.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads",
  });
});

function authFarmer(req) {
  if (req.isAuthenticated()) {
    if (req.user.role == "farmer") {
      return Promise.resolve(true);
    } else {
      return False;
    }
  }
  return Promise.resolve(false);
}
router.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else if (req.user.role == "buyer") res.redirect("/buyer/dashboard");
    else {
      req.flash(
        "error_msg",
        "Please log in as a farmer to view this resource "
      );
      res.render("farmerWelcome", { req: req });
    }
  } else {
    res.render("farmerWelcome", { req: req });
  }
});
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else if (req.user.role == "buyer") res.redirect("/buyer/dashboard");
    else {
      req.flash(
        "error_msg",
        "Please log out as a " + req.user.role + " to view this resource "
      );
      res.render("farmerLogin", { req: req });
    }
  } else {
    res.render("farmerLogin", { req: req });
  }
});
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else if (req.user.role == "buyer") res.redirect("/buyer/dashboard");
    else {
      req.flash(
        "error_msg",
        "Please log out as a " + req.user.role + " to view this resource "
      );
      res.render("farmerRegister", { req: req });
    }
  } else {
    res.render("farmerRegister", { req: req });
  }
});
router.post("/register", (req, res) => {
  const name = req.body.name.toString();
  const email = req.body.email.toString();
  const password = req.body.password.toString();
  const password2 = req.body.password2.toString();
  let errors = [];

  // Check all fields are filled
  if (!name || !email || !password || !password2) {
    errors.push({ msg: "Please fill in all details!" });
  }

  // Check passwords match
  if (password !== password2) {
    errors.push({ msg: "Passwords dont match" });
  }
  //Length of password
  if (password.length < 6) {
    errors.push({ msg: "Password should be at least 6 characters" });
  }

  if (errors.length > 0) {
    res.render("farmerRegister", {
      errors,
      name,
      email,
      password,
      password2,
      req: req,
    });
  } else {
    var email_query = { email: email.toString(), role: "farmer" };
    Farmers.findOne(email_query, (err, obj) => {
      if (obj) {
        console.log(obj);
        // If Found, Display error Message
        errors.push({ msg: "Farmer Already Exists!" });
        res.render("farmerRegister", {
          errors,
          name,
          email,
          password,
          password2,
          req: req,
        });
      } else {
        const newFarmer = Farmers({
          name,
          email,
          password,
          role: "farmer",
        });
        bcrypt.genSalt(10, (err2, salt) =>
          bcrypt.hash(newFarmer.password, salt, (err1, hash) => {
            if (err1) throw err1;

            // set password to the hash value of password
            newFarmer.password = hash;

            // save user details to db
            newFarmer
              .save()
              .then((user_temp) => {
                req.flash(
                  "success_msg",
                  `Registration successful, Welcome ${newFarmer.name}`
                );
                res.redirect("/farmer/login");
              })
              .catch((err_new) => console.log(err_new));
          })
        );
      }
    });
    //  .then((user) => {

    //.catch((err) => console.error(err));
  }
});
router.post("/login", (req, res, next) => {
  passport.authenticate("farmerLocal", {
    successRedirect: "/farmer/dashboard",
    failureRedirect: "/farmer/login",
    failureFlash: true,
  })(req, res, next);
});
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success_msg", "You are logged out");
  res.redirect("/");
});
router.get("/createlisting", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        res.render("farmerCreateListing", { req: req, func: "create" });
      } else {
        req.flash(
          "error_msg",
          "Please log out as a Farmer to view this resource "
        );
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => {
      console.error(autherr);
    });
});

router.get("/editlisting/:cropID", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        Crops.findById(req.params.cropID).then((crop) => {
          name = crop.name;
          quantity = crop.quantity;
          price = crop.price;
          res.render("farmerCreateListing", {
            req: req,
            func: "edit",
            price: price,
            quantity: quantity,
            name: name,
            cropID: req.params.cropID,
          });
        });
      } else {
        req.flash(
          "error_msg",
          "Please log out as a Farmer to view this resource "
        );
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => {
      console.error(autherr);
    });
});

function handleCreateListingErrors(name, quantity, price, image) {
  let errors = [];

  // Check all fields are filled
  // if (!image) {
  //   errors.push({ msg: "Please give an image!" });
  // }
  if (!name) {
    errors.push({ msg: "Please enter crop name!" });
  }
  if (!quantity) {
    errors.push({ msg: "Please enter crop quantity (in KGs)!" });
  }
  if (!price) {
    errors.push({ msg: "Please enter your price!" });
  }
  // Check passwords match
  if (quantity <= 0.1) {
    errors.push({
      msg: "Increase Quantity (Given Quantitiy is too low need atleast 0.1])",
    });
  }
  //Length of password
  if (price <= 0) {
    errors.push({ msg: "Enter Valid Price (Price cannot be negative or 0)" });
  }
  return Promise.resolve(errors);
}

router.get("/upload_image/:cropID", (req, res) => {
  res.render("uploadImage", { cropID: req.params.cropID, func: "create" });
});

router.post("/upload_image/:cropID", upload.single("image"), (req, res) => {
  res.redirect("/farmer/dashboard");
});

router.post("/editimage/:cropID", upload.single("image"), (req, res) => {
  gfs.find({ filename: req.params.cropID }).toArray((err, images) => {
    if (!images[0] || images.length === 0) {
      res.redirect("/farmer/currentlistings/");
    } else {
      if (images.length == 2) {
        var d1 = new Date(images[0].uploadDate);
        var d2 = new Date(images[1].uploadDate);
        console.log("DATE 0: ", d1);
        console.log("DATE 1: ", d2);
        if (d1 < d2) {
          gfs
            .delete(new mongoose.Types.ObjectId(images[0]._id))
            .then((err, image) => {
              if (err) {
                return res.status(404).json({ err: err });
              }
              res.redirect("/farmer/currentlistings/");
            });
        } else {
          gfs
            .delete(new mongoose.Types.ObjectId(images[1]._id))
            .then((err, image) => {
              if (err) {
                return res.status(404).json({ err: err });
              }
              res.redirect("/farmer/currentlistings/");
            });
        }
      }
    }
  });
  res.redirect("/farmer/currentlistings/");
});

router.post("/createlisting", async (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        // console.log("REDDDDDDDDDDDDDDDDDDDQQQQQQQQQQQQQQQQQ", req);
        //var imggg = new Buffer.from(req.image, "base64");
        //console.log("FIODUBVOIDUVBC", imggg);
        const name = req.body.name.toString();
        const quantity = parseInt(req.body.quantity);
        const price = parseInt(req.body.price);
        // const image = req.body.image.toString("base64");
        // console.log(image);
        // console.log("IMAGGGGGEEEEEE");
        handleCreateListingErrors(name, quantity, price).then((errors) => {
          if (errors.length > 0) {
            res.render("farmerCreateListing", {
              errors,
              name,
              price,
              quantity,
              func: "create",
              req: req,
            });
          } else {
            console.log("CREATING CROPPPPPP!!!!");
            //console.log(image);
            var crop = new Crops({
              name: name,
              price: price,
              quantity: quantity,
              farmerID: req.user._id,
            });
            crop
              .save()
              .then((user) => {
                //do nothing
                console.log("Saved Successfully");
                res.redirect("/farmer/upload_image/" + crop._id.toString());
              })
              .catch((err) => console.error(err));
          }
          // res.redirect("/farmer/upload_image/" + crop._id);
        });
      } else {
        req.flash(
          "error_msg",
          "Please log in as Farmer to view this resource "
        );
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => {
      console.error(autherr);
    });
});

router.post("/editlisting/:cropID", async (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        // console.log("REDDDDDDDDDDDDDDDDDDDQQQQQQQQQQQQQQQQQ", req);
        //var imggg = new Buffer.from(req.image, "base64");
        //console.log("FIODUBVOIDUVBC", imggg);
        const name = req.body.name.toString();
        const quantity = parseInt(req.body.quantity);
        const price = parseInt(req.body.price);
        console.log("NAMEEEEE: ", name);
        // const image = req.body.image.toString("base64");
        // console.log(image);
        // console.log("IMAGGGGGEEEEEE");
        handleCreateListingErrors(name, quantity, price).then((errors) => {
          if (errors.length > 0) {
            res.render("farmerCreateListing", {
              errors,
              name,
              price,
              quantity,
              func: "edit",
              cropID: req.params.cropID,
              req: req,
            });
          } else {
            //console.log("EDITINGGGG CROPPPPPP!!!!");
            //console.log(image);
            var crop = {
              name: name,
              price: price,
              quantity: quantity,
            };
            // console.log("IDDDDDD: ", req.params.cropID);
            Crops.findByIdAndUpdate(req.params.cropID, crop)
              .then((crop, err) => {
                if (err) {
                  console.log("ERROR: ", err);
                  return;
                }
                console.log("I'M HEREEEEE: ");
                res.render("uploadImage", { cropID: crop._id, func: "edit" });
              })
              .catch((err) => console.error(err));
          }
          // res.redirect("/farmer/upload_image/" + crop._id);
        });
      } else {
        req.flash(
          "error_msg",
          "Please log in as Farmer to view this resource "
        );
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => {
      console.error(autherr);
    });
});

async function findListingsOfUser(Model, uid) {
  var a = [];
  for await (const doc of Model.find()) {
    let query = { _id: doc.cropID, farmerID: uid };
    let crop = await Crops.findOne(query);
    if (crop) {
      let buyer = await Farmers.findById(doc.buyerID);
      if (Model == InProgress) {
        a.push({
          _id: doc._id,
          name: crop.name,
          price: doc.price,
          farmerID: crop.farmerID,
          buyerID: doc.buyerID,
          quantity: doc.quantity,
          date: doc.date,
          sent: doc.sent,
          buyerName: buyer.name,
        });
      } else {
        a.push({
          _id: doc._id,
          name: crop.name,
          price: doc.price,
          farmerID: crop.farmerID,
          buyerID: doc.buyerID,
          quantity: doc.quantity,
          date: doc.date,
          buyerName: buyer.name,
        });
      }
    }
  }
  return Promise.resolve(a);
}
router.get("/dashboard", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        findListingsOfUser(InProgress, req.user._id)
          .then((crops) => {
            res.render("farmerDashboard", {
              crops: crops,
              req: req,
              history: "Dashboard",
            });
          })
          .catch((err) => console.error(err));
      } else {
        req.flash("error_msg", "Please log in to view this resource ");
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => {
      console.error(autherr);
    });
});
router.get("/history", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        //QUERY IN PROGRESS
        findListingsOfUser(Transaction, req.user._id)
          .then((crops) => {
            res.render("farmerDashboard", {
              crops: crops,
              req: req,
              history: "History",
            });
          })
          .catch((err) => console.error(err));
      } else {
        req.flash("error_msg", "Please log in to view this resource ");
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => console.error(autherr));
});
async function getCurrentListings(Model, uid) {
  var a = [];
  var query = { farmerID: uid, available: true };
  for await (const doc of Model.find(query)) {
    a.push(doc);
  }
  return Promise.resolve(a);
}
router.get("/currentlistings", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        getCurrentListings(Crops, req.user._id).then((crops) => {
          res.render("farmerDashboard", {
            req: req,
            crops: crops,
            history: "Current Listings",
          });
        });
      } else {
        req.flash("error_msg", "Please log in to view this resource ");
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => {
      console.error(autherr);
    });
});
router.get("/deleteCurrent/:cropID", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        Crops.findById(req.params.cropID)
          .then((crop) => {
            console.log(crop.farmerID, req.user._id, crop.available);
            if (
              crop.farmerID == req.user._id.toString() &&
              crop.available == 1
            ) {
              Crops.findByIdAndDelete(req.params.cropID)
                .then((deletedCrop, obj) => {
                  // console.log("Deleted Crop", deletedCrop);
                  gfs
                    .find({ filename: req.params.cropID })
                    .toArray((err, image) => {
                      if (!image[0] || image.length === 0) {
                        console.log("NO IMAGEEEEEE");
                        return res.redirect("/farmer/currentlistings");
                      } else {
                        gfs
                          .delete(new mongoose.Types.ObjectId(image[0]._id))
                          .then((err, data) => {
                            console.log("DELETED IMAGEEEEEE");
                            return res.redirect("/farmer/currentlistings");
                          });
                      }
                    });
                })
                .catch((delerr) => {
                  console.error(delerr);
                });
            } else {
              console.log("FKEDDD");
              req.flash("error_msg", "You cant delete crop not owned by you!.");
              res.redirect("/farmer/login");
            }
          })
          .catch((finderr) => {
            console.error(finderr);
          });
      } else {
        req.flash("error_msg", "Please log in to view this resource ");
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => console.error(autherr));
});

router.post("/upload", (req, res) => {
  setTimeout(() => {
    console.log(req.body.image);
  }, 2000);
  // var base64ToBuffer = new Buffer.from(req.image, "base64"); //Convert to base64
  // console.log("IOUJNBSFDKIJBVCS", base64ToBuffer);
  //Write your insertcode of MongoDb

  // res.end("Image uploaded Successfully");
});

router.get("/upload", function (req, res) {
  res.render("test69");
});

router.get("/sent/:cropID", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        InProgress.findByIdAndUpdate(req.params.cropID, { sent: true }).then(
          (p) => {
            res.redirect("/farmer/dashboard");
          }
        );
      } else {
        req.flash("error_msg", "Please log in to view this resource ");
        res.redirect("/farmer/login");
      }
    })
    .catch((autherr) => console.error(autherr));
});
module.exports = router;
