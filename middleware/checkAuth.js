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
        if (req.user.Role === "admin") {
            return next();
        }
      } catch (err) {
        console.log(`${__filename}: Line 28`, err)
        res.redirect("/login");
      }
    }
  };
  