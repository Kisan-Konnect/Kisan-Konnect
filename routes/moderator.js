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
const findHumanAge = require("../config/globalFuncs").findHumanAge;
const { Template } = require("ejs");
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

function getComplaints() {
  return new Promise((resolve, reject) => {
    var comps = [];
    Complaints.find()
      .then(async (complaints) => {
        for (i = 0; i < complaints.length; i++) {
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
              };
              comps.push(temp);
            })
            .catch((getimgerr) => console.error(getimgerr));
        }
        resolve(comps);
      })
      .catch((finderr) => console.error(finderr));
  });
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

function redirects(req, res) {
  if (req.user.role == "farmer") res.redirect("/farmer/dashboard");
  else if (req.user.role == "buyer") res.redirect("/buyer/dashboard");
  else {
    req.flash(
      "error_msg",
      "Please log in as a Moderator to view this resource "
    );
    res.redirect("/moderator/login");
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
                  .then(() => {
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

function getTotalValues(Model, start, end) {
  var today = new Date();
  today.setHours(23, 59, 59, 999);
  var startDate = new Date(today.getTime() - start * 24 * 60 * 60 * 1000 + 1);
  var endDate = new Date(today.getTime() - end * 24 * 60 * 60 * 1000);
  return new Promise((resolve, reject) => {
    Model.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .then((docs) => {
        if (docs.length === 0) {
          resolve(null);
        } else {
          // console.log(
          //   "DATESSSSSSSSS: ",
          //   startDate.toString(),
          //   start,
          //   endDate.toString(),
          //   end,
          //   "VALUEEEE",
          //   docs
          // );
          resolve(docs.length);
        }
      })
      .catch((finderr) => {
        console.error(finderr);
      });
  });
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 0).getDate();
}

function getData(Model) {
  var startDate = new Date(2018, 0, 1);
  console.log("STARTTTTTT: ", startDate);
  return new Promise(async (resolve, reject) => {
    // Week & Month
    dayLabelMap = {
      0: "Sunday",
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
    };
    monthLabelMap = {
      0: "January",
      1: "February",
      2: "March",
      3: "April",
      4: "May",
      5: "June",
      6: "July",
      7: "August",
      8: "September",
      9: "October",
      10: "November",
      11: "December",
    };
    var datenow = new Date();
    datenow.setHours(23, 59, 59, 999);
    var date1 = new Date();
    week = [];
    weekLabels = [];
    month = [];
    monthLabels = [];
    year = [];
    yearLabels = [];
    alltime = [];
    alltimeLabels = [];
    for (var i = 0; i < 30; i++) {
      var count = await getTotalValues(Model, i + 1, i);
      if (i < 7) {
        // console.log("DATE!", date1.toString(), date1.getDay());
        weekLabels.push(dayLabelMap[date1.getDay()]);
        week.push(count);
      }
      monthLabels.push(
        monthLabelMap[date1.getMonth()] +
          " " +
          date1.getDate().toString() +
          " " +
          date1.getFullYear().toString()
      );
      month.push(count);
      date1.setDate(date1.getDate() - 1);
    }
    var temp = {};
    temp.weekLabels = weekLabels;
    temp.week = week;
    temp.monthLabels = monthLabels;
    temp.month = month;

    date1 = new Date();
    date1.setHours(23, 59, 59, 999);

    for (var i = 0; i < 12; i++) {
      var d1 = (datenow.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000);
      date1.setDate(1);
      var d2 = (datenow.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000);
      var count = await getTotalValues(Model, d2, d1);
      yearLabels.push(
        monthLabelMap[date1.getMonth()] + " " + date1.getFullYear().toString()
      );
      year.push(count);

      date1.setDate(0);
    }
    temp.year = year;
    temp.yearLabels = yearLabels;

    date1 = new Date();
    date1.setHours(23, 59, 59, 999);
    while (date1 >= startDate) {
      date1 = new Date(date1.getFullYear(), 11, 31);
      var d2 = (datenow.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000);
      date1 = new Date(date1.getFullYear(), 0, 1);
      var d1 = (datenow.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000);
      var count = await getTotalValues(Model, d1, d2);
      alltimeLabels.push(date1.getFullYear().toString());
      alltime.push(count);
      console.log(date1.toString());
      date1.setFullYear(date1.getFullYear() - 1);
    }
    temp.alltime = alltime;
    temp.alltimeLabels = alltimeLabels;

    console.log("TEMMMMMMPPPPPPPPPPPPPPPP", temp);

    resolve(temp);
  });
}

router.get("/dashboard", (req, res) => {
  authMod(req)
    .then((isAuthMod) => {
      if (isAuthMod) {
        getComplaints()
          .then((complaints) => {
            // console.log(complaints);
            getData(User)
              .then((userData) => {
                getData(Crops)
                  .then((cropData) => {
                    res.render("modDash", {
                      req: req,
                      userData: userData,
                      cropData: cropData,
                    });
                  })
                  .catch((err) => {
                    console.error(err);
                  });
              })
              .catch((err) => console.error(err));
          })
          .catch((err) => console.error(err));
      } else {
        res.redirect("/moderator/login");
      }
    })
    .catch((err) => {
      console.error(err);
    });
});

router.get("/viewcomplaints", (req, res) => {
  authMod(req)
    .then((isAuthMod) => {
      if (isAuthMod) {
        getComplaints().then((complaints) => {
          // console.log("COMPLAINTSSSSS: ", complaints);
          res.render("modViewComplaints", {
            req: req,
            complaints: complaints,
            findHumanAge: findHumanAge,
          });
        });
      } else {
        res.redirect("/moderator/login");
      }
    })
    .catch((autherr) => {
      console.error(autherr);
    });
});

router.get("/dismiss/:compID", (req, res) => {
  authMod(req)
    .then((isAuthMod) => {
      if (isAuthMod) {
        Complaints.findByIdAndDelete(req.params.compID)
          .then((comp) => {
            // console.log("deleted", comp, req.params.compID);
            res.redirect("/moderator/viewcomplaints");
          })
          .catch((err) => {
            console.error(err);
            res.redirect("/moderator/viewcomplaints");
          });
      } else {
        req.flash(
          "error_msg",
          "Please log in as a Moderator to view this resource "
        );
        res.redirect("/moderator/login");
      }
    })
    .catch((err) => {
      console.error(err);
      res.redirect("/moderator/viewcomplaints");
    });
});

router.get("/warn/:compID", (req, res) => {
  authMod(req)
    .then((isAuthMod) => {
      if (isAuthMod) {
        Complaints.findByIdAndDelete(req.params.compID)
          .then((comp) => {
            User.findById(comp.complainAgainstID)
              .then((user) => {
                var warn = 1;
                if (user.warnings) {
                  warn += user.warnings;
                }
                User.findByIdAndUpdate(comp.complainAgainstID, {
                  warnings: warn,
                })
                  .then(() => {
                    res.redirect("/moderator/viewcomplaints");
                  })
                  .catch((err) => {
                    console.error(err);
                    res.redirect("/moderator/viewcomplaints");
                  });
              })
              .catch((err) => {
                console.error(err);
                res.redirect("/moderator/viewcomplaints");
              });
          })
          .catch((err) => {
            console.error(err);
            res.redirect("/moderator/viewcomplaints");
          });
      } else {
        req.flash(
          "error_msg",
          "Please log in as a Moderator to view this resource "
        );
        res.redirect("/moderator/login");
      }
    })
    .catch((err) => {
      console.error(err);
      res.redirect("/moderator/viewcomplaints");
    });
});

module.exports = router;
