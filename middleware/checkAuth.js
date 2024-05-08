// New feature
const { join } = require("path")

module.exports = {
    ensureAuthenticated: function (req, res, next) {
      res.locals.isAuthenticated = req.isAuthenticated();
      if (req.isAuthenticated()) {
        return next();
      }
      res.redirect("/login");
    },
    forwardAuthenticated: function (req, res, next) {
      res.locals.isAuthenticated = req.isAuthenticated();
      if (!req.isAuthenticated()) {
        return next();
      }
      res.redirect("/reminders");
    },
    isAdmin: function (req, res, next) {
      console.log(req.user)
      try {
        if (req.user.role === "admin" && req.isAuthenticated()) {
          return next(); 
        } 
        if (req.isAuthenticated()) {
          res.redirect("/reminders")
        } else {
          res.redirect("/login");
        }
      } catch (err) {
        console.log(`${__filename}: Line 28`, err)
        res.redirect("/login");
      }
    }
  };
  