const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const Crops = require("../models/Crop");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const InProgress = require("../models/InProgress");
const { find } = require("../models/Crop");
var Grid = require("gridfs-stream");
const Complaints = require("../models/Complaints");
const conn = mongoose.connection;

var gfs;
conn.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads",
  });
});

function authMod(req) {
  if (req.isAuthenticated()) {
    if (req.user.role == "moderator") {
      return Promise.resolve(true);
    }
  }
  return Promise.resolve(false);
}

router.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "moderator") res.redirect("/moderator/dashboard");
    else redirects(req, res);
  } else {
    res.render("userWelcome", { req: req, role: "moderator" });
    //dfoibjnbdfkibjndscfbcsdlvkopnsdvplkmsc l;pknksdgopmsdvplo
  }
});

function redirects(req, res){
  if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
  else if (req.user.role == "buyer") res.redirect("/buyer/dashboard");
  else {
    req.flash(
      "error_msg",
      "Please log in as a Moderator to view this resource "
    );
    res.redirect("/moderator/login")
  }
}

// Login Page
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "moderator") {
      res.redirect("/moderator/dashboard");
    } else redirects(req, res);
  } else {
    res.render("login", { req: req, role: "moderator" });
  }
});

// Register Page
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "moderator") {
      console.log("HEREEEEEEEEE!!!!!!!!!!!");
      res.redirect("/moderator/dashboard");
    } else redirects(req, res);
  } else {
    res.render("register", { req: req, role: "moderator" });
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
  // console.log("ADDRESSSS", address);
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
          role: "moderator",
        });
      } else {
        var number_query = { number: number.toString(), role: "moderator" };
        User.findOne(number_query, (err, obj) => {
          if (obj) {
            console.log(obj);
            // If Found, Display error Message
            errors.push({ msg: "Moderator Already Exists!" });
            res.render("register", {
              errors: errors,
              name: name,
              password: "",
              password2: "",
              req: req,
              address: address,
              role: "moderator",
            });
          } else {
            const newMod = User({
              name: name,
              password: password,
              address: address,
              number: number,
              role: "moderator",
            });
            bcrypt.genSalt(10, (err, salt) =>
              bcrypt.hash(newMod.password, salt, (err1, hash) => {
                if (err1) throw err1; // set password to the hash value of password
                newMod.password = hash; // save user details to db
                newMod
                  .save()
                  .then((user_temp) => {
                    req.flash(
                      "success_msg",
                      `Registration successful, Welcome ${newMod.name}`
                    );
                    res.redirect("/moderator/login");
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
  passport.authenticate("modLocal", {
    successRedirect: "/moderator/dashboard",
    failureRedirect: "/moderator/login",
    failureFlash: true,
  })(req, res, next);
});

//logout handel
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success_msg", "You are logged out");
  res.redirect("/moderator/login");
});

router.get("/dashboard", (req, res) => {
  getComplaints().then((complaints) => {
    console.log(complaints);
    res.render("modViewComplaints", {req: req, complaints: complaints});
  })
})
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

function getComplaints() {
  return new Promise((resolve, reject) => {
    var comps = [];
    Complaints.find().then(async (complaints) => {
      for(i = 0; i < complaints.length; i++){
        var crop = await Crops.findById(complaints[i].cropID);
        var complainant = await User.findById(complaints[i].complainerID);
        var complainee = await User.findById(complaints[i].complainAgainstID);
        await getImg(crop._id)
          .then((image) => {
            crop1 = {
              available: crop.available,
              _id: crop._id,
              name: crop.name,
              price: crop.price,
              quantity: crop.quantity,
              farmerID: crop.farmerID,
              date: crop.date,
              __v: crop.__v,
              image: image,
            };
            var temp = {
              complaint: complaints[i],
              crop: crop1,
              complainant: complainant,
              complainee: complainee,
            }
            comps.push(temp);
          })
          .catch((getimgerr) => console.error(getimgerr));
      }
      resolve(comps)
    }).catch((finderr)=> console.error(finderr))
  })
}


router.get("/viewcomplaints", (req, res) => {
  authMod(req).then((isAuthMod) => {
    if(isAuthMod) {
      getComplaints().then((complaints) => {
        // console.log("COMPLAINTSSSSS: ", complaints);
        res.render("modViewComplaints", {req: req, complaints: complaints});
      })
    }else{
      res.redirect('/moderator/login');
    }
  }).catch((autherr)=>{console.error(autherr)})
})

router.get("/dismiss/:compID", (req, res) => {
  authMod(req).then((isAuthMod) => {
    if(isAuthMod){
      Complaints.findByIdAndDelete(req.params.compID).then((comp) => {
        console.log("deleted", comp, req.params.compID);
        res.redirect("/moderator/viewcomplaints");
      }).catch((err) => {
        console.error(err);
        res.redirect("/moderator/viewcomplaints");
      })
    }
    else{
      req.flash(
        "error_msg",
        "Please log in as a Moderator to view this resource "
      );
      res.redirect("/moderator/login");
    }
  }).catch((err) => {
    console.error(err);
    res.redirect("/moderator/viewcomplaints");
  })
})

router.get("/warn/:compID", (req, res) => {
  authMod(req).then((isAuthMod) => {
    if(isAuthMod){
      Complaints.findByIdAndDelete(req.params.compID).then((comp) => {
        User.findById(comp.complainAgainstID).then((user) => {
          var warn = 1;
          if(user.warnings){
            warn += user.warnings;
          }
          User.findByIdAndUpdate(comp.complainAgainstID, {warnings:warn}).then(() => {
            res.redirect("/moderator/viewcomplaints");
          }).catch((err) => {
            console.error(err)
            res.redirect("/moderator/viewcomplaints");
          })
        }).catch((err) => {
          console.error(err)
          res.redirect("/moderator/viewcomplaints");
        })
      }).catch((err) => {
        console.error(err)
        res.redirect("/moderator/viewcomplaints");
      })
    }
    else{
      req.flash(
        "error_msg",
        "Please log in as a Moderator to view this resource "
      );
      res.redirect("/moderator/login");
    }
  }).catch((err) => {
    console.error(err);
    res.redirect("/moderator/viewcomplaints");
  })
})

module.exports = router;