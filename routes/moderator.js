const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const Crops = require("../models/Crop");
const Mods = require("../models/User");
const Transaction = require("../models/Transaction");
const InProgress = require("../models/InProgress");
const { find } = require("../models/Crop");
var Grid = require("gridfs-stream");
const conn = mongoose.connection;

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
      "Please log in as a Buyer to view this resource "
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
  console.log("ADDRESSSS", address);
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
        Mods.findOne(number_query, (err, obj) => {
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
            const newMod = Mods({
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

module.exports = router;