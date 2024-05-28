// Setup MySQL connection from ..env
const mysql = require('mysql2');
const {data} = require("express-session/session/cookie");
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
  }
}).promise();

async function keywordToImage(keyword, res) {
  try {
    const url = `https:api.unsplash.com/search/photos?query=${keyword}&client_id=0-m3L1XIVg9tJ5bs_a_uFAlkWvlmR0l5P-PSG7n8BZU&per_page=1`
    const response = await fetch(url);
    const data = await response.json();
    if (data.results.length === 0) {
      return null;
    }
    const imageUrl = data.results[0].urls.regular;
    return imageUrl;
  } catch (error) {
    console.error("Error fetching image:", error);
    res.redirect("/reminders");
  }
}
async function fetchOtherUsers(user) {
  const [inboxes] = await pool.query("SELECT * FROM INBOX WHERE User1_ID = ? OR User2_ID = ?", [user, user]);

  const otherUsers = await Promise.all(inboxes.map(async row => {
    const otherUserId = (row.User1_ID === user) ? row.User2_ID : row.User1_ID;
    const [[otherUser]] = await pool.query("SELECT UserName, ProfilePicture FROM USER WHERE UserID = ?", [otherUserId]);
    return {
      otherUserID: otherUserId,
      otherUserName: otherUser.UserName,
      lastMessage: row.Last_Message,
      profilePicture: otherUser.ProfilePicture,
      inboxID: row.InboxID
    };
  }));

  return otherUsers;
}


// Function to fetch posts from the database
const fetchPosts = async () => {
  try {
      // Get a database connection from the pool and execute the query
      const [rows, fields] = await pool.query("SELECT * FROM POST ORDER BY TimePosted");
      // You may need to fetch additional data related to each post, such as user information
      return rows;
  } catch (error) {
      console.error("Error fetching posts:", error);
      throw error; // Rethrow the error to be handled by the caller
  }
};

const mainFeedController = {
  index: async (req, res) => {
    try {
      const user = req.user.UserID;
      const [posts] = await pool.query("SELECT * FROM POST");
      const userIds = posts.map(post => post.UserID);

      if (userIds.length === 0) {
        return res.render("index", { id:user, posts: [], userDataMap: {}, otherUsers: [], isAuthenticated: req.isAuthenticated() });
      }

      const [users] = await pool.query("SELECT UserID, UserName, ProfilePicture FROM USER WHERE UserID IN (?)", [userIds]);
      const userDataMap = {};
      users.forEach(user => {
        userDataMap[user.UserID] = { username: user.UserName, profilePicture: user.ProfilePicture };
      });

      const [inboxes] = await pool.query("SELECT * FROM INBOX WHERE User1_ID = ? OR User2_ID = ?", [user, user]);

      const otherUsers = await Promise.all(inboxes.map(async row => {
        const otherUserId = (row.User1_ID === user) ? row.User2_ID : row.User1_ID;
        const [[otherUser]] = await pool.query("SELECT UserName, ProfilePicture FROM USER WHERE UserID = ?", [otherUserId]);
        return {
          otherUserID: otherUserId,
          otherUserName: otherUser.UserName,
          lastMessage: row.Last_Message,
          profilePicture: otherUser.ProfilePicture,
          inboxID: row.InboxID
        };
      }));

      // Fetch likes count for each post
      const postsWithLikes = await Promise.all(posts.map(async post => {
        const [likeCount] = await pool.query("SELECT Likes FROM POST WHERE PostID = ?", [post.PostID]);
        return { ...post, likeCount: likeCount[0]?.Likes || 0 };
      }));



      res.render("index", { id:user, posts: postsWithLikes, userDataMap: userDataMap, otherUsers: otherUsers, isAuthenticated: req.isAuthenticated() });

    } catch (error) {
      console.error("Error fetching main feed data:", error);
      res.status(500).send('Internal Server Error');
    }
  },
  likePost: async (req, res) => {
    try {
      const userId = req.user.UserID;
      const postId = req.params.postId;

      const [existingLike] = await pool.query("SELECT * FROM POST_LIKE WHERE PostID = ? AND UserID = ?", [postId, userId]);

      if (existingLike.length > 0) {
        await pool.query("DELETE FROM POST_LIKE WHERE PostID = ? AND UserID = ?", [postId, userId]);
        await pool.query("UPDATE POST SET Likes = Likes - 1 WHERE PostID = ?", [postId]);
        return res.json({ success: true, liked: false });
      } else {
        await pool.query("INSERT INTO POST_LIKE (PostID, UserID) VALUES (?, ?)", [postId, userId]);
        await pool.query("UPDATE POST SET Likes = Likes + 1 WHERE PostID = ?", [postId]);
        return res.json({ success: true, liked: true });
      }
    } catch (error) {
      console.error("Error handling like action:", error);
      res.status(500).send('Internal Server Error');
    }
  },
  reportPost: async (req, res) => {
    const user = req.user;
    const postID = req.params.postId;
    const [existingReport] = await pool.query("SELECT * FROM POST_REPORT WHERE PostID = ? AND ReporterID = ?", [postID, user["UserID"]]);
    if (existingReport.length > 0) {
      await pool.query("UPDATE POST_REPORT SET Status = 1 WHERE PostID = ? AND ReporterID = ?", [postID, user["UserID"]]);
    } else {
      await pool.query("INSERT INTO POST_REPORT (PostID, ReporterID, Status) VALUES (?,?,1)", [postID, user["UserID"]]);
    }
  },

};







let postsController = {
  new: async (req, res) => {
    try {
      const otherUsers = await fetchOtherUsers(req.user.UserID);
      res.render("create_post.ejs", { otherUsers: otherUsers });
    } catch (error) {
      console.error("Error rendering create_post view:", error);
      res.status(500).send('Internal Server Error');
    }
  },
  create: async (req, res) => {
    try {
      const file = req.file;

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
  },
  show: async (req, res) => {
    try {
      const postId = req.params.id;
      const [post] = await pool.query("SELECT * FROM POST WHERE PostID = ?", [postId]);

      if (post.length === 0) {
        return res.status(404).send("Post not found");
      }
      const [parent_comments] = await pool.query("SELECT * FROM COMMENT WHERE PostID = ? AND ParentCommentID IS NULL ORDER BY TimePosted DESC", [postId]);
      const [child_comments] = await pool.query("SELECT * FROM COMMENT WHERE PostID = ? AND ParentCommentID IS NOT NULL ORDER BY TimePosted DESC", [postId]);

      const [user] = await pool.query("SELECT * FROM USER WHERE UserID = ?", [post[0].UserID]);

      for (let i = 0; i < parent_comments.length; i++) {
        const [comment_user] = await pool.query("SELECT * FROM USER WHERE UserID = ?", [parent_comments[i].UserID]);
        parent_comments[i].UserName = comment_user[0].UserName;
        parent_comments[i].ProfilePicture = comment_user[0].ProfilePicture;
      }

      res.render("posts/post", {
        post: post[0],
        creator: user[0],
        isAuthenticated: req.isAuthenticated(),
        parent_comments: parent_comments,
        child_comments: child_comments
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
    }
  },
  comment: async (req, res) => {
    const postID = req.params.id;
    const commentContent = req.body.content;
    await pool.query("INSERT INTO COMMENT (PostID, UserID, Content, TimePosted) VALUES (?,?,?,NOW());", [postID, req.user.UserID, commentContent]);
    res.redirect(`/post/${postID}`);
  },
  edit: async (req, res) => {
    try {
      const postID = req.params.id;
      const [post] = await pool.query("SELECT * FROM POST WHERE PostID = ?", [postID]);

      // If the current user isn't the owner of the post
        if (post.length === 0 || post[0].UserID !== req.user.UserID) {
            return res.status(403).send("You don't have permission to edit this post");
        }

      const otherUsers = await fetchOtherUsers(req.user.UserID);
      res.render("posts/edit", { otherUsers: otherUsers, post: post[0] });
    } catch (error) {
      console.error("Error rendering edit_post view:", error);
      res.status(500).send('Internal Server Error');
    }
  },
  async editSubmit(req, res) {
    let postID = req.params.id;
    let title = req.body.title;
    let description = req.body.description;
    let file = req.file;
    let filePath = file ? file.path : null;
    let removePhoto = req.body.removePhoto;
    const [post] = await pool.query("SELECT * FROM POST WHERE PostID = ?", [postID]);

    // If the current user isn't the owner of the post
    if (post.length === 0 || post[0].UserID !== req.user.UserID) {
      return res.status(403).send("You don't have permission to edit this post");
    }
    if (filePath) {
      filePath = filePath.replace(/\\/g, '/');
      await pool.query("UPDATE POST SET Title = ?, Description = ?, Picture = ? WHERE PostID = ?;", [title, description, filePath, postID]);
      res.redirect("/post/" + postID);
    } else if (removePhoto && !filePath) {
      await pool.query("UPDATE POST SET Title = ?, Description = ?, Picture = NULL WHERE PostID = ?;", [title, description, postID]);
      res.redirect("/post/" + postID);
    } else {
      await pool.query("UPDATE POST SET Title = ?, Description = ? WHERE PostID = ?;", [title, description, postID]);
      res.redirect("/post/" + postID);
    }

  },
  delete: async (req, res) => {
    let postID = req.params.id;
    const [post] = await pool.query("SELECT * FROM POST WHERE PostID = ?", [postID]);
    if (post.length === 0 || post[0].UserID !== req.user.UserID) {
      return res.status(403).send("You don't have permission to delete this post");
    } else {
        await pool.query("DELETE FROM COMMENT WHERE PostID = ?", [postID]);
        await pool.query("DELETE FROM POST_LIKE WHERE PostID = ?", [postID]);
        await pool.query("DELETE FROM POST WHERE PostID = ?", [postID]);
        res.redirect("/profile/" + req.user.UserID);
    }
  }

};

let chatController = {
  chat: async (req, res) => {
    const user = req.user.UserID

    let inboxID = req.params.id;

    let [inboxs, fields_3] = await pool.query("SELECT * FROM INBOX WHERE User1_ID = ? OR User2_ID = ?", [user, user]);

    const otherUser = await Promise.all(inboxs.map( async row => {
      if (row.User1_ID == user) {
        let [pp, fields] = await pool.query("SELECT UserName, ProfilePicture FROM USER WHERE UserID = ?", [row.User2_ID]);
        let data={
          otherUserID: row.User2_ID,
          otherUserName: pp[0].UserName,
          lastMessage: row.Last_Message,
          profilePicture: pp[0].ProfilePicture,
          inboxID: row.InboxID
        }
        return data;
      } else {
        let [pp, fields] = await pool.query("SELECT UserName, ProfilePicture FROM USER WHERE UserID = ?", [row.User1_ID]);
        let data={
          otherUserID: row.User1_ID,
          otherUserName: pp[0].UserName,
          lastMessage: row.Last_Message,
          profilePicture: pp[0].ProfilePicture,
          inboxID: row.InboxID
        }
        return data;
      }
    }));


    let [rows_2, fields_2] = await pool.query("SELECT * FROM INBOX WHERE InboxID = ?;", [inboxID]);
    let [rows, fields] = await pool.query("SELECT * FROM CHAT WHERE Inbox_ID = ?;", [inboxID]);
    let otherUserID;
    if (rows_2.length > 0) {
      otherUserID = rows_2[0].User1_ID == user ? rows_2[0].User2_ID : rows_2[0].User1_ID;
      // Rest of your code...
    } else {
      console.error("Error: No chat found with that ID.");
      return res.redirect("/")
    }
    const [userName, fields_4] = await pool.query("SELECT UserName FROM USER WHERE UserID = ?", [otherUserID]);

    if (rows_2.length == 0 || (rows_2[0].User1_ID != user && rows_2[0].User2_ID != user)) {
      res.redirect("/friends");
    }else{
      res.render("chats/index.ejs", {chatMessages: rows, userID: user, inboxID:inboxID, otherUsers: otherUser, otherUserName: userName[0].UserName});
    }

  },
  chatUpdate: async (inboxID, userID, message) => {
    // console.log(inboxID, userID, message, searchUser);
    await pool.query("INSERT INTO CHAT (Inbox_ID, SenderID, Message, DateSent) VALUES (?,?,?,NOW());", [inboxID, userID, message]);

    await pool.query("UPDATE INBOX SET Last_Message = ?, Last_UserID = ? WHERE InboxID = ?;", [message, userID, inboxID]);
  },
  chatGet: async (inboxID) => {
    let [rows, fields] = await pool.query("SELECT * FROM CHAT WHERE Inbox_ID = ?;", [inboxID]);
    return rows;
  },
  chatDelete: async (MessageID) => {
    await pool.query("DELETE FROM CHAT WHERE MessageID = ?;", [MessageID]);
  },
  chatCheck: async (req, res) => {
    let user = req.user.UserID;
    let otherUserID = req.params.id;
    let [rows, fields] = await pool.query("SELECT * FROM INBOX WHERE User1_ID IN (?,?) AND User2_ID IN (?,?)", [user, otherUserID, user, otherUserID]);

    if (rows.length > 0) {
      let inboxID = rows[0].InboxID;
      res.redirect(`/chat/${inboxID}`);
    } else {
      await pool.query("INSERT INTO INBOX (Last_Message, Last_UserID, User1_ID, User2_ID) VALUES (null, null, ?, ?);", [user, otherUserID]);

      let [rows_2, fields_2] = await pool.query("SELECT * FROM INBOX WHERE User1_ID IN (?,?) AND User2_ID IN (?,?)", [user, otherUserID, user, otherUserID]);

      let inboxID = rows_2[0].InboxID;

      res.redirect(`/chat/${inboxID}`);
    }
  }
};

let profilesController = {
  show: async (req, res) => {
    let userToFind = req.params.id;
    let loggedInUserId = req.user.UserID;

    try {
        // Fetch the user's profile data
        const [userRows] = await pool.query("SELECT * FROM USER WHERE UserID = ?;", [userToFind]);
        if (userRows.length === 0) {
            // Handle case where user is not found
          return res.status(404).send(`
            <html>
              <body>
                <h1>User not found, redirecting in <span id="countdown">3</span> seconds...</h1>
                <script>
                  var countdown = 3;
                  var countdownElement = document.getElementById('countdown');
          
                  var intervalId = setInterval(function() {
                    countdown--;
                    countdownElement.textContent = countdown;
          
                    if (countdown <= 0) {
                      clearInterval(intervalId);
                      window.location.href = "/";
                    }
                  }, 1000);
                </script>
              </body>
            </html>
          `);
        }
        // Fetch the posts made by the user
        const [postRows] = await pool.query("SELECT * FROM POST WHERE UserID = ?;", [userToFind]);

        // Fetch usernames and profile pictures associated with user IDs of the posts
        const userIds = postRows.map(post => post.UserID);
        const userDataMap = {};
        if (userIds.length > 0) {
            const [usernames] = await pool.query("SELECT UserID, UserName, ProfilePicture FROM USER WHERE UserID IN (?)", [userIds]);
            usernames.forEach(user => {
                userDataMap[user.UserID] = { username: user.UserName, profilePicture: user.ProfilePicture };
            });
        }

        // Fetch likes count for each post
        const postsWithLikes = await Promise.all(postRows.map(async post => {
            const [likeCount] = await pool.query("SELECT Likes FROM POST WHERE PostID = ?", [post.PostID]);
            return { ...post, likeCount: likeCount[0]?.Likes || 0 };
        }));

        res.render("profile.ejs", { id:loggedInUserId, otherUser: userRows[0], posts: postsWithLikes, userDataMap: userDataMap });
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).send("Internal Server Error");
    }
},

  update: async (req, res) => {
    let userToUpdate = req.params.id;
    let newUsername = req.body.username;
    let newNickname = req.body.nickname;
    let newProgram = req.body.program;
    let newStudentSet = req.body.studentSet;
    let newEmail = req.body.email;
    console.log(newStudentSet)
    // Access the uploaded profile picture
    const profilePicture = req.file;

    // Save the file path to the database
    let filePath = profilePicture ? profilePicture.path : null;

    // Replace backslashes with forward slashes
    if (filePath) {
      filePath = filePath.replace(/\\/g, '/');
    }

    // Update the user with the new fields only if the "Set" field is not empty
    if (newStudentSet !== undefined) {
      const sql = "UPDATE USER SET StudentSet = ?";
      const params = [newStudentSet]
      try {
        const result = await pool.query(sql, params);
        // Handle result here
      } catch (err) {
        console.log(err);
        // Handle error here
      }
    }
      const sql = "UPDATE USER SET UserName = ?, UserNickName = ?, Program = ?,  Email = ?, ProfilePicture = ? WHERE UserID = ?";
      const params = [newUsername, newNickname, newProgram, newEmail, filePath || req.user.ProfilePicture, userToUpdate];

      try {
        const result = await pool.query(sql, params);
        // Handle result here
      } catch (err) {
        console.log(err);
        // Handle error here
      }


    // Redirect the user to the profile page
    res.redirect(`/profile/${userToUpdate}`);
  },
  likePost: async (req, res) => {
    try {
      const userId = req.user.UserID;
      const postId = req.params.postId;

      const [existingLike] = await pool.query("SELECT * FROM COMMENT WHERE PostID = ? AND UserID = ?", [postId, userId]);

      if (existingLike.length > 0) {
        await pool.query("DELETE FROM COMMENT WHERE PostID = ? AND UserID = ?", [postId, userId]);
        await pool.query("UPDATE POST SET Likes = Likes - 1 WHERE PostID = ?", [postId]);
        return res.json({ success: true, liked: false });
      } else {
        await pool.query("INSERT INTO COMMENT (PostID, UserID) VALUES (?, ?)", [postId, userId]);
        await pool.query("UPDATE POST SET Likes = Likes + 1 WHERE PostID = ?", [postId]);
        return res.json({ success: true, liked: true });
      }
    } catch (error) {
      console.error("Error handling like action:", error);
      res.status(500).send('Internal Server Error');
    }
  }
};




let friendsController = {
  search: async (req, res) => {
    // Grabs all FriendRequests where the user is the sender and the receiver accepted the request
    const [friends] = await pool.query
    ("SELECT * FROM FRIEND WHERE UserID = ? AND FriendAccepted = 1", [req.user.UserID]);

    // Get the user object for each friend
    for (let i = 0; i < friends.length; i++) {
      const [friend] = await pool.query("SELECT * FROM USER WHERE UserID = ?", [friends[i].FriendUserID]);
      friends[i].Friend = friend[0];
    }

    // Grab all friend requests where the user is the receiver and accepted the request
    const[friends_2] = await pool.query
    ("SELECT * FROM FRIEND WHERE FriendUserID = ? AND FriendAccepted = 1", [req.user.UserID]);

    // Grab the user object for each friend
    for (let i = 0; i < friends_2.length; i++) {
      const [friend] = await pool.query("SELECT * FROM USER WHERE UserID = ?", [friends_2[i].UserID]);
      friends_2[i].Friend = friend[0];
    }


    const [receivedFriendRequests] = await pool.query
    ("SELECT * FROM FRIEND WHERE FriendUserID = ? AND FriendAccepted = 0", [req.user.UserID]);

    // Get the user object for each friend request
    for (let i = 0; i < receivedFriendRequests.length; i++) {
      const [friendRequest] = await pool.query("SELECT * FROM USER WHERE UserID = ?", [receivedFriendRequests[i].UserID]);
      receivedFriendRequests[i].User = friendRequest[0];
    }

    const user = req.user.UserID;
      const [inboxes] = await pool.query("SELECT * FROM INBOX WHERE User1_ID = ? OR User2_ID = ?", [user, user]);

    const otherUsers = await Promise.all(inboxes.map(async row => {
      const otherUserId = (row.User1_ID === user) ? row.User2_ID : row.User1_ID;
      const [[otherUser]] = await pool.query("SELECT UserName, ProfilePicture FROM USER WHERE UserID = ?", [otherUserId]);
      return {
        otherUserID: otherUserId,
        otherUserName: otherUser.UserName,
        lastMessage: row.Last_Message,
        profilePicture: otherUser.ProfilePicture,
        inboxID: row.InboxID
      };
    }));

    res.render("friends/index", {friends: friends, receivedFriendRequests: receivedFriendRequests, friends_2: friends_2, otherUsers: otherUsers});
  },
  displayResults: async (req, res) => {
    const searchQuery = req.query.query;
    // This query will return all users that match the search query except the user who is currently logged in
    const [results] = await pool.query
    ("SELECT * FROM USER WHERE UserNickName LIKE ? AND UserID != ?", [`%${searchQuery}%`, req.user.UserID]);

    // This query will return all friend requests that the user has sent
    const [existingFriendRequests] = await pool.query("SELECT * FROM FRIEND WHERE UserID = ?", [req.user.UserID]);

    // This query will return all friend requests that the user has received
    const [existingFriendRequests_2] = await pool.query("SELECT * FROM FRIEND WHERE FriendUserID = ?", [req.user.UserID]);

    const user = req.user.UserID;
      const [inboxes] = await pool.query("SELECT * FROM INBOX WHERE User1_ID = ? OR User2_ID = ?", [user, user]);

    const otherUsers = await Promise.all(inboxes.map(async row => {
      const otherUserId = (row.User1_ID === user) ? row.User2_ID : row.User1_ID;
      const [[otherUser]] = await pool.query("SELECT UserName, ProfilePicture FROM USER WHERE UserID = ?", [otherUserId]);
      return {
        otherUserID: otherUserId,
        otherUserName: otherUser.UserName,
        lastMessage: row.Last_Message,
        profilePicture: otherUser.ProfilePicture,
        inboxID: row.InboxID
      };
    }));

    res.render('searchResults', { results: results, existingFriendRequests: existingFriendRequests,
      existingFriendRequests_2: existingFriendRequests_2, otherUsers: otherUsers});
  },
  addFriend: async (req, res) => {
    const friendID = req.params.id;
    const userID = req.user.UserID;

    await pool.query("INSERT INTO FRIEND (UserID, FriendUserID, FriendAccepted) VALUES (?, ?, 0)", [userID, friendID]);
    res.redirect('/friends');
  },
  acceptFriend: async (req, res) => {
    const friendID = req.params.id;
    const userID = req.user.UserID;
    await pool.query("UPDATE FRIEND SET FriendAccepted = 1 WHERE UserID = ? AND FriendUserID = ?", [friendID, userID]);
    res.redirect('/friends');

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
      banner: await keywordToImage(req.body.keyword, res)
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

module.exports = {remindersController, postsController, profilesController, chatController, friendsController, mainFeedController};