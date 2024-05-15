let Database = [
  {
    id: 1,
    name: "Cindy Doe",
    email: "cindy123@gmail.com",
    password: "test",
    role: "admin",
    reminders: [
      {
        id: 1,
        title: "Grocery shopping",
        description: "Buy milk and bread from safeway",
        completed: false,
      },
      {
        id: 2,
        title: "Grocery shopping2",
        description: "Buy milk and bread from safeway",
        completed: false,
      },
      {
        id: 3,
        title: "Grocery shopping3",
        description: "Buy milk and bread from safeway",
        completed: false,
      },
    ],
  },
  {
    id: 2,
    name: "Jimmy Doe",
    email: "jimmy123@gmail.com",
    password: "test",
    role: "regular",
    reminders: [
      {
        id: 1,
        title: "Car shopping",
        description: "Buy a Honda Civic",
        completed: false,
      },
    ],
  },
];

const userModel = {
    findOne: (email) => {
      email = email.email
      console.log(email)
      const user = Database.find((user) => user.email === email);
      if (user) {
        return user;
      }
      console.log(`Couldn't find user with email: ${email}`);
    },
  findById: (id) => {
    const user = Database.find((user) => user.id === id);
    if (user) {
      return user;
    }
    throw new Error(`Couldn't find user with id: ${id}`);
  },
  findOrCreate: (githubProfile, callback) => {
    const user = Database.find((user) => user.id === `${githubProfile.username}#${githubProfile.id}`);
    // console.log("User, pre-processing: ", user)
    // console.log("githubProfile, pre-processing: ", githubProfile)
    if (user) {
      callback(null, user);
    } else {
      const githubUser =
          {
            id: `${githubProfile.username}#${githubProfile.id}`,
            name: githubProfile.username,
            email: githubProfile._json.email,
            password: null,
            role: 'user',
            reminders: []
          };
      Database.push(githubUser);
      // console.log("Database: ",database)
      callback(null, githubUser);
    }
  }
};

module.exports = { Database, userModel };
