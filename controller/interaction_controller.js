let database = require("../database");
const multer = require('multer');

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
  // Make sure to register for a token at https://unsplash.com/developers
  // Notion uses unsplash for their banner images, so we'll use that too
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
      const keyword = req.body.keyword;

      // Fetch image URL based on keyword
      const banner = await keywordToImage(keyword);

      // Save post details to the database or perform other operations
      // For example, you can access the file path via file.path

      // Redirect to /reminders after successful upload
      res.redirect("/reminders");
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
        res.render("profile.ejs", {otherUser: rows[0]});
      } else {
        res.render("profile.ejs", {otherUser: req.user});
      }

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
    // Redirect the user back to the reminders list
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