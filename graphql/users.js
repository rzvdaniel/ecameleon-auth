module.exports = {
  User : `
    type User {
      id: String!
      username: String!
      firstName: String!
      lastName: String!
      email: String
      avatar: String
      status: Int
    }
  `,

  CreateUser : `
    type CreateUser {
      username: String!
      firstName: String!
      lastName: String!
      email: String
      avatar: String
    }
  `
}
