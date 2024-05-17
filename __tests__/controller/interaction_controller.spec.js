const mysql = require('mysql2');
const { mainFeedController, postsController } = require('../../controller/interaction_controller');
const { mockDeep, mockReset } = require('jest-mock-extended');
const { chatController, profilesController, friendsController, remindersController } = require('../../controller/interaction_controller');

jest.mock('mysql2', () => ({
    createPool: jest.fn().mockReturnThis(),
    promise: jest.fn().mockReturnThis(),
    query: jest.fn().mockResolvedValue([[{ InboxID: 'testInboxID' }]]),  // Mocked to return an array
}));

describe('mainFeedController', () => {
    const req = {
        isAuthenticated: jest.fn(),
    };
    const res = mockDeep({
        render: jest.fn(),
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
    });

    beforeEach(() => {
        mockReset(res);
        mysql.query.mockReset();
    });

    it('should fetch posts successfully', async () => {
        mysql.query.mockResolvedValueOnce([[]]); // No existing user
        await mainFeedController.index(req, res);
        expect(mysql.query).toHaveBeenCalledWith(expect.any(String)); // Select query
        expect(res.render).toHaveBeenCalledWith('index', expect.any(Object)); // Render index
    });

});

describe('postsController', () => {
    const req = {
        file: {
            path: 'testPath',
        },
        body: {
            title: 'testTitle',
            description: 'testDescription',
        },
        user: {
            UserID: 'testUserID',
        },
    };
    const res = mockDeep({
        render: jest.fn(),
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
    });

    beforeEach(() => {
        mockReset(res);
        mysql.query.mockReset();
    });

    it('should create a post successfully', async () => {
        await postsController.create(req, res);
        expect(mysql.query).toHaveBeenCalledWith(expect.any(String), expect.any(Array)); // Insert query
        expect(res.redirect).toHaveBeenCalledWith(expect.any(String)); // Redirect to profile
    });
});
describe('chatController', () => {
    const req = {
        user: {
            UserID: 'testUserID',
        },
        params: {
            id: 'testInboxID',
        },
    };
    const res = {
        render: jest.fn(),
        redirect: jest.fn(),
    };

    beforeEach(() => {
        jest.resetAllMocks();
        mysql.query.mockReset();
    });

    it('should redirect to friends if inbox does not exist or user is not part of the inbox', async () => {
        mysql.query.mockResolvedValueOnce([[]]);  // No inbox found
        await chatController.chat(req, res);
        expect(res.redirect).toHaveBeenCalledWith('/friends');
    });

    it('should render chat messages if inbox exists and user is part of the inbox', async () => {
        mysql.query.mockResolvedValueOnce([[{ User1_ID: req.user.UserID, User2_ID: 'otherUserID' }]]);  // Inbox found
        mysql.query.mockResolvedValueOnce([[{ Message: 'testMessage' }]]);  // Chat messages
        await chatController.chat(req, res);
        expect(res.render).toHaveBeenCalledWith('chats/index.ejs', expect.any(Object));
    });

    it('should update chat', async () => {
        const inboxID = 'testInboxID';
        const userID = 'testUserID';
        const message = 'testMessage';
        await chatController.chatUpdate(inboxID, userID, message);
        expect(mysql.query).toHaveBeenCalledTimes(2);
    });

    it('should get chat messages', async () => {
        const inboxID = 'testInboxID';
        mysql.query.mockResolvedValueOnce([[{ Message: 'testMessage' }]]);  // Chat messages
        const rows = await chatController.chatGet(inboxID);
        expect(rows).toEqual([{ Message: 'testMessage' }]);
    });

    it('should delete chat message', async () => {
        const messageID = 'testMessageID';
        await chatController.chatDelete(messageID);
        expect(mysql.query).toHaveBeenCalledWith('DELETE FROM CHAT WHERE MessageID = ?;', [messageID]);
    });

    it('should check chat and redirect to existing chat', async () => {
        mysql.query.mockResolvedValueOnce([[{ InboxID: 'testInboxID' }]]);  // Existing inbox
        await chatController.chatCheck(req, res);
        expect(res.redirect).toHaveBeenCalledWith('/chat/testInboxID');
    });
});
describe('profilesController', () => {
    const req = {
        params: {
            id: 'testUserID',
        },
        user: {
            UserID: 'testUserID',
        },
        body: {
            username: 'newUsername',
            nickname: 'newNickname',
            program: 'newProgram',
            studentSet: 'newStudentSet',
            email: 'newEmail',
        },
        file: {
            path: 'testPath',
        },
    };
    const res = {
        render: jest.fn(),
        redirect: jest.fn(),
    };

    beforeEach(() => {
        jest.resetAllMocks();
        mysql.query.mockReset();
    });

    it('should show profile of other user', async () => {
        req.params.id = 'otherUserID';
        mysql.query.mockResolvedValueOnce([[{ UserID: 'otherUserID' }]]);  // User found
        mysql.query.mockResolvedValueOnce([[{ PostID: 'testPostID' }]]);  // Posts found
        mysql.query.mockResolvedValueOnce([[{ UserID: 'otherUserID', UserName: 'otherUsername', ProfilePicture: 'otherProfilePicture' }]]);  // Usernames found
        await profilesController.show(req, res);
        expect(res.render).toHaveBeenCalledWith('profile.ejs', expect.any(Object));
    });

    it('should show profile of current user', async () => {
        req.params.id = req.user.UserID;
        mysql.query.mockResolvedValueOnce([[{ UserID: 'testUserID' }]]);  // User found
        mysql.query.mockResolvedValueOnce([[{ PostID: 'testPostID' }]]);  // Posts found
        await profilesController.show(req, res);
        expect(res.render).toHaveBeenCalledWith('profile.ejs', expect.any(Object));
    });

    it('should update profile', async () => {
        await profilesController.update(req, res);
        expect(mysql.query).toHaveBeenCalledTimes(2);
        expect(res.redirect).toHaveBeenCalledWith('/profile/testUserID');
    });
});
describe('friendsController', () => {
    const req = {
        user: {
            UserID: 'testUserID',
        },
        params: {
            id: 'friendUserID',
        },
        query: {
            query: 'searchQuery',
        },
    };
    const res = {
        render: jest.fn(),
        redirect: jest.fn(),
    };

    beforeEach(() => {
        jest.resetAllMocks();
        mysql.query.mockReset();
    });

    it('should search for friends', async () => {
        mysql.query.mockResolvedValueOnce([[{ FriendUserID: 'friendUserID' }]]);  // Friends found
        mysql.query.mockResolvedValueOnce([[{ UserID: 'friendUserID' }]]);  // User found
        mysql.query.mockResolvedValueOnce([[{ FriendUserID: 'friendUserID' }]]);  // Friends_2 found
        mysql.query.mockResolvedValueOnce([[{ UserID: 'friendUserID' }]]);  // User found
        mysql.query.mockResolvedValueOnce([[{ UserID: 'friendUserID' }]]);  // Received friend requests found
        mysql.query.mockResolvedValueOnce([[{ UserID: 'friendUserID' }]]);  // User found
        await friendsController.search(req, res);
        expect(res.render).toHaveBeenCalledWith('friends/index', expect.any(Object));
    });

    it('should display search results', async () => {
        mysql.query.mockResolvedValueOnce([[{ UserID: 'searchResultUserID' }]]);  // Search results found
        mysql.query.mockResolvedValueOnce([[{ FriendUserID: 'friendUserID' }]]);  // Existing friend requests found
        mysql.query.mockResolvedValueOnce([[{ UserID: 'friendUserID' }]]);  // Existing friend requests_2 found
        await friendsController.displayResults(req, res);
        expect(res.render).toHaveBeenCalledWith('searchResults', expect.any(Object));
    });

    it('should add a friend', async () => {
        await friendsController.addFriend(req, res);
        expect(mysql.query).toHaveBeenCalledWith('INSERT INTO FRIEND (UserID, FriendUserID, FriendAccepted) VALUES (?, ?, 0)', [req.user.UserID, req.params.id]);
        expect(res.redirect).toHaveBeenCalledWith('/friends');
    });

    it('should accept a friend', async () => {
        await friendsController.acceptFriend(req, res);
        expect(mysql.query).toHaveBeenCalledWith('UPDATE FRIEND SET FriendAccepted = 1 WHERE UserID = ? AND FriendUserID = ?', [req.params.id, req.user.UserID]);
        expect(res.redirect).toHaveBeenCalledWith('/friends');
    });
});
describe('remindersController', () => {
    const req = {
        user: {
            UserID: 'testUserID',
        },
        params: {
            id: 'reminderID',
        },
        body: {
            title: 'testTitle',
            description: 'testDescription',
            keyword: 'testKeyword',
        },
    };
    const res = {
        render: jest.fn(),
        redirect: jest.fn(),
    };

    beforeEach(() => {
        jest.resetAllMocks();
        mysql.query.mockReset();
    });

    it('should list reminders', async () => {
        mysql.query.mockResolvedValueOnce([[{ ReminderID: 'reminderID' }]]);  // Reminders found
        await remindersController.list(req, res);
        expect(res.render).toHaveBeenCalledWith('reminder/index', expect.any(Object));
    });

    it('should render new reminder form', () => {
        remindersController.new(req, res);
        expect(res.render).toHaveBeenCalledWith('reminder/create');
    });

    it('should list one reminder', async () => {
        mysql.query.mockResolvedValueOnce([[{ ReminderID: 'reminderID' }]]);  // Reminder found
        await remindersController.listOne(req, res);
        expect(res.render).toHaveBeenCalledWith('reminder/single-reminder', expect.any(Object));
    });

    it('should create a reminder', async () => {
        await remindersController.create(req, res);
        expect(mysql.query).toHaveBeenCalledWith('INSERT INTO REMINDER (Title, Description, Completed, UserID, Keyword, Banner) VALUES (?, ?, ?, ?,?,?)', [req.body.title, req.body.description, false, req.user.UserID, req.body.keyword, expect.any(String)]);
        expect(res.redirect).toHaveBeenCalledWith('/reminders');
    });

    it('should edit a reminder', async () => {
        mysql.query.mockResolvedValueOnce([[{ ReminderID: 'reminderID' }]]);  // Reminder found
        await remindersController.edit(req, res);
        expect(res.render).toHaveBeenCalledWith('reminder/edit', expect.any(Object));
    });

    it('should update a reminder', async () => {
        mysql.query.mockResolvedValueOnce([[{ ReminderID: 'reminderID' }]]);  // Reminder found
        await remindersController.update(req, res);
        expect(mysql.query).toHaveBeenCalledWith('UPDATE REMINDER SET Title = ?, Description = ?, Completed = ? WHERE ReminderID = ?', [req.body.title, req.body.description, 0, req.params.id]);
        expect(res.redirect).toHaveBeenCalledWith('/reminders');
    });

    it('should delete a reminder', async () => {
        await remindersController.delete(req, res);
        expect(mysql.query).toHaveBeenCalledWith('DELETE FROM REMINDER WHERE ReminderID = ? AND UserID = ?;', [req.params.id, req.user.UserID]);
        expect(res.redirect).toHaveBeenCalledWith('/reminders');
    });
});