const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const Crops = require("../models/Crop");
const Buyers = require("../models/User");
const Transaction = require("../models/Transaction");
const InProgress = require("../models/InProgress");
const { find } = require("../models/Crop");
var Grid = require("gridfs-stream");
const conn = mongoose.connection;

router.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") res.redirect("/buyer/dashboard");
    else if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else {
      req.flash(
        "error_msg",
        "Please log out as a " + req.user.role + " to view this resource "
      );
      res.render("buyerWelcome", { req: req });
    }
  } else {
    res.render("buyerWelcome", { req: req });
  }
});

// Login Page
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      res.redirect("buyer/dashboard");
    } else if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else {
      req.flash(
        "error_msg",
        "Please log out as a " + req.user.role + " to view this resource "
      );
      res.render("buyerLogin", { req: req });
    }
  } else {
    res.render("buyerLogin", { req: req });
  }
});

// Register Page
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      res.redirect("buyer/dashboard");
    } else if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else {
      req.flash(
        "error_msg",
        "Please log out as a " + req.user.role + " to view this resource "
      );
      res.render("buyerRegister", { req: req });
    }
  } else {
    res.render("buyerRegister", { req: req });
  }
});
function handleRegisterErrors(
  name,
  email,
  password,
  password2,
  number,
  address
) {
  let errors = [];

  // Check all fields are filled
  if (!name) {
    errors.push({ msg: "Please fill in your Name!" });
  }
  if (!email) {
    errors.push({ msg: "Please fill in your Email!" });
  }
  if (!password) {
    errors.push({ msg: "Please fill in your Password!" });
  }
  if (!password2) {
    errors.push({ msg: "Please Comfirm your Password!" });
  }
  if (!number) {
    errors.push({ msg: "Please fill in your Contact Details details!" });
  }
  if (!address) {
    errors.push({ msg: "Please fill in your Address!" });
  }

  // Check passwords match
  if (password !== password2) {
    errors.push({ msg: "Passwords dont match" });
  }
  //Length of password
  if (password.length < 6) {
    errors.push({ msg: "Password should be at least 6 characters" });
  }
  //Length of contact
  if (number.length != 10) {
    errors.push({ msg: "Contact number should be 10 digit long" });
  }
  return Promise.resolve(errors);
}
//Register Handel
router.post("/register", (req, res) => {
  const name = req.body.name.toString();
  const email = req.body.email.toString();
  const password = req.body.password.toString();
  const password2 = req.body.password2.toString();
  const number = req.body.number.toString();
  const address = req.body.address.toString();
  handleRegisterErrors(name, email, password, password2, number, address).then(
    (errors) => {
      if (errors.length > 0) {
        res.render("buyerRegister", {
          errors,
          name,
          email,
          password,
          password2,
          number,
          address,
          req: req,
        });
      } else {
        var email_query = { email: email.toString(), role: "buyer" };
        Buyers.findOne(email_query, (err, obj) => {
          if (obj) {
            console.log(obj);
            // If Found, Display error Message
            errors.push({ msg: "Buyer Already Exists!" });
            res.render("buyerRegister", {
              errors,
              name,
              email,
              password,
              password2,
              req: req,
            });
          } else {
            const newBuyer = Buyers({
              name,
              email,
              password,
              address,
              phone: number,
              role: "buyer",
            });
            bcrypt.genSalt(10, (err, salt) =>
              bcrypt.hash(newBuyer.password, salt, (err1, hash) => {
                if (err1) throw err1; // set password to the hash value of password
                newBuyer.password = hash; // save user details to db
                newBuyer
                  .save()
                  .then((user_temp) => {
                    req.flash(
                      "success_msg",
                      `Registration successful, Welcome ${newBuyer.name}`
                    );
                    res.redirect("/buyer/login");
                  })
                  .catch((err_new) => console.log(err_new));
              })
            );
          }
        }).catch((finderr) => console.error(finderr));
      }
    }
  );
});

//Login Handel
router.post("/login", (req, res, next) => {
  passport.authenticate("buyerLocal", {
    successRedirect: "/buyer/dashboard",
    failureRedirect: "/buyer/login",
    failureFlash: true,
  })(req, res, next);
});

//logout handel
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success_msg", "You are logged out");
  res.redirect("/buyer/login");
});

var gfs;
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
function findListings(Model, Model1, uid = null) {
  return new Promise((resolve, reject) => {
    var a = [];
    Model.find({ available: true }).then(async (crops) => {
      for (i = 0; i < crops.length; i++) {
        var doc = crops[i];
        var farmer = await Model1.findById(doc.farmerID);
        var newdoc = {
          _id: doc._id,
          name: doc.name,
          price: doc.price,
          quantity: doc.quantity,
          farmerID: doc.farmerID,
          date: doc.date,
          __v: 0,
        };
        newdoc.farmerName = farmer.name;
        await getImg(newdoc)
          .then((image) => {
            newdoc.image = image;
            a.push(newdoc);
          })
          .catch((getimgerr) => console.error(getimgerr));
      }
      resolve(a);
    });
  });
}

router.get("/listing", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      findListings(Crops, Buyers)
        .then((crops) => {
          res.render("buyerListing", { crops: crops, req: req });
        })
        .catch((err) => console.error(err));
    } else if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else {
      req.flash("error_msg", "Please log in to view this resource ");
      res.redirect("/buyer/login");
    }
  } else {
    req.flash("error_msg", "Please log in to view this resource ");
    res.redirect("/buyer/login");
  }
});

async function findListingsOfUser(Model, uid, Model1) {
  return new Promise((resolve, reject) => {
    a = [];
    var result;
    var query = { buyerID: uid };
    Model.find(query).then(async (docs) => {
      for (i = 0; i < docs.length; i++) {
        doc = docs[i];
        let crop = await Crops.findById(doc.cropID);
        let farmer = await Model1.findById(crop.farmerID);
        var newdoc;
        if (Model == InProgress) {
          newdoc = {
            _id: doc._id,
            name: crop.name,
            price: doc.price,
            farmerName: farmer.name,
            farmerID: crop.farmerID,
            buyerID: doc.buyerID,
            quantity: doc.quantity,
            date: doc.date,
            sent: doc.sent,
          };
        } else {
          newdoc = {
            _id: doc._id,
            name: crop.name,
            price: doc.price,
            farmerName: farmer.name,
            farmerID: crop.farmerID,
            buyerID: doc.buyerID,
            quantity: doc.quantity,
            date: doc.date,
          };
        }
        await getImg(crop)
          .then((image) => {
            newdoc.image = image;
            a.push(newdoc);
          })
          .catch((getimgerr) => console.error(getimgerr));
      }
      resolve(a);
    });
  });
}
router.get("/dashboard", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      //QUERY IN PROGRESS
      findListingsOfUser(InProgress, req.user._id, Buyers)
        .then((crops) => {
          // console.log(crops);
          res.render("buyerListing", {
            crops: crops,
            req: req,
            history: "Dashboard",
          });
        })
        .catch((err) => console.error(err));

      //make into html
      //RENDER
    } else if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else {
      req.flash("error_msg", "Please log in to view this resource ");
      res.redirect("/buyer/login");
    }
  } else {
    req.flash("error_msg", "Please log in to view this resource ");
    res.redirect("/buyer/login");
  }
});

router.get("/history", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      //QUERY IN PROGRESS
      findListingsOfUser(Transaction, req.user._id)
        .then((crops) => {
          //console.log(crops);
          res.render("buyerDashboard", {
            crops: crops,
            req: req,
            history: "History",
          });
        })
        .catch((err) => console.error(err));

      //make into html
      //RENDER
    } else if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else {
      req.flash("error_msg", "Please log in to view this resource ");
      res.redirect("/buyer/login");
    }
  } else {
    req.flash("error_msg", "Please log in to view this resource ");
    res.redirect("/buyer/login");
  }
});

router.get("/buy/:trxID", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      //QUERY AVAIL
      Crops.findByIdAndUpdate(req.params.trxID, {
        available: false,
        quantity: 0,
      }).then((crop) => {
        var inProgress = new InProgress({
          cropID: crop._id,
          buyerID: req.user._id,
          quantity: crop.quantity,
          price: crop.price,
          sent: false,
        });
        inProgress
          .save()
          .then(() => {
            res.redirect("/");
          })
          .catch((err) => {
            console.error(err);
          });
      });
    } else if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else {
      req.flash(
        "error_msg",
        "Please log out as " +
          req.user.role +
          " and login as buyer to view this resource "
      );
      res.redirect("/buyer/login");
    }
  } else {
    req.flash("error_msg", "Please log in to view this resource ");
    res.redirect("/buyer/login");
  }
});
router.get("/receive/:trxID", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      //QUERY AVAIL
      InProgress.findByIdAndDelete(req.params.trxID).then((crop) => {
        var transaction = new Transaction({
          cropID: crop.cropID,
          buyerID: crop.buyerID,
          quantity: crop.quantity,
          price: crop.price,
        });
        transaction
          .save()
          .then(() => {
            res.redirect("/");
          })
          .catch((err) => {
            console.error(err);
          });
      });
    } else if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
    else {
      req.flash(
        "error_msg",
        "Please log out as " +
          req.user.role +
          " and login as buyer to view this resource "
      );
      res.redirect("/buyer/login");
    }
  } else {
    req.flash("error_msg", "Please log in to view this resource ");
    res.redirect("/buyer/login");
  }
});
module.exports = router;
