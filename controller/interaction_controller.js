let database = require("../database");
const multer = require('multer');

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


let remindersController = {
  list: (req, res) => {
    let user = req.user
    res.render("reminder/index", { reminders: user.reminders, user: user });
  },

  new: (req, res) => {
    res.render("reminder/create");
  },

  listOne: (req, res) => {
    let reminderToFind = req.params.id;
    let user = req.user
    let searchResult = user.reminders.find(function (reminder) {
      return reminder.id === reminderToFind;
    });
    if (searchResult !== undefined) {
      res.render("reminder/single-reminder", { reminderItem: searchResult });
    } else {
      res.render("reminder/index", { reminders: user.reminders });
    }
  },

  create: async (req, res) => {
    let user = req.user
    // Change this for later
    let reminder = {
      id: user.reminders.length + 1,
      title: req.body.title,
      description: req.body.description,
      completed: false,
      keyword: req.body.keyword,
      banner: await keywordToImage(req.body.keyword)
    };
    user.reminders.push(reminder);
    res.redirect("/reminders");
  },

  edit: (req, res) => {
    let reminderToFind = req.params.id;
    let user = req.user
    let searchResult = user.reminders.find(function (reminder) {
      return reminder.id === reminderToFind;
    });
    res.render("reminder/edit", { reminderItem: searchResult });
  },

  update: (req, res) => {
    // Get the id of the reminder to update
    let reminderToUpdate = req.params.id;
    let user = req.user
    // Find the reminder in the array
    let index = user.reminders.findIndex(function (reminder) {
      return reminder.id === reminderToUpdate;
    });

    // If the reminder was found, update it
    if (index != -1) {
      user.reminders[index] = {
        id: req.params.id,
        title: req.body.title,
        description: req.body.description,
        completed: req.body.completed === 'true',  // convert string to boolean
      };
    }

    // Redirect the user back to the reminders list
    res.redirect("/reminders");
  },

  delete: (req, res) => {

    let reminderToDelete = req.params.id;
    let user = req.user

    let index = user.reminders.findIndex(function (reminder) {
      return reminder.id === reminderToDelete;
    });


    if (index !== -1) {
      user.reminders.splice(index, 1);
    }


    res.redirect("/reminders");
  }
};

module.exports = {remindersController, postsController};