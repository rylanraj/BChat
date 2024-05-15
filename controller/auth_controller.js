let passport = require("../middleware/passport")
let nodemailer = require('nodemailer');

// Import bcrypt for password hashing
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Import crypto for generating confirmation tokens
const crypto = require('crypto');

// Setup MySQL connection from .env
const mysql = require('mysql2');
require('dotenv').config();

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'bchatbcit@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
}).promise();

let authController = {
  login: (req, res) => {
    let flashMessages = req.flash('error');
    let message = flashMessages.length > 0 ? flashMessages[0] : null;
    res.render("auth/login",{ message : message});
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

      // If any of the fields are empty, return an error
        if (!name || !email || !password || !username) {
            return res.render("auth/register", { error: "All fields are required", isAuthenticated:
                req.isAuthenticated() });
        }
  
      // Check if user with the email already exists
      const user = await pool.query("SELECT * FROM bchat_users.user WHERE Email = ?;", [email]);
      if (user[0].length > 0) {
        return res.render("auth/register", { error: "User with this email already exists", isAuthenticated:
              req.isAuthenticated() });
      }
      if (password.length < 8) {
        return res.render("auth/register", { error: "Password must be at least 8 characters long", isAuthenticated:
              req.isAuthenticated() });
      }
      // If the password does not end with bcit.ca, return an error
      if (!email.endsWith("@my.bcit.ca")) {
        return res.render("auth/register", { error: "Please use your myBCIT email", isAuthenticated:
              req.isAuthenticated()
        });
      }

      // Hash the password before inserting into the database
      const hashedPassword = await hashPassword(password);

      // Generate a confirmation token
      const confirmationToken = crypto.randomBytes(20).toString('hex');

      // Insert the user into the database
      await pool.query
      ("INSERT INTO bchat_users.user (UserName, Email, Password, Role, UserNickName, Confirmed, ConfirmationToken) VALUES (?, ?, ?, ?, ?, ?, ?);",
          [name, email, hashedPassword, "user", username, 0, confirmationToken]);

      let [newUser] = await pool.query("SELECT * FROM bchat_users.user WHERE Email = ?;", [email]);

      // Send a confirmation email
      let mailOptions = {
        from: 'bchatbcit@gmail.com',
        to: email,
        subject: 'Account Confirmation',
        text: `Hello, ${username}! Please confirm your account by clicking the following link: http://localhost:3001/confirm/${confirmationToken}`
      };

      await transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });

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
  confirmEmail: (req, res) => {
    res.render("auth/confirm_email", {isAuthenticated: req.isAuthenticated()});
  },
  confirmEmailSubmit:async (req, res) => {
    const githubEmail = req.body.GitHubEmail;
    const BCITemail = req.body.BCITEmail;
    const password = req.body.Password;

    // If the BCIT does not end with bcit.ca, return an error
    if (!BCITemail.endsWith("@my.bcit.ca")) {
      return res.render("auth/confirm_email", { error: "Please use your myBCIT email", isAuthenticated:
            req.isAuthenticated() });
    }


    // Before checking the GitHub email, check if their is a local account with the BCIT email
    const [user] = await pool.query("SELECT * FROM bchat_users.user WHERE Email = ?;", [BCITemail]);
    // If this user exists, update their GitHub email
    if (user.length > 0) {
      await pool.query("UPDATE bchat_users.user SET GitHubEmail = ? WHERE Email = ?;", [githubEmail, BCITemail]);
      // Delete any other users with the same GitHub email
      await pool.query("DELETE FROM bchat_users.user WHERE GitHubEmail = ? AND Email != ?;", [githubEmail, BCITemail]);

      return res.redirect("/login");
    }
    else {
      if (password.length < 8) {
        return res.render("auth/confirm_email", { error: "Password must be at least 8 characters long", isAuthenticated:
              req.isAuthenticated() });
      }
      const [user] = await pool.query("SELECT * FROM bchat_users.user WHERE GitHubEmail = ?;", [githubEmail]);
        // If this user exists, update their BCIT email
        if (user.length > 0) {
          await pool.query("UPDATE bchat_users.user SET Email = ? WHERE GitHubEmail = ?;", [BCITemail, githubEmail]);
          // Also update their Confirmation to false since they need to confirm their new email
          await pool.query("UPDATE bchat_users.user SET Confirmed = 0 WHERE GitHubEmail = ?;", [githubEmail]);
          // Set the password
          const hashedPassword = await hashPassword(password);
          await pool.query("UPDATE bchat_users.user SET Password = ? WHERE GitHubEmail = ?;", [hashedPassword, githubEmail]);
          // Now generate a new confirmation token
          const confirmationToken = crypto.randomBytes(20).toString('hex');
          await pool.query("UPDATE bchat_users.user SET ConfirmationToken = ? WHERE GitHubEmail = ?;", [confirmationToken, githubEmail]);
          // Send the email to the new BCIT email
          let mailOptions = {
            from: 'bchatbcit@gmail.com',
            to: BCITemail,
            subject: 'Account Confirmation',
            text: `Hello, ${user[0].UserName}! Please confirm your account by clicking the following link: http://localhost:3001/confirm/${confirmationToken}`
          };

          await transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });


          return res.redirect("/login");
        }
        else {
          return res.render("auth/confirm_email", { error: "No account with this email exists", isAuthenticated:
                req.isAuthenticated() });
        }
    }
  }
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


module.exports = {authController,hashPassword};
