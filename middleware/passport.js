// New feature
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

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

const fs = require('fs');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: {
        ca: fs.readFileSync('./ca-certificate.crt')
    },
    waitForConnections: true,
}).promise();

const localLogin = new LocalStrategy(
    {
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true
    },
    async (req, email, password, done) => {
        try {
            const [rows, fields] = await pool.query("SELECT * FROM bchat_users.USER WHERE Email = ?;", [email]);
            const user = rows[0];
            if (user) {
                const match = await bcrypt.compare(password, user.Password);
                const activated = user.Confirmed;

                if (match && activated == true) {
                    return done(null, user);
                }
                else if(match && !activated) {
                    return done(null, false, req.flash('error', 'Please confirm your email first.'));
                }
                else {
                    return done(null, false, req.flash('error', 'Incorrect Password.'));
                }
            } else {
                return done(null, false, req.flash('error', 'User not found.'));
            }
        } catch (err) {
            return done(err);
        }
    }
);

const githubLogin = new GithubStrategy({

        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: GITHUB_CALLBACK_URL
    },
    function(accessToken, refreshToken, profile, done) {
        // console.log("Passport.js profile: ", profile);
        const userModelOutput = findOrCreate(profile, function (err, user) {
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

const findOrCreate = async (githubProfile, callback) => {
    const [rows] = await pool.query("SELECT * FROM bchat_users.USER WHERE GitHubEmail = ?;", [githubProfile._json.email]);

    if (rows.length > 0) {
        callback(null, rows[0]);
    } else {
        // Get the current date
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Adding 1 to month because month is zero-based
        const day = String(currentDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;

        await pool.query("INSERT INTO bchat_users.USER (UserName, Email, GitHubEmail, Password, Role, UserNickName, DateJoined, ProfilePicture) VALUES (?,?,?,?,?,?,?,?);",
            [githubProfile.username, githubProfile._json.email, githubProfile._json.email, "tempPassword", 'user', githubProfile.username, formattedDate, "../images/default.jpg"]);
        const [newRows] = await pool.query("SELECT * FROM bchat_users.USER WHERE Email = ?;", [githubProfile._json.email]);
        callback(null, newRows[0]);
    }
}

// Added the githubLogin to the exports
module.exports = passport.use(localLogin).use(githubLogin);
