const SecureAutoalias = require("../mixins/secureautoalias.mixin");
const DbService = require("../mixins/db.mixin");
const CacheCleaner = require("../mixins/cache.cleaner.mixin");
const C = require("../constants");
const userType = require('../graphql/users.js');

module.exports = {
	name: "users",
	version: 1,
	mixins: [
		DbService("accounts"),
		CacheCleaner([
			"cache.clean.accounts"
		]),
		SecureAutoalias
	],
	settings: {
		graphql: {
			type: userType.User
		},
	},

	actions: {

		list: {
			// Expose as "v1/users/"
			visibility: C.VISIBILITY_PUBLISHED,
			rest: "GET /",
			graphql: {
				query: "users(limit: Int, offset: Int, sort: String): [User]",
			},
      async handler(ctx) {
        return await this.adapter.find(ctx.params);
      }
		},
		create: {
			// Expose as "v1/users/"
			//visibility: C.VISIBILITY_PUBLISHED,
			rest: "POST /",
			graphql: {
				mutation: "create(username: String, firstName: String, lastName: String, email: String): CreateUser",
				type: userType.CreateUser
			},
      async handler(ctx) {
				const params = ctx.params;
        const user = {
					username: params.username,
					email: params.email
				}
				return user;
      }
		},
	}
};