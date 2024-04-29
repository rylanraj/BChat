let userModel = require("../database").userModel;

let userController = {
    getUserByEmailIdAndPassword: (email, password) => {
        let user = userModel.findOne(email);
        if (user) {
          if (userController.isUserValid(user, password)) {
            return user;
          }
        }
        return null;
    },
    getUserById: (id) => {
        let user = userModel.findById(id);
        if (user) {
          return user;
        }
        return null;
    },
    isUserValid: (user, password) => {
        return user.password === password;
    }
  };

  module.exports = userController;
