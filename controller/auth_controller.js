let database = require("../database");
let passport = require("../middleware/passport")

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
  registerSubmit: async (req, res) => {
    try {
      let { name, email, password, username } = req.body;
  
      // Check if user with the email already exists
      const user = await pool.query("SELECT * FROM bchat_users.user WHERE Email = ?;", [email]);
      if (user[0].length > 0) {
        return res.status(400).send("User with that email already exists");
      }

      // Hash the password before inserting into the database
      const hashedPassword = await hashPassword(password);

      // Insert the user into the database
      await pool.query("INSERT INTO bchat_users.user (UserName, Email, Password, Role, UserNickName) VALUES (?, ?, ?, ?, ?);", [name, email,
        hashedPassword, "user", username]);

      // Redirect to login page upon successful registration
      res.redirect("/login");

    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).send("Internal Server Error"); // Handle error appropriately
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
};

// Function to hash a password
async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error('Error hashing password');
  }
}


module.exports = authController;
