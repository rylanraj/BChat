// New feature
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
let userController = require("../controller/user_controller");
const { userModel } = require("../database");
require('dotenv').config()
// GitHub Authentication
const GithubStrategy = require("passport-github2").Strategy;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

// Import bcrypt for password hashing
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Setup MySQL connection from .env
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
}).promise();

const localLogin = new LocalStrategy(
    {
        usernameField: "email",
        passwordField: "password",
    },
    async (email, password, done) => {
        try {
            const [rows, fields] = await pool.query("SELECT * FROM bchat_users.user WHERE Email = ?;", [email]);
            const user = rows[0];
            if (user) {
                const match = await bcrypt.compare(password, user.Password);
                if (match) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: 'Incorrect Password.' });
                }
            } else {
                return done(null, false, { message: 'Incorrect Email.' });
            }
        } catch (err) {
            return done(err);
        }
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

passport.serializeUser((user, done) => {
  done(null, user.UserID);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [rows, fields] = await pool.query("SELECT * FROM USER WHERE UserID = ?", [id]);
        done(null, rows[0]);
    } catch (err) {
        done(err);
    }
});

// Added the githubLogin to the exports
module.exports = passport.use(localLogin).use(githubLogin);
