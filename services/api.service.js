"use strict";

const ApiGateway = require("moleculer-web");
const helmet = require("helmet");

require('dotenv').config();

module.exports = {
	name: "api",
	mixins: [ApiGateway],

	// More info about settings: https://moleculer.services/docs/0.13/moleculer-web.html
	settings: {
		port: process.env.PORT || 3000,

		use: [
			helmet()
		],

		routes: [{
			path: "/api",
			whitelist: [
				// Access to any actions in all services under "/api" URL
				"**"
			],

			authentication: true,
			autoAliases: true,
			aliases: {},
			etag: true,

			camelCaseNames: true,

			bodyParsers: {
				json: { limit: "2MB" },
				urlencoded: { extended: true, limit: "2MB" }
			},
		}],

		// Serve assets from "public" folder
		assets: {
			folder: "public"
		}
	}
};
