const passport = require("./middleware/passport")
const express = require("express");
const session = require("express-session");
const app = express();
const path = require("path");
const ejsLayouts = require("express-ejs-layouts");
const interactionController = require("./controller/interaction_controller");
const {authController} = require("./controller/auth_controller");
const { forwardAuthenticated, ensureAuthenticated, isAdmin } = require("./middleware/checkAuth");
const multer = require('multer');
const fs = require('fs');
const mysql = require("mysql2");
const flash = require('connect-flash');
require('dotenv').config()

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
}).promise();

const socketIO = require('socket.io');
const http = require('http');
const server=http.createServer(app);
const io = socketIO(server);


app.use(express.static("public"));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Adds session
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.urlencoded({ extended: false }));

app.use(ejsLayouts);

app.use((req, res, next) => {
  // Path to the logo
  res.locals.logo = '/images/logo.png';
  next();
});

// Initializes passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware to pass user data to all routes
app.use((req, res, next) => {
    res.locals.user = req.user;
    next();
});

// Flash messages
app.use(flash());

app.set("view engine", "ejs");

// Routes start here
app.get("/",ensureAuthenticated, interactionController.mainFeedController.index);

app.post('/like/:postId', interactionController.mainFeedController.likePost);
app.post('/report/:postId', interactionController.mainFeedController.reportPost);

app.get("/post/new", ensureAuthenticated, interactionController.postsController.new);
app.post("/post/new", ensureAuthenticated, interactionController.postsController.new);
app.get("/reminders", ensureAuthenticated, interactionController.remindersController.list);
app.get("/reminder/new", ensureAuthenticated, interactionController.remindersController.new);
app.get("/reminder/:id", ensureAuthenticated, interactionController.remindersController.listOne);
app.get("/reminder/:id/edit", ensureAuthenticated, interactionController.remindersController.edit);
app.post("/reminder/", ensureAuthenticated, interactionController.remindersController.create);

// Edit post
app.get("/post/edit/:id", ensureAuthenticated, interactionController.postsController.edit);

// Delete post
app.post("/post/delete/:id", interactionController.postsController.delete);

// ⭐ Implement these two routes below!
app.post("/reminder/update/:id", interactionController.remindersController.update);
app.post("/reminder/delete/:id", interactionController.remindersController.delete);

// 👌 Ignore for now
app.get("/register", authController.register);
app.get("/login", forwardAuthenticated, authController.login);
app.post("/login", authController.loginSubmit);
app.post("/register", authController.registerSubmit);
app.get("/confirm-email", authController.confirmEmail);
app.post("/confirm_email", authController.confirmEmailSubmit);

// Profiles
app.get("/profile/:id", ensureAuthenticated, interactionController.profilesController.show);

// Posts
app.get("/post/:id", ensureAuthenticated, interactionController.postsController.show);
// Comments
app.post("/addComment/:id", interactionController.postsController.comment);

// Account confirmation
app.get('/confirm/:token', async (req, res) => {
    const token = req.params.token;

    try {
        // Validate the token against the database
        const [users] = await pool.query("SELECT * FROM bchat_users.USER WHERE ConfirmationToken = ?;", [token]);

        if (users.length > 0) {
            // If a user with the token exists, mark them as confirmed
            await pool.query("UPDATE bchat_users.USER SET Confirmed = 1 WHERE ConfirmationToken = ?;", [token]);

            res.send('Your account has been confirmed!');
        } else {
            res.send('Invalid confirmation token.');
        }
    } catch (error) {
        console.error("Error confirming user:", error);
        res.status(500).send("Internal Server Error");
    }
});
app.get('/confirm_github/:token', authController.confirmGitHubEmail);

// Adding friends
app.get("/friends", ensureAuthenticated, interactionController.friendsController.search);
app.get('/search', ensureAuthenticated, interactionController.friendsController.displayResults);
app.get('/addFriend/:id', ensureAuthenticated, interactionController.friendsController.addFriend);
app.post('/acceptFriend/:id', ensureAuthenticated, interactionController.friendsController.acceptFriend);

// Chat
app.get("/chat/:id", ensureAuthenticated, interactionController.chatController.chat);
app.get("/chat/check/:id", ensureAuthenticated, interactionController.chatController.chatCheck)

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        fs.mkdir('uploads/', { recursive: true }, (err) => {});
        cb(null, 'uploads/'); // Directory where uploaded files will be stored
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Unique filename
    }
});

const upload = multer({ storage: storage });

app.post("/profile/:id", ensureAuthenticated, upload.single('profilePicture'), interactionController.profilesController.update);

// Define route for handling file uploads
app.post('/upload', ensureAuthenticated, upload.single('photo'), interactionController.postsController.create);
// For editing posts
app.post('/post/edit/:id', ensureAuthenticated, upload.single('photo'), interactionController.postsController.editSubmit);

// Github login
app.get('/github',
    passport.authenticate('github'));

app.get('/github/callback',
    passport.authenticate('github', {
        failureRedirect: '/login',
        failureMessage: true }),
    async function (req, res) {
        // Check if the user's email is confirmed
        if (!req.user.Confirmed == true || req.user.Password === "tempPassword") {
            // If the email is not confirmed, destroy the session and redirect to a specific page
            req.session.destroy(function (err) {
                if (err) {
                    console.log(err);
                } else {
                    res.redirect('/confirm-email');
                }
            });
        } else {
            // If the email is confirmed, redirect to the home page
            res.redirect('/');
        }
    }
);


app.get("/logout", authController.logout);

// Admin
app.get("/admin", isAdmin, authController.adminPanel);
app.get("/admin/revoke/:SessionID", isAdmin, authController.revokeSession);
app.get("/admin/remove/:postID", isAdmin, authController.removePost);




io.on('connection', (socket) => {
  socket.on('chat message', async (data) => {
    let {inboxID, userID, message} = data;
    
    await interactionController.chatController.chatUpdate(inboxID, userID, message);

    const chatMessages = await interactionController.chatController.chatGet(inboxID);
    
    await io.emit('new message', chatMessages)
  });
  socket.on('delete message', async (data) => {
    let {MessageID, inboxID} = data;
    
    await interactionController.chatController.chatDelete(MessageID);
    
    const chatMessages = await interactionController.chatController.chatGet(inboxID);
  
    await io.emit('new message', chatMessages)

  });
});


server.listen(3001, function () {
  console.log(
    "Server running. Visit: http://localhost:3001/ in your browser 🚀"
  );
});
