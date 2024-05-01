let database = require("../database");
let passport = require("../middleware/passport")

let authController = {
  login: (req, res) => {
    res.render("auth/login");
  },

  register: (req, res) => {
    res.render("auth/register", {isAuthenticated: req.isAuthenticated()});
  },

  loginSubmit: passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  }),
  registerSubmit: (req, res) => {
    // implement later
    let {name, email, password } = req.body;
    let user = database.userModel.findOne(email);

    if (user) {
      // User already exists
      res.render("auth/register", { message: "Account already exists with email" });
    } else {
      // Create new user
      let newUser = {
        id: database.users.length + 1, // Generate new id
        name: name,
        email: email,
        password: password,
        role: "regular",
        reminders: []
      };

      // Add new user to database
      database.users.push(newUser);

      // Redirect to login page
      res.redirect("/login");
    }
  },
  logout: (req, res) => {
    req.logout(err => {
      if (err) console.log(err)
    });
    res.redirect("/login");
  },
  adminPanel: (req, res) => {
    obj = JSON.parse(JSON.stringify(req.sessionStore.sessions))
    user_session = {}
    try {
      for (const o in obj) {
        user_session[o] = JSON.parse(obj[o])['passport']['user']['id']
      }
    } catch (err) {
      console.log(err)
    }
    res.render("admin", {user: req.user, sessions: user_session, isAuthenticated: req.isAuthenticated()});
  },
  revokeSession: (req, res) => {
    req.sessionStore.destroy(req.params.SessionID, (err) => {
      if (err) {
        return console.error(err)
      } else {
        res.redirect("/admin")
      }
    })
  },
  // Haven't tested yet

};

module.exports = authController;
