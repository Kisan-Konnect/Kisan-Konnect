module.exports = {
  ensureFarmerAuthenticated: function (req, res, next) {
    if (req.isAuthenticated()) {
      if (req.user.role == "farmer") return next();
      else {
        req.flash("error_msg", "Please log in to this resource ");
        res.redirect("/farmer/login");
      }
    } else {
      req.flash("error_msg", "Please log in to this resource ");
      res.redirect("/farmer/login");
    }
  },
};
