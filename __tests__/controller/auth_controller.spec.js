const bcrypt = require('bcrypt');
const { authController, hashPassword, sendConfirmationEmail } = require('../../controller/auth_controller');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');


const mockQuery = jest.fn();
const mockSendMail = jest.fn();

jest.mock('mysql2', () => ({
    createPool: jest.fn().mockReturnThis(),
    promise: jest.fn().mockReturnThis(),
    query: jest.fn(),
}));

jest.mock('nodemailer', () => {
    return {
        createTransport: jest.fn(() => ({
            sendMail: mockSendMail,
        })),
    };
});

describe('hashPassword', () => {
    it('should return a hashed password for a valid password', async () => {
        const password = 'password123';
        const hashedPassword = await hashPassword(password);
        const match = await bcrypt.compare(password, hashedPassword);
        expect(match).toBe(true);
    });

    it('should throw an error for a null password', async () => {
        await expect(hashPassword(null)).rejects.toThrow('Error hashing password');
    });

    it('should throw an error for an undefined password', async () => {
        await expect(hashPassword(undefined)).rejects.toThrow('Error hashing password');
    });
});

describe('authController', () => {
    beforeEach(() => {
        jest.resetAllMocks();  // Reset mocks before each test
        mockQuery.mockReset();
        jest.spyOn(console, 'error').mockImplementation(() => { });  // Suppress console.error
    });

    describe('login', () => {
        it('should render login page with error message when there is an error', async () => {
            const req = { flash: jest.fn().mockReturnValue(['error message']) };
            const res = { render: jest.fn() };

            await authController.login(req, res);

            expect(res.render).toHaveBeenCalledWith("auth/login", { message: 'error message' });
        });

        it('should render login page without error message when there is no error', async () => {
            const req = { flash: jest.fn().mockReturnValue([]) };
            const res = { render: jest.fn() };

            await authController.login(req, res);

            expect(res.render).toHaveBeenCalledWith("auth/login", { message: null });
        });
    });

    describe('register', () => {
        it('should render register page', async () => {
            const req = { isAuthenticated: jest.fn().mockReturnValue(true) };
            const res = { render: jest.fn() };

            await authController.register(req, res);

            expect(res.render).toHaveBeenCalledWith("auth/register", { isAuthenticated: true });
        });
    });

    describe('logout', () => {
        it('should logout and redirect to login page', async () => {
            const req = { logout: jest.fn() };
            const res = { redirect: jest.fn() };

            await authController.logout(req, res);

            expect(req.logout).toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith("/login");
        });
    });
    describe('registerSubmit', () => {
        it('should reload the page with an error if any fields are empty', async () => {
            const req = {
                body: {
                    name: '',
                    email: '',
                    password: '',
                    username: ''
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = { render: jest.fn() };

            await authController.registerSubmit(req, res);

            expect(res.render).toHaveBeenCalledWith("auth/register", { error: "All fields are required", isAuthenticated: false });
        });
        it('should make MySQL fetch a user with the email to make sure the email is not taken', async () => {
            const req = {
                body: {
                    name: 'Rylan Raj',
                    email: 'rraj13@my.bcit.ca',
                    password: 'GoodPassword',
                    username: 'rylanraj'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = { render: jest.fn() };
            await authController.registerSubmit(req, res);
            expect(mysql.query).toHaveBeenCalledWith('SELECT * FROM bchat_users.user WHERE Email = ?;', [req.body.email]);
        });
        it('should reload the page with an error if the email is already taken', async () => {
            const req = {
                body: {
                    name: 'Rylan Raj',
                    email: 'rraj13@my.bcit.ca',
                    password: 'GoodPassword',
                    username: 'rylanraj'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = { render: jest.fn() };
            mysql.query.mockReturnValueOnce([[{ Email: 'rraj13@my.bcit.ca' }]]);
            await authController.registerSubmit(req, res);
            expect(res.render).toHaveBeenCalledWith("auth/register", { error: "User with this email already exists", isAuthenticated: false });
        });
        it('should reload the page with an error if the password is less than 8 characters', async () => {
            const req = {
                body: {
                    name: 'Rylan Raj',
                    email: 'rraj13@my.bcit.ca',
                    password: 'Tiny',
                    username: 'rylanraj'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = { render: jest.fn() };
            mysql.query.mockReturnValueOnce([[]]);
            await authController.registerSubmit(req, res);
            expect(res.render).toHaveBeenCalledWith("auth/register", { error: "Password must be at least 8 characters long", isAuthenticated: false });
        });
        it('should reload the page with an error if the email is not a bcit email', async () => {
            const req = {
                body: {
                    name: 'Rylan Raj',
                    email: 'rylan.raj@gmail.com',
                    password: 'GoodPassword',
                    username: 'rylanraj'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = { render: jest.fn() };
            mysql.query.mockReturnValueOnce([[]]);
            await authController.registerSubmit(req, res);
            expect(res.render).toHaveBeenCalledWith("auth/register", { error: "Please use your myBCIT email", isAuthenticated: false });
        });
    });
});

