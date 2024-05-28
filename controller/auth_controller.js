let passport = require("../middleware/passport")
let nodemailer = require('nodemailer');

// Import bcrypt for password hashing
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Import crypto for generating confirmation tokens
const crypto = require('crypto');

// Setup MySQL connection from ..env
const mysql = require('mysql2');
require('dotenv').config();

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'bchatbcit@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});
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
      const user = await pool.query("SELECT * FROM bchat_users.USER WHERE Email = ?;", [email]);
      if (user[0].length > 0) {
        return res.render("auth/register", { error: "User with this email already exists", isAuthenticated:
              req.isAuthenticated() });
      }
      if (password.length < 8) {
        return res.render("auth/register", { error: "Password must be at least 8 characters long", isAuthenticated: req.isAuthenticated() });
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
  
      // Get the current date
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Adding 1 to month because month is zero-based
      const day = String(currentDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
  
      // Insert the user into the database with the current date as DateJoined
      await pool.query("INSERT INTO bchat_users.USER (UserName, Email, Password, Role, UserNickName, DateJoined, ProfilePicture, Confirmed, ConfirmationToken) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);", [name, email,
        hashedPassword, "user", username, formattedDate,"../images/default.jpg", 0, confirmationToken]);
      
      // Send a confirmation email
      let mailOptions = {
        from: 'bchatbcit@gmail.com',
        to: email,
        subject: 'Account Confirmation',
        text: `Hello, ${username}! Please confirm your account by clicking the following link: http://64.23.207.255/confirm/${confirmationToken}`
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
    }
  }
  ,
  
  
  
  logout: (req, res) => {
    req.logout(err => {
      if (err) console.log(err)
    });
    res.redirect("/login");
  },
  adminPanel: async (req, res) => {
    user_session = {}
    obj = JSON.parse(JSON.stringify(req.sessionStore.sessions))

    const reports = await pool.query("SELECT * FROM POST_REPORT");
    const postIds = reports[0].map(report => report.PostID);
    if (postIds.length === 0) {
      return res.render("admin", {posts: [], userDataMap: {}, user: req.user, sessions: user_session, isAuthenticated: req.isAuthenticated()});
    }
    const [posts] = await pool.query("SELECT * FROM POST WHERE PostID IN (?)", [postIds]);
    
    const userIds = posts.map(post => post.UserID);

    const [users] = await pool.query("SELECT UserID, UserName, ProfilePicture FROM USER WHERE UserID IN (?)", [userIds]);
    const userDataMap = {};
    users.forEach(user => {
      userDataMap[user.UserID] = { username: user.UserName, profilePicture: user.ProfilePicture };
    });


    try {
      for (const o in obj) {
        user_session[o] = JSON.parse(obj[o])['passport']['user']['id']
      }
    } catch (err) {
      console.log(err)
    }
    res.render("admin", {posts: posts, userDataMap: userDataMap,user: req.user, sessions: user_session, isAuthenticated: req.isAuthenticated()});
  },
  removePost: async (req, res) => {
    const postId = req.params.postID;
    await pool.query("DELETE FROM POST_REPORT WHERE PostID = ?;", [postId]);
    await pool.query("DELETE FROM POST_LIKE WHERE PostID = ?;", [postId]);
    await pool.query("DELETE FROM COMMENT WHERE PostID = ?;", [postId]);
    await pool.query("DELETE FROM POST WHERE PostID = ?;", [postId]);
    res.redirect("/admin");
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
    const [user] = await pool.query("SELECT * FROM bchat_users.USER WHERE Email = ?;", [BCITemail]);
    // If this user exists, send a request to their email to update their GitHub email
    if (user.length > 0 && user[0].GitHubEmail !== user[0].Email) {
      // Generate a token
      const token = crypto.randomBytes(20).toString('hex');

      // Insert the request into the database
      await pool.query
      ("INSERT INTO bchat_users.CHANGE_GITHUB_EMAIL_REQUEST(BCITEmail, NewGitHubEmail, Token) VALUES(?, ?, ?);", [BCITemail, githubEmail, token]);

      // Send the email to the BCIT email
      let mailOptions = {
        from: 'bchatbcit@gmail.com',
        to: BCITemail,
        subject: 'Update GitHub Email Request',
        text: `Hello, ${user[0].UserName}! Please confirm your request to update your GitHub email to by clicking the following link: http://64.23.207.255/confirm_github/${token} (Ignore this email if you did not make this request)`
      };

      await transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
      // This isn't an error, but we want to let the user know that an email has been sent
      return res.render("auth/confirm_email", { error: "An email has been sent to your BCIT email to confirm the change to your GitHub email", isAuthenticated:
            req.isAuthenticated() });
    }
    else if(user.length > 0 && user[0].GitHubEmail === user[0].Email) {
      if (user[0].Password === "tempPassword") {
        if (password.length < 8) {
          return res.render("auth/confirm_email", { error: "Password must be at least 8 characters long", isAuthenticated:
                req.isAuthenticated() });
        }
        const hashedPassword = await hashPassword(password);
        await pool.query("UPDATE bchat_users.USER SET Password = ? WHERE Email = ?;", [hashedPassword, BCITemail]);
      }
      // Now send a confirmation email, and redirect them to the login page
      await sendConfirmationEmail(githubEmail, BCITemail, user, req, res);
    }
    else {
      if (password.length < 8) {
        return res.render("auth/confirm_email", { error: "Password must be at least 8 characters long", isAuthenticated:
              req.isAuthenticated() });
      }
      const [user] = await pool.query("SELECT * FROM bchat_users.USER WHERE GitHubEmail = ?;", [githubEmail]);
        // If this user exists, update their BCIT email
        if (user.length > 0) {
          await pool.query("UPDATE bchat_users.USER SET Email = ? WHERE GitHubEmail = ?;", [BCITemail, githubEmail]);
          // Also update their Confirmation to false since they need to confirm their new email
          await pool.query("UPDATE bchat_users.USER SET Confirmed = 0 WHERE GitHubEmail = ?;", [githubEmail]);
          // Set the password
          const hashedPassword = await hashPassword(password);
          await pool.query("UPDATE bchat_users.USER SET Password = ? WHERE GitHubEmail = ?;", [hashedPassword, githubEmail]);
          // Now generate a new confirmation token and send the email
          await sendConfirmationEmail(githubEmail, BCITemail, user, req, res);
        }
        else {
          return res.render("auth/confirm_email", { error: "No account with this email exists", isAuthenticated:
                req.isAuthenticated() });
        }
    }
  },
  confirmGitHubEmail: async (req, res) => {
    const token = req.params.token;
    try {
      const [request] = await pool.query("SELECT * FROM bchat_users.CHANGE_GITHUB_EMAIL_REQUEST WHERE Token = ?;", [token]);
      if (request.length > 0) {
        const BCITEmail = request[0].BCITEmail;
        const NewGitHubEmail = request[0].NewGitHubEmail;
        await pool.query("UPDATE bchat_users.USER SET GitHubEmail = ? WHERE Email = ?;", [NewGitHubEmail, BCITEmail]);


        // Delete any other users with the same GitHub email
        await pool.query("DELETE FROM bchat_users.USER WHERE GitHubEmail = ? AND Email != ?;", [NewGitHubEmail, BCITEmail]);
        await pool.query("DELETE FROM bchat_users.CHANGE_GITHUB_EMAIL_REQUEST WHERE Token = ?;", [token]);
        res.send('Your GitHub email has been updated!');
      } else {
        res.send('Invalid confirmation token.');
      }
    }
    catch (error){
      console.error("Error confirming user:", error);
      res.status(500).send("Internal Server Error");
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
// Function to save code
async function sendConfirmationEmail(githubEmail, BCITemail, user, req, res){
  const confirmationToken = crypto.randomBytes(20).toString('hex');
  await pool.query("UPDATE bchat_users.USER SET ConfirmationToken = ? WHERE GitHubEmail = ?;", [confirmationToken, githubEmail]);
  // Send the email to the new BCIT email
  let mailOptions = {
    from: 'bchatbcit@gmail.com',
    to: BCITemail,
    subject: 'Account Confirmation',
    text: `Hello, ${user[0].UserName}! Please confirm your account by clicking the following link: http://64.23.207.255/confirm/${confirmationToken}`
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


module.exports = {authController,hashPassword, sendConfirmationEmail};
