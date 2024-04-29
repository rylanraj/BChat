// New feature
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
let userController = require("../controller/user_controller");
const { userModel } = require("../database");
// GitHub Authentication
const GithubStrategy = require("passport-github2").Strategy;
var GITHUB_CLIENT_ID = "ebe33967d8d7a3288f7b";
var GITHUB_CLIENT_SECRET = "9907bda3a0199ff0c6b786302d997504ef328a1f";
var GITHUB_CALLBACK_URL = "http://localhost:3001/github/callback";

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
