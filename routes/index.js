const express = require("express");
const router = express.Router();
router.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    if (req.user.role == "farmer") {
      res.redirect("/farmer/dashboard");
    }
    if (req.user.role == "buyer") {
      res.redirect("/buyer/dashboard");
    }
    if (req.user.role == "moderator") {
      res.redirect("/moderator/dashboard");
    }
  } else {
    res.render("welcome", { req: req });
  }
});
module.exports = router;
