const bcrypt = require('bcrypt');
const { authController, hashPassword, sendConfirmationEmail } = require('../../controller/auth_controller');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');


const mockQuery = jest.fn();
const mockSendMail = jest.fn();

jest.mock('mysql2', () => {
    const mPool = {
        query: mockQuery,
        promise: jest.fn().mockReturnThis(),
    };
    return {
        createPool: jest.fn(() => mPool),
    };
});

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

});


