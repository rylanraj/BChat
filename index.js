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
app.get("/", function(req, res){
    res.render("index", { isAuthenticated: req.isAuthenticated() });
})
app.get("/post/new", ensureAuthenticated, interactionController.postsController.new)
app.post("/post/new", ensureAuthenticated, interactionController.postsController.new)
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
app.post('/upload', upload.single('photo'), (req, res) => {
  // Handle file upload here
  // You can access the uploaded file using req.file
  // For example, you can save the file to a database or perform other operations
  res.send('File uploaded successfully');
});

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






app.listen(3001, function () {
  console.log(
    "Server running. Visit: http://localhost:3001/reminders in your browser 🚀"
  );
});
