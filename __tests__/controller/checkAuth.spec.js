// checkAuth.spec.js
const { ensureAuthenticated, forwardAuthenticated, isAdmin } = require("../../middleware/checkAuth");

const express = {
    response: {
        locals: {},
        redirect: jest.fn(),
    },
};

jest.mock('express', () => ({
    response: {
        locals: {},
        redirect: jest.fn(),
    },
}));

describe('checkAuth', () => {
    it('ensures user is authenticated', () => {
        const req = { isAuthenticated: jest.fn().mockReturnValue(true) };
        const res = { ...express.response };
        const next = jest.fn();

        ensureAuthenticated(req, res, next);

        expect(res.locals.isAuthenticated).toBe(true);
        expect(next).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
    });

    it('redirects to login when user is not authenticated', () => {
        const req = { isAuthenticated: jest.fn().mockReturnValue(false) };
        const res = { ...express.response };
        const next = jest.fn();

        ensureAuthenticated(req, res, next);

        expect(res.locals.isAuthenticated).toBe(false);
        expect(next).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/login');
    });

    it('does not forward authenticated user', () => {
        const req = { isAuthenticated: jest.fn().mockReturnValue(true) };
        const res = { ...express.response };
        const next = jest.fn();

        forwardAuthenticated(req, res, next);

        expect(res.locals.isAuthenticated).toBe(true);
        expect(next).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/reminders');
    });

    it('redirects non-admin user', () => {
        const req = { isAuthenticated: jest.fn().mockReturnValue(true), user: { role: 'user' } };
        const res = { ...express.response };
        const next = jest.fn();

        isAdmin(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/reminders');
    });

    it('redirects unauthenticated user', () => {
        const req = { isAuthenticated: jest.fn().mockReturnValue(false), user: { role: 'user' } };
        const res = { ...express.response };
        const next = jest.fn();

        isAdmin(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/login');
    });
});