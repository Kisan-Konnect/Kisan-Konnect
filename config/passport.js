const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

//load user model;
const User = require("../models/User");
module.exports = function (passport) {
  passport.use(
    "farmerLocal",
    new LocalStrategy(
      {
        usernameField: "email",
      },
      (email, password, done) => {
        //Match User
        User.findOne({ email: email, role: "farmer" })
          .then((user) => {
            if (!user) {
              return done(null, false, {
                message: "That Email is not registered",
              });
            } else {
              //Match Pasword
              bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                  throw err;
                }
                if (isMatch) {
                  return done(null, user);
                } else {
                  return done(null, false, { message: "Password Incorrect" });
                }
              });
            }
          })
          .catch((err) => console.log(err));
      }
    )
  );

  passport.use(
    "buyerLocal",
    new LocalStrategy(
      {
        usernameField: "email",
      },
      (email, password, done) => {
        //Match User
        User.findOne({ email: email, role: "buyer" })
          .then((user) => {
            if (!user) {
              return done(null, false, {
                message: "That Email is not registered",
              });
            } else {
              //Match Pasword
              bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                  throw err;
                }
                if (isMatch) {
                  return done(null, user);
                } else {
                  return done(null, false, { message: "Password Incorrect" });
                }
              });
            }
          })
          .catch((err) => console.log(err));
      }
    )
  );

  passport.serializeUser(function (user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
      done(err, user);
    });
  });
};