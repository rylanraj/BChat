const mysql = require('mysql2');
const { mainFeedController, postsController } = require('../../controller/interaction_controller');
const { mockDeep, mockReset } = require('jest-mock-extended');

jest.mock('mysql2', () => ({
    createPool: jest.fn().mockReturnThis(),
    promise: jest.fn().mockReturnThis(),
    query: jest.fn(),
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