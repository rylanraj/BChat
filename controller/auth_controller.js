let database = require("../database");
let passport = require("../middleware/passport")
require('dotenv').config()
const fs = require('fs');

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


      function test() {

        // Extract IDs from keys and find the maximum
        let maxId = -Infinity;
        let maxUser = null;
      
        for (const key in process.env) {
          if (key.includes("USER_") && key.endsWith("_INFO")) {
            const id = parseInt(key.match(/\d+/)[0]);
            if (!isNaN(id) && id > maxId) {
              maxId = id;
              maxUser = JSON.parse(process.env[key]);
            }
          }
        }
      
        console.log("User with highest ID:", maxId);
        return maxId + 1
      }
      
      
      

      let { name, email, password } = req.body;
  
      // Check if user already exists
      let user = await database.userModel.findOne({ email });
  
      if (user) {
        // User already exists
        return res.render("auth/register", { message: "Account already exists with email" });
      }
  
      // Create new user
      const newUser = {
        id: test(),
        UserName: name,
        Email: email,
        HashedPassword: password
      };

      function addUserToEnv(newUser) {
        try {
          // Read the content of the .env file
          let envContent = fs.readFileSync('.env', 'utf8');
          
          // Append the new user entry to the content
          envContent += `\nUSER_${newUser.id}_INFO=${JSON.stringify(newUser)}\n`;
      
          // Write the updated content back to the .env file
          fs.writeFileSync('.env', envContent);
      
          console.log('New user added to the .env file successfully.');
        } catch (error) {
          console.error('Error adding new user to .env file:', error);
        }
      }
    addUserToEnv(newUser)


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
  // Haven't tested yet

};

module.exports = authController;
