const bcrypt = require('bcrypt');
const authController = require('../../controller/auth_controller'); // import the authController object

describe('hashPassword', () => {
    it('should return a hashed password for a valid password', async () => {
        const password = 'password123';
        const hashedPassword = await authController.hashPassword(password); // access hashPassword as a property of authController
        const match = await bcrypt.compare(password, hashedPassword);
        expect(match).toBe(true);
    });


    it('should throw an error for a null password', async () => {
        await expect(authController.hashPassword(null)).rejects.toThrow('Error hashing password'); // access hashPassword as a property of authController
    });

    it('should throw an error for an undefined password', async () => {
        await expect(authController.hashPassword(undefined)).rejects.toThrow('Error hashing password'); // access hashPassword as a property of authController
    });
});