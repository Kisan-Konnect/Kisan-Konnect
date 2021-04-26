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
const Complaints = require("../models/Complaints");
const conn = mongoose.connection;

function authBuyer(req) {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      return Promise.resolve(true);
    }
  }
  return Promise.resolve(false);
}

function nonBuyerRedirects(req, res){
  if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
  else if (req.user.role == "mod") res.redirect("/moderator/dashboard");
  else {
    req.flash(
      "error_msg",
      "Please log in as a Buyer to view this resource "
    );
    res.redirect("/buyer/login")
  }
}
router.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") res.redirect("/buyer/dashboard");
    else nonBuyerRedirects(req, res);
  } else {
    res.render("userWelcome", { req: req, role: "buyer" });
  }
});

// Login Page
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      res.redirect("/buyer/dashboard");
    } else nonBuyerRedirects(req, res);
  } else {
    res.render("login", { req: req, role: "buyer" });
  }
});

// Register Page
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      res.redirect("/buyer/dashboard");
    } else nonBuyerRedirects(req, res);
  } else {
    res.render("register", { req: req, role: "buyer" });
  }
});
function handleRegisterErrors(name, password, password2, number, address) {
  let errors = [];

  // Check all fields are filled
  if (!name) {
    errors.push({ msg: "Please fill in your Name!" });
  }
  if (!password) {
    errors.push({ msg: "Please fill in your Password!" });
  }
  if (!password2) {
    errors.push({ msg: "Please Comfirm your Password!" });
  }
  if (!number || number.length != 10) {
    errors.push({ msg: "Please fill in valid Contact Details!" });
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
  const password = req.body.password.toString();
  const password2 = req.body.password2.toString();
  const number = req.body.number.toString();
  const address = req.body.address.toString();
  //console.log("ADDRESSSS", address);
  handleRegisterErrors(name, password, password2, number, address).then(
    (errors) => {
      if (errors.length > 0) {
        res.render("register", {
          errors: errors,
          name: name,
          password: "",
          password2: "",
          number: number,
          address: address,
          req: req,
          role: "buyer",
        });
      } else {
        var number_query = { number: number.toString(), role: "buyer" };
        Buyers.findOne(number_query, (err, obj) => {
          if (obj) {
            console.log(obj);
            // If Found, Display error Message
            errors.push({ msg: "Buyer Already Exists!" });
            res.render("register", {
              errors: errors,
              name: name,
              password: "",
              password2: "",
              req: req,
              address: address,
              role: "buyer",
            });
          } else {
            const newBuyer = Buyers({
              name: name,
              password: password,
              address: address,
              number: number,
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

function getImg(id) {
  var filename = id.toString();
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
        await getImg(newdoc._id)
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
          res.render("buyer", {
            crops: crops,
            req: req,
            title: "Marketplace",
          });
        })
        .catch((err) => console.error(err));
    } else nonBuyerRedirects(req, res);
  } else {
    req.flash("error_msg", "Please log in to view this resource ");
    res.redirect("/buyer/login");
  }
});

async function findListingsOfUser(Model, uid, Model1) {
  return new Promise((resolve, reject) => {
    a = [];
    var query = { buyerID: uid };
    Model.find(query).then(async (docs) => {
      for (i = 0; i < docs.length; i++) {
        doc = docs[i];
        console.log(doc);
        let farmer = await Model1.findById(doc.farmerID);
        var newdoc;
        if (Model == InProgress) {
          newdoc = {
            _id: doc._id,
            name: doc.name,
            price: doc.price,
            farmerName: farmer.name,
            farmerID: doc.farmerID,
            buyerID: doc.buyerID,
            quantity: doc.quantity,
            date: doc.date,
            sent: doc.sent,
            cropID: doc.cropID,
          };
        } else {
          newdoc = {
            _id: doc._id,
            name: doc.name,
            price: doc.price,
            farmerName: farmer.name,
            farmerID: doc.farmerID,
            buyerID: doc.buyerID,
            quantity: doc.quantity,
            date: doc.date,
            cropID: doc.cropID,
          };
        }
        await getImg(newdoc.cropID)
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

function handleRender(req, res, title, Model){
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      //QUERY IN PROGRESS
      findListingsOfUser(Model, req.user._id, Buyers)
        .then((crops) => {
          // console.log(crops);
          res.render("buyer", {
            crops: crops,
            req: req,
            title: title,
          });
        })
        .catch((err) => console.error(err));

      //make into html
      //RENDER
    } else nonBuyerRedirects(req, res);
  } else {
    req.flash("error_msg", "Please log in to view this resource ");
    res.redirect("/buyer/login");
  }
}

router.get("/dashboard", (req, res) => {
  handleRender(req, res, "Dashboard", InProgress);
});

router.get("/history", (req, res) => {
  handleRender(req, res, "History", Transaction);
});

router.get("/buy/:trxID", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "buyer") {
      //QUERY AVAIL
      Crops.findByIdAndUpdate(req.params.trxID, {
        available: false,
      }).then((crop) => {
        var inProgress = new InProgress({
          name: crop.name,
          cropID: crop._id,
          buyerID: req.user._id,
          quantity: crop.quantity,
          price: crop.price,
          sent: false,
          farmerID: crop.farmerID,
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
    } else nonBuyerRedirects(req, res);
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
          name: crop.name,
          cropID: crop.cropID,
          buyerID: crop.buyerID,
          quantity: crop.quantity,
          price: crop.price,
          farmerID: crop.farmerID,
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
    } else nonBuyerRedirects(req, res);
  } else {
    req.flash("error_msg", "Please log in to view this resource ");
    res.redirect("/buyer/login");
  }
});

router.get('/raisecomplaint/:cropID', (req, res) => {
  authBuyer(req)
    .then((isAuthBuyer) => {
      if (isAuthBuyer) {
        var query = {cropID: req.params.cropID}
        InProgress.findOne(query)
          .then((inprog) => {
            if(!inprog){
              res.redirect("/buyer/dashboard");
            }
            else if (inprog.buyerID.toString() == req.user._id.toString()){
                Buyers.findById(inprog.farmerID).then((farmer) => {
                  res.render("raiseComplaint", {req:req, user:farmer, crop:inprog});
              })
            }
            else{
              console.log("buyer is auth but not crop", inprog, req.user);
              res.redirect("/farmer/dashboard")
            }
          }).catch((err) => {
            console.error(err)
            res.redirect("/buyer/dashboard")
          });
      }
      else{
        res.redirect("/buyer/login")
      }
    }).catch((autherr) => console.error(autherr));
})

router.post('/raisecomplaint/:cropID', (req, res) => {
  authBuyer(req)
    .then((isAuthBuyer) => {
      if (isAuthBuyer) {
        var reason = req.body.complaint.toString();
        var cropID = req.params.cropID;
        var complainerID = req.user._id;
        var complainerRole = req.user.role;
        InProgress.findOne({cropID: req.params.cropID}).then((inprog)=>{
          if(inprog){
            var complaint = new Complaints({
              reason: reason,
              cropID: cropID,
              complainerID: complainerID,
              complainerRole: complainerRole,
              complainAgainstID: inprog.buyerID,
            })
            complaint.save().then(() => {
              res.redirect("/buyer/dashboard");
            }).catch((err) => {
              console.error(err);
              res.redirect("/buyer/dashboard");
            })
          }
          else{
            console.log("Can't find Bought Crop");
            res.redirect("/farmer/dashboard");
          }
        }) .catch((err) => {
          console.error(err);
          res.redirect("/buyer/dashboard");
        })       
      }else{
        res.redirect("/buyer/login")
      }
    }).catch((autherr) => console.error(autherr));
  
})

module.exports = router;
