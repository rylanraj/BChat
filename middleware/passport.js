// New feature
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
let userController = require("../controller/user_controller");
const { userModel } = require("../database");
require('dotenv').config()
// GitHub Authentication
const GithubStrategy = require("passport-github2").Strategy;
var GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
var GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
var GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

const localLogin = new LocalStrategy(
  {
    usernameField: "email",
    passwordField: "password",
  },
  (email, password, done) => {
    console.log(email, password)
    const user = userController.getUserByEmailIdAndPassword(email, password);
    return user
      ? done(null, user)
      : done(null, false, {
          message: "Your login details are not valid. Please try again",
      });
  }
);

// This works
const githubLogin = new GithubStrategy({

        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: GITHUB_CALLBACK_URL
    },
    function(accessToken, refreshToken, profile, done) {
        // console.log("Passport.js profile: ", profile);
        const userModelOutput = userModel.findOrCreate(profile, function (err, user) {
            return done(err, user);
        })

    }

);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  if (user) {
    done(null, user);
  } else {
    done({ message: "User not found" }, null);
  }
});

// Added the githubLogin to the exports
module.exports = passport.use(localLogin).use(githubLogin);
