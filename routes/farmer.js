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

function getImg(doc) {
  var filename = doc._id.toString();
  var buffer = "";
  return new Promise((resolve, reject) => {
    gfs.find({ filename: filename }).toArray((gfserr, files) => {
      if (!files[0] || files.length === 0) {
        console.log("FILE NOT FOUND");
        resolve(null);
      } else {
        const readStream = gfs.openDownloadStreamByName(files[0].filename);
        var img = "";
        readStream.on("data", (chunk) => {
          img += chunk.toString("base64");
        });
        readStream.on("end", () => {
          resolve(img);
        });
      }
    });
  });
}

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
      res.render("userWelcome", { req: req, role: 'farmer' });
    }
  } else {
    res.render("userWelcome", { req: req, role: 'farmer' });
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
      res.render("Login", { req: req, role: "farmer" });
    }
  } else {
    res.render("Login", { req: req, role: "farmer" });
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
      res.render("register", { req: req, role: "farmer" });
    }
  } else {
    res.render("register", { req: req, role: "farmer" });
  }
});
function handleFarmerRegister(name, number, password, password2, address) {
  let errors = [];

  // Check all fields are filled
  if (!name) {
    errors.push({ msg: "Please fill in your name!" });
  }
  if (!number || number.length !== 10) {
    errors.push({ msg: "Please fill in a valid phone number!" });
  }
  if (!password) {
    errors.push({ msg: "Please fill in your password!" });
  }
  if (!password2) {
    errors.push({ msg: "Please confirm your password!" });
  }
  if (!address) {
    errors.push({ msg: "Please enter your address!" });
  }

  // Check passwords match
  if (password !== password2) {
    errors.push({ msg: "Passwords dont match" });
  }
  //Length of password
  if (password.length < 6) {
    errors.push({ msg: "Password should be at least 6 characters" });
  }
  return Promise.resolve(errors);
}

router.post("/register", (req, res) => {
  const name = req.body.name.toString();
  const number = req.body.number.toString();
  const password = req.body.password.toString();
  const password2 = req.body.password2.toString();
  const address = req.body.address.toString();
  handleFarmerRegister(name, number, password, password2, address).then(
    (errors) => {
      if (errors.length > 0) {
        res.render("register", {
          errors: errors,
          name: name,
          number: number,
          password: "",
          password2: "",
          address: address,
          req: req,
          role: "farmer",
        });
      } else {
        var number_query = { number: number.toString(), role: "farmer" };
        Farmers.findOne(number_query, (err, obj) => {
          if (obj) {
            console.log(obj);
            // If Found, Display error Message
            errors.push({ msg: "Farmer Already Exists!" });
            res.render("register", {
              errors: errors,
              name: name,
              number: number,
              password: "",
              password2: "",
              address: address,
              req: req,
              role: "farmer",
            });
          } else {
            const newFarmer = Farmers({
              name: name,
              number: number,
              password: password,
              role: "farmer",
              address: address,
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
      }
    }
  );
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
        res.render("farmerCreateListing", {
          req: req,
          func: "create",
          name: "",
          quantity: null,
          price: null,
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
  res.render("uploadImage", { cropID: req.params.cropID, func: "create", req:req });
});
router.post("/upload_image/:cropID", upload.single("image"), (req, res) => {
  res.redirect("/farmer/currentlistings");
});
router.post("/editimage/:cropID", upload.single("image"), (req, res) => {
  gfs.find({ filename: req.params.cropID }).toArray((err, images) => {
    if (!images[0] || images.length === 0) {
    } else {
      if (images.length == 2) {
        var d1 = new Date(images[0].uploadDate);
        var d2 = new Date(images[1].uploadDate);
        if (d1 < d2) {
          gfs
            .delete(new mongoose.Types.ObjectId(images[0]._id))
            .then((err, image) => {
              if (err) {
                return res.status(404).json({ err: err });
              }
            });
        } else {
          gfs
            .delete(new mongoose.Types.ObjectId(images[1]._id))
            .then((err, image) => {
              if (err) {
                return res.status(404).json({ err: err });
              }
            });
        }
      }
    }
  });
  res.redirect("/");
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
        const name = req.body.name.toString();
        const quantity = parseInt(req.body.quantity);
        const price = parseInt(req.body.price);
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
            var crop = {
              name: name,
              price: price,
              quantity: quantity,
            };
            Crops.findByIdAndUpdate(req.params.cropID, crop)
              .then((crop, err) => {
                if (err) {
                  console.log("ERROR: ", err);
                  return;
                }
                res.render("uploadImage", { cropID: crop._id, func: "edit", req: req });
              })
              .catch((err) => console.error(err));
          }
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
async function findListingsOfUser(Model, uid, Model1) {
  return new Promise((resolve, reject) => {
    a = [];
    var result;
    Model.find().then(async (docs) => {
      for (i = 0; i < docs.length; i++) {
        doc = docs[i];
        let crop;
        try {
          crop = await Crops.findById(doc.cropID);
        } catch (err) {
          console.error(err);
        }
        if (crop) {
          let buyer = await Model1.findById(crop.farmerID);
          var newdoc;
          if (Model == InProgress) {
            newdoc = {
              _id: doc._id,
              name: crop.name,
              price: doc.price,
              farmerID: crop.farmerID,
              buyerID: doc.buyerID,
              quantity: doc.quantity,
              date: doc.date,
              sent: doc.sent,
              buyerName: buyer.name,
            };
          } else {
            newdoc = {
              _d: doc._id,
              name: crop.name,
              price: doc.price,
              farmerID: crop.farmerID,
              buyerID: doc.buyerID,
              quantity: doc.quantity,
              date: doc.date,
              buyerName: buyer.name,
            };
          }
          await getImg(crop)
            .then((image) => {
              newdoc.image = image;
              a.push(newdoc);
            })
            .catch((getimgerr) => console.error(getimgerr));
        }
      }
      resolve(a);
    });
  });
}
router.get("/dashboard", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        findListingsOfUser(InProgress, req.user._id, Farmers)
          .then((crops) => {
            res.render("farmer", {
              crops: crops,
              req: req,
              title: "Dashboard",
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
        findListingsOfUser(Transaction, req.user._id, Farmers)
          .then((crops) => {
            res.render("farmer", {
              crops: crops,
              req: req,
              title: "History",
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
  var query = { farmerID: uid, available: true };
  return new Promise((resolve, reject) => {
    var a = [];
    Model.find(query).then(async (docs, err) => {
      for (i = 0; i < docs.length; i++) {
        var newdoc = docs[i];
        await getImg(newdoc)
          .then((image) => {
            newdoc.image = image;
            a.push(newdoc);
          })
          .catch((getimgerr) => console.error(getimgerr));
      }
      resolve(a);
    });
  }).catch((promiseerr) => console.error(promiseerr));
}
router.get("/currentlistings", (req, res) => {
  authFarmer(req)
    .then((isAuthFarmer) => {
      if (isAuthFarmer) {
        getCurrentListings(Crops, req.user._id).then((crops) => {
          res.render("farmer", {
            req: req,
            crops: crops,
            title: "Current Listings",
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
            if (
              crop.farmerID == req.user._id.toString() &&
              crop.available == 1
            ) {
              Crops.findByIdAndDelete(req.params.cropID)
                .then((deletedCrop, obj) => {
                  gfs
                    .find({ filename: req.params.cropID })
                    .toArray((err, image) => {
                      if (!image[0] || image.length === 0) {
                        return res.redirect("/farmer/currentlistings");
                      } else {
                        gfs
                          .delete(new mongoose.Types.ObjectId(image[0]._id))
                          .then((err, data) => {
                            return res.redirect("/farmer/currentlistings");
                          });
                      }
                    });
                })
                .catch((delerr) => {
                  console.error(delerr);
                });
            } else {
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
