CREATE DATABASE bchat_users;
USE bchat_users;

CREATE TABLE USER (
	UserID INT AUTO_INCREMENT PRIMARY KEY,
    UserName VARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL,
    GitHubEmail VARCHAR(100),
    Password VARCHAR(100) NOT NULL,
    Role VARCHAR(100) NOT NULL,
    StudentSet CHAR(1),
    Program VARCHAR(100),
    DateJoined DATE,
    ProfilePicture VARCHAR(200),
    UserNickName VARCHAR(30),
    Confirmed BOOLEAN,
    ConfirmationToken VARCHAR(100)
);
CREATE TABLE REMINDER (
    ReminderID INT AUTO_INCREMENT PRIMARY KEY,
    Title VARCHAR(100) NOT NULL,
    Description VARCHAR(100) NOT NULL,
    Completed BOOLEAN NOT NULL,
    Keyword VARCHAR(100),
    Banner VARCHAR(300),
    UserID INT,
    FOREIGN KEY (UserID) REFERENCES USER(UserID)
);
CREATE TABLE FRIEND (
    FriendID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT,
    FriendUserID INT,
    FriendAccepted BOOLEAN,
    FOREIGN KEY (UserID) REFERENCES USER(UserID),
    FOREIGN KEY (FriendUserID) REFERENCES USER(UserID)
);
CREATE TABLE POST (
    PostID INT AUTO_INCREMENT PRIMARY KEY,
    Title VARCHAR(100) NOT NULL,
    Description VARCHAR(150),
    UserID INT,
    FOREIGN KEY (UserID) REFERENCES USER(UserID),
    Picture VARCHAR(200),
    TimePosted DATETIME NOT NULL,
    Likes INT DEFAULT 0
);
CREATE TABLE COMMENT (
    CommentID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT,
    FOREIGN KEY (UserID) REFERENCES USER(UserID),
    PostID INT,
    FOREIGN KEY (PostID) REFERENCES POST(PostID),
    ParentCommentID INT,
    Content VARCHAR(200),
    TimePosted DATETIME NOT NULL
);
CREATE TABLE POST_LIKE (
    CommentID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT,
    FOREIGN KEY (UserID) REFERENCES USER(UserID),
    PostID INT,
    FOREIGN KEY (PostID) REFERENCES POST(PostID)
);
CREATE TABLE INBOX (
	InboxID INT AUTO_INCREMENT PRIMARY KEY,
    Last_Message VARCHAR(200),
    Last_UserID INT,
    User1_ID INT NOT NULL,
    User2_ID INT NOT NULL,
    FOREIGN KEY (Last_UserID) REFERENCES USER(UserID),
    FOREIGN KEY (User1_ID) REFERENCES USER(UserID),
    FOREIGN KEY (User2_ID) REFERENCES USER(UserID)
);
CREATE TABLE CHAT (
    MessageID INT AUTO_INCREMENT PRIMARY KEY,
    Inbox_ID INT,
    SenderID INT,
    Message VARCHAR(200),
    DateSent DATETIME NOT NULL,
    FOREIGN KEY (Inbox_ID) REFERENCES INBOX(InboxID),
    FOREIGN KEY (SenderID) REFERENCES USER(UserID)
);
CREATE TABLE CHANGE_GITHUB_EMAIL_REQUEST (
    ChangeGitHubEmailRequestID INT AUTO_INCREMENT PRIMARY KEY,
    BCITEmail VARCHAR(100) NOT NULL,
    NewGitHubEmail VARCHAR(100) NOT NULL,
    Token VARCHAR(100) NOT NULL
);
CREATE TABLE REPORT (
    ReportID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT,
    Description VARCHAR(200),
    FOREIGN KEY (UserID) REFERENCES USER(UserID),
    PostID INT,
    FOREIGN KEY (PostID) REFERENCES POST(PostID)
);