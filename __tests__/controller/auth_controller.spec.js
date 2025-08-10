const bcrypt = require('bcrypt');
const { authController, hashPassword, sendConfirmationEmail } = require('../../controller/auth_controller');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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
            sendMail: jest.fn(),
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
            expect(mysql.query).toHaveBeenCalledWith('SELECT * FROM USER WHERE Email = ?;', [req.body.email]);
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
        it('should hash the password before storing it in MySQL', async () => {
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
            const res = {render: jest.fn()};
            mysql.query.mockReturnValueOnce([[]]);
            bcrypt.hash = jest.fn(() => Promise.resolve('hashedPassword'));
            await authController.registerSubmit(req, res);
            expect(bcrypt.hash).toHaveBeenCalledWith(req.body.password, expect.any(String));
        });
        it('should generate an email confirmation token', async() => {
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
            const res = {render: jest.fn()};
            mysql.query.mockReturnValueOnce([[]]);
            const spy = jest.spyOn(crypto, 'randomBytes');
            await authController.registerSubmit(req, res);
            expect(spy).toHaveBeenCalled();
        });
    });
    describe('confirmEmailSubmit', () => {
        it('should check if the BCIT email ends with my.bcit.ca', async () => {
            const req = {
                body: {
                    GitHubEmail: 'rylan.raj@gmail.com',
                    BCITEmail: 'rylan.raj@gmail.com'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = {render: jest.fn()};
            await authController.confirmEmailSubmit(req, res);
            expect(res.render).toHaveBeenCalledWith("auth/confirm_email", {
                error: "Please use your myBCIT email",
                isAuthenticated: false
            });
        });
        it('should check if there is already a local account with the BCIT email', async () => {
            const req = {
                body: {
                    GitHubEmail: 'rylan.raj@gmail.com',
                    BCITEmail: 'rraj13@my.bcit.ca'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = {render: jest.fn()};
            mysql.query.mockReturnValueOnce([[{ Email: 'rraj13@my.bcit.ca', GitHubEmail: 'rylan.raj@gmail.com' }]]);
            crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('randomBytes'));
            await authController.confirmEmailSubmit(req, res);
            expect(res.render).toHaveBeenCalledWith("auth/confirm_email", {
                error: "An email has been sent to your BCIT email to confirm the change to your GitHub email",
                isAuthenticated: false
            });
        });
        it('should reload the page with an error if a password is required and a short password is given', async () => {
            const req = {
                body: {
                    GitHubEmail: 'rraj13@my.bcit.ca',
                    BCITEmail: 'rraj13@my.bcit.ca',
                    Password: 'BadPass'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = {render: jest.fn()};
            mysql.query.mockReturnValueOnce([[{
                Email: 'rraj13@my.bcit.ca',
                GitHubEmail: 'rraj13@my.bcit.ca',
                Password: 'tempPassword'
            }]]);
            await authController.confirmEmailSubmit(req, res);
            expect(res.render).toHaveBeenCalledWith("auth/confirm_email", {
                error: "Password must be at least 8 characters long",
                isAuthenticated: false
            });
        });
        it('should hash the password if a password is required and given', async () => {
            const req = {
                body: {
                    GitHubEmail: 'rraj13@my.bcit.ca',
                    BCITEmail: 'rraj13@my.bcit.ca',
                    Password: 'GoodPassword'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = {render: jest.fn(), redirect: jest.fn()};
            mysql.query.mockReturnValueOnce([[{
                Email: 'rraj13@my.bcit.ca',
                GitHubEmail: 'rraj13@my.bcit.ca',
            }]]);
            bcrypt.hash = jest.fn(() => Promise.resolve('GoodPassword'));
            crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('randomBytes'));
            await authController.confirmEmailSubmit(req, res);
            expect(res.redirect).toHaveBeenCalledWith('/login');
        });
        it('should force users that registered with GitHub to link their BCIT email and provide a password', async () => {
            const req = {
                body: {
                    GitHubEmail: 'rylan.raj@gmail.com',
                    BCITEmail: 'rraj13@my.bcit.ca',
                    Password: 'GoodPassword'
                },
                isAuthenticated: jest.fn().mockReturnValue(false),
                flash: jest.fn().mockReturnValue([])
            };
            const res = {render: jest.fn(), redirect: jest.fn()};
            mysql.query.mockReturnValueOnce([[{
                Email: 'rylan.raj@gmail.com',
                GitHubEmail: 'rylan.raj@gmail.com',
            }]]);

            crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('randomBytes'));
            await authController.confirmEmailSubmit(req, res);
            expect(mysql.query).toHaveBeenCalledTimes(2);
            expect(res.redirect).toHaveBeenCalledWith('/login');
        })
    });
});


