const passport = require("./middleware/passport")
const express = require("express");
const session = require("express-session");
const app = express();
const path = require("path");
const ejsLayouts = require("express-ejs-layouts");
const interactionController = require("./controller/interaction_controller");
const authController = require("./controller/auth_controller");
const { forwardAuthenticated, ensureAuthenticated, isAdmin } = require("./middleware/checkAuth");
const multer = require('multer');
const fs = require('fs');
require('dotenv').config()
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

app.set("view engine", "ejs");

// Routes start here
app.get("/",ensureAuthenticated, interactionController.mainFeedController.index);
app.get("/post/new", ensureAuthenticated, interactionController.postsController.new);
app.post("/post/new", ensureAuthenticated, interactionController.postsController.new);
app.get("/reminders", ensureAuthenticated, interactionController.remindersController.list);
app.get("/reminder/new", ensureAuthenticated, interactionController.remindersController.new);
app.get("/reminder/:id", ensureAuthenticated, interactionController.remindersController.listOne);
app.get("/reminder/:id/edit", ensureAuthenticated, interactionController.remindersController.edit);
app.post("/reminder/", ensureAuthenticated, interactionController.remindersController.create);

// ⭐ Implement these two routes below!
app.post("/reminder/update/:id", interactionController.remindersController.update);
app.post("/reminder/delete/:id", interactionController.remindersController.delete);

// 👌 Ignore for now
app.get("/register", authController.register);
app.get("/login", forwardAuthenticated, authController.login);
app.post("/login", authController.loginSubmit);
app.post("/register", authController.registerSubmit);

// Profiles
app.get("/profile/:id", ensureAuthenticated, interactionController.profilesController.show);


// Adding friends
app.get("/friends", ensureAuthenticated, interactionController.friendsController.search);
app.get('/search', ensureAuthenticated, interactionController.friendsController.displayResults);
app.post('/addFriend/:id', ensureAuthenticated, interactionController.friendsController.addFriend);
app.post('/acceptFriend/:id', ensureAuthenticated, interactionController.friendsController.acceptFriend);

// Chat
app.get("/chat/:id", ensureAuthenticated, interactionController.chatController.chat)
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

// Now you can use 'upload' in your routes
app.post("/profile/:id", ensureAuthenticated, upload.single('profilePicture'), interactionController.profilesController.update);

// Define route for handling file uploads
app.post('/upload', ensureAuthenticated, upload.single('photo'), interactionController.postsController.create);

// Github login
app.get('/github',
    passport.authenticate('github'));

app.get('/github/callback',
    passport.authenticate('github', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureMessage: true }),
    function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/');
    }
);


app.get("/logout", authController.logout);

// Admin
app.get("/admin", isAdmin, authController.adminPanel);
app.get("/admin/revoke/:SessionID", isAdmin, authController.revokeSession);



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
    "Server running. Visit: http://localhost:3001/reminders in your browser 🚀"
  );
});
