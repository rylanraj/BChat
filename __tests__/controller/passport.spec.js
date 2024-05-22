// passport.spec.js
const passport = require("../../middleware/passport");
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const flash = require('connect-flash');
const pool = mysql.createPool({}).promise();

jest.mock('bcrypt', () => ({
    compare: jest.fn(),
}));

jest.mock('mysql2', () => ({
    createPool: jest.fn().mockReturnThis(),
    promise: jest.fn().mockReturnThis(),
    query: jest.fn(),
}));

jest.mock('connect-flash', () => jest.fn());

describe('LocalStrategy', () => {
    it('authenticates user successfully when credentials are valid and account is confirmed', async () => {
        const user = { UserID: '1', Password: 'hashedPassword', Confirmed: true };
        const password = 'password';
        bcrypt.compare.mockResolvedValueOnce(true);
        pool.query.mockResolvedValueOnce([[user]]);
        const done = jest.fn();

        await passport._strategies.local._verify({ flash: flash() }, 'test@test.com', password, done);

        expect(done).toHaveBeenCalledWith(null, user);
    });

    it('fails authentication when user is not confirmed', async () => {
        const user = { UserID: '1', Password: 'hashedPassword', Confirmed: false };
        const password = 'password';
        bcrypt.compare.mockResolvedValueOnce(true);
        pool.query.mockResolvedValueOnce([[user]]);
        const done = jest.fn();
        const req = { flash: jest.fn() };

        await passport._strategies.local._verify(req, 'test@test.com', password, done);

        expect(done).toHaveBeenCalledWith(null, false, undefined);
    });

    it('fails authentication when password is incorrect', async () => {
        const user = { UserID: '1', Password: 'hashedPassword', Confirmed: true };
        const password = 'wrongPassword';
        bcrypt.compare.mockResolvedValueOnce(false);
        pool.query.mockResolvedValueOnce([[user]]);
        const done = jest.fn();
        const req = { flash: jest.fn() };

        await passport._strategies.local._verify(req, 'test@test.com', password, done);

        expect(done).toHaveBeenCalledWith(null, false, undefined);
    });

    it('fails authentication when user is not found', async () => {
        const password = 'password';
        bcrypt.compare.mockResolvedValueOnce(true);
        pool.query.mockResolvedValueOnce([[]]);
        const done = jest.fn();
        const req = { flash: jest.fn() };

        await passport._strategies.local._verify(req, 'test@test.com', password, done);

        expect(done).toHaveBeenCalledWith(null, false, undefined);
    });
});