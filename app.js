const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const flash = require("connect-flash");
const session = require("express-session");
const passport = require("passport");
var bodyParser = require('body-parser');
var fs = require('fs');
var path = require('path');
require('dotenv/config');
const app = express();
require("coffee-script/register");
penguin = require("penguin");
admin = new penguin.Admin();
admin.setupApp(app);
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

//Passport config
require("./config/passport")(passport);

// Mongoose Configure
mongoose.set("useUnifiedTopology", true);
mongoose.set("useFindAndModify", false);
mongoose.set('returnOriginal', false);

//Db Config
const db = require("./config/keys").MongoURI;
//Connect to Mongoose
mongoose
  .connect(db, { useNewUrlParser: true })
  .then(() => console.log("Connected to database"))
  .catch((err) => console.log(err));

// EJS
app.use(expressLayouts);
app.set("view engine", "ejs");

//BodyParser
app.use(express.urlencoded({ extended: false }));

//CSS
app.use(express.static(__dirname+'/public/'))

//Express Session
app.use(
  session({
    secret: "secret42069",
    resave: true,
    saveUninitialized: true,
  })
);
//Passport Middlewear
app.use(passport.initialize());
app.use(passport.session());

//Connect Flash
app.use(flash());

//Gloal Vars
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
});

//Routes
app.use("/", require("./routes/index"));
app.use("/farmer", require("./routes/farmer"));
app.use("/buyer", require("./routes/buyer"));
//app.use("/moderator", require("./routes/moderator"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server started on port ${PORT}`));
