// Setup MySQL connection from .env
const mysql = require('mysql2');
const {data} = require("express-session/session/cookie");
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
}).promise();

async function keywordToImage(keyword) {
  const url = `https:api.unsplash.com/search/photos?query=${keyword}&client_id=0-m3L1XIVg9tJ5bs_a_uFAlkWvlmR0l5P-PSG7n8BZU&per_page=1`
  const response = await fetch(url);
  const data = await response.json();
  const imageUrl = data.results[0].urls.regular;
  return imageUrl;
}

let postsController = {
  new: (req, res) => {
    res.render("create_post.ejs");
  },
  create: async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).send('No files were uploaded.');
      }
      // Process other form fields (e.g., title, description)
      const title = req.body.title;
      const description = req.body.description;

      let filePath = file ? file.path : null;

      // Replace backslashes with forward slashes
      if (filePath) {
        filePath = filePath.replace(/\\/g, '/');
      }

      // Save post-details to the database 
      pool.query("INSERT INTO POST (Title, Description, UserID, Picture, TimePosted) VALUES (?,?,?,?,NOW());",
          [title, description, req.user.UserID, filePath]);

      // Redirect to their profile so they can see their post
      res.redirect("/profile/" + req.user.UserID);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
};

let chatsController = {
    list: async (req, res) => {},
    new: (req, res) => {},
    create: async (req, res) => {},
    delete: async (req, res) => {}
}

let profilesController = {
    show: async (req, res) => {
      let userToFind = req.params.id;
      if (req.params.id !== req.user.UserID){
        const [rows, fields] = await pool.query("SELECT * FROM USER WHERE UserID = ?;", [userToFind]);
        const [rows_2, fields_2] = await pool.query("SELECT * FROM POST WHERE UserID = ?;", [userToFind]);
        res.render("profile.ejs", {otherUser: rows[0], posts: rows_2});
      } else {
        // Get the posts made by the currently logged in user
        const [rows, fields] = await pool.query("SELECT * FROM POST WHERE UserID = ?;", [req.user.UserID]);
        res.render("profile.ejs", {otherUser: req.user, posts: rows});
      }
    },
    update: async (req, res) => {
      let userToUpdate = req.params.id;
      let newBiography = req.body.biography;
      let newUsername = req.body.username; // New field for username
      let newUserNickname = req.body.nickname; // New field for nickname

      // Access the uploaded file
      const profilePicture = req.file;

      // Save the file path to the database
      let filePath = profilePicture ? profilePicture.path : null;

      // Replace backslashes with forward slashes
      if (filePath) {
        filePath = filePath.replace(/\\/g, '/');
      }

      // Update the user with the new fields
      const sql = "UPDATE USER SET Biography = ?, UserName = ?, UserNickName = ?, ProfilePicture = ? WHERE UserID = ?";
      const params = [newBiography, newUsername, newUserNickname, filePath || req.user.ProfilePicture, userToUpdate];

      try {
        const result = await pool.query(sql, params);
        // Handle result here
      } catch (err) {
        console.log(err);
        // Handle error here
      }
      res.redirect(`/profile/${userToUpdate}`)
    }
}


let remindersController = {
  list: async (req, res) => {
    let user = req.user
    try{
      const [rows, fields] = await pool.query("SELECT * FROM REMINDER WHERE UserID = ?;", [user.UserID]);
      res.render("reminder/index", {
        reminders: rows, user: user
      });
    } catch (error) {
      console.error("Error fetching reminders:", error);
    }
  },

  new: (req, res) => {
    res.render("reminder/create");
  },

  listOne: async (req, res) => {
    let reminderToFind = req.params.id;
    let user = req.user
    let [rows, fields] = await pool.query("SELECT * FROM REMINDER WHERE ReminderID = ? AND UserID = ?;", [reminderToFind, user.UserID]);
    if (rows.length > 0) {
      res.render("reminder/single-reminder", {reminderItem: rows[0]});
    } else {
      res.render("reminder/index", {reminders: user.reminders, user: user});
    }
  },

  create: async (req, res) => {
    let user = req.user
    // Change this for later
    let reminder = {
      title: req.body.title,
      description: req.body.description,
      completed: false,
      keyword: req.body.keyword,
      banner: await keywordToImage(req.body.keyword)
    };
    pool.query("INSERT INTO REMINDER (Title, Description, Completed, UserID, Keyword, Banner) VALUES (?, ?, ?, ?,?,?);",
        [reminder.title, reminder.description, reminder.completed, req.user.UserID, reminder.keyword, reminder.banner]);
    res.redirect("/reminders");
  },

  edit: async (req, res) => {
    let reminderToFind = req.params.id;
    let user = req.user
    let [rows, fields] = await pool.query("SELECT * FROM REMINDER WHERE ReminderID = ? AND UserID = ?;", [reminderToFind, user.UserID]);
    if (rows.length > 0) {
      res.render("reminder/edit", {reminderItem: rows[0]});
    } else {
      res.render("reminder/index", {reminders: user.reminders, user: user});
    }
  },

  update: async (req, res) => {
    // Get the id of the reminder to update
    let reminderToUpdate = req.params.id;
    let user = req.user
    let [rows, fields] = await pool.query("SELECT * FROM REMINDER WHERE ReminderID = ? AND UserID = ?;", [reminderToUpdate, user.UserID]);
    // If the reminder exists, update it
    if (rows.length > 0) {
      let reminder = rows[0];
      reminder.title = req.body.title;
      reminder.description = req.body.description;
      if (Boolean(req.body.completed) == true) {
        reminder.completed = 1;
      } else {
        reminder.completed = 0;
      }
      reminder.keyword = req.body.keyword;
      reminder.banner = await keywordToImage(req.body.keyword);
      pool.query("UPDATE REMINDER SET Title = ?, Description = ?, Completed = ? WHERE ReminderID = ?;",
          [reminder.title, reminder.description, reminder.completed, reminderToUpdate]);
    }
    res.redirect("/reminders");
  },

  delete: async (req, res) => {

    let reminderToDelete = req.params.id;
    let user = req.user

    await pool.query("DELETE FROM REMINDER WHERE ReminderID = ? AND UserID = ?;", [reminderToDelete, user.UserID]);
    
    res.redirect("/reminders");
  }
};

module.exports = {remindersController, postsController, profilesController, chatsController};