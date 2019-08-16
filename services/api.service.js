"use strict";

const ApiGateway 		= require("moleculer-web");
const _ 				= require("lodash");
const helmet 			= require("helmet");

const C 				= require("../constants");
const PassportMixin 	= require("../mixins/passport.mixin");

const { UnAuthorizedError } = ApiGateway.Errors;

module.exports = {
	name: "api",
	version: 1,
	
	mixins: [
		ApiGateway,

		// Passport
		PassportMixin({
			routePath: "/auth",
			localAuthAlias: "v1.accounts.login",
			successRedirect: "/",
			providers: {
				google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
				facebook: process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET,
				github: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
				twitter: false
			}
		}),
	],

	// More info about settings: 
	// https://moleculer.services/docs/0.13/moleculer-web.html
	settings: {
		port: process.env.SITE_PORT,

		use: [
			helmet()
		],

		// Global CORS settings for all routes
		cors: {
				// Configures the Access-Control-Allow-Origin CORS header.
				origin: "*",
				// Configures the Access-Control-Allow-Methods CORS header. 
				methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE"],
				// Configures the Access-Control-Allow-Headers CORS header.
				allowedHeaders: [],
				// Configures the Access-Control-Expose-Headers CORS header.
				exposedHeaders: [],
				// Configures the Access-Control-Allow-Credentials CORS header.
				credentials: false,
				// Configures the Access-Control-Max-Age CORS header.
				maxAge: 3600
		},

		routes: [
			
			{
				// Path prefix to this route
				path: "/api",
				
				camelCaseNames: true,

				// Route CORS settings (overwrite global settings)
				cors: {
					origin: [process.env.CORS_WEBSITE1],
					methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE"]
				},

				bodyParsers: {
					json: { limit: "2MB" },
					urlencoded: { extended: true, limit: "2MB" }
				},

				onBeforeCall(ctx, route, req, res) {
					return new this.Promise(resolve => {
						this.logger.info("async onBeforeCall in public. Action:", ctx.action.name);
						ctx.meta.userAgent = req.headers["user-agent"];
						//ctx.meta.headers = req.headers;
						resolve();
					});
				},

				onAfterCall(ctx, route, req, res, data) {
					this.logger.info("async onAfterCall in public");
					return new this.Promise(resolve => {
						res.setHeader("X-Response-Type", typeof(data));
						resolve(data);
					});
				},
			}
		],

		// Serve assets from "public" folder
		assets: {
			folder: "public"
		},

		// Global error handler
		onError(req, res, err) {
			res.setHeader("Content-Type", "text/plain");
			res.writeHead(err.code || 500);
			res.end("Global error: " + err.message);
		},

		// Do not log client side errors (does not log an error respons when the error.code is 400<=X<500)
		log4XXResponses: false,
	},
		
	methods: {

		/**
		 * Authorize the request
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authorize(ctx, route, req) {
			let token;

			// Try get JWT token from Cookie
			if (req.headers.cookie) {
				const cookies = cookie.parse(req.headers.cookie);
				token = cookies["jwt-token"];
			}

			// Get JWT token from Authorization header
			if (!token) {
				if (req.headers.authorization) {
					let type = req.headers.authorization.split(" ")[0];
					if (type === "Token" || type === "Bearer")
						token = req.headers.authorization.split(" ")[1];
				}
			}

			ctx.meta.roles = [C.ROLE_EVERYONE];

			if (token) {

				// Verify JWT token
				const user = await ctx.call("v1.accounts.resolveToken", { token });
				
				if (user) {
					this.logger.info("User authenticated via JWT.", { username: user.username, email: user.email, id: user.id });

					ctx.meta.roles.push(C.ROLE_AUTHENTICATED);

					if (Array.isArray(user.roles))
						ctx.meta.roles.push(...user.roles);

					ctx.meta.token = token;
					ctx.meta.userID = user.id;

					// Reduce user fields (it will be transferred to other nodes)
					return _.pick(user, ["id", "email", "username", "firstName", "lastName", "avatar"]);
				}

				return Promise.reject(new UnAuthorizedError());
			}

			return Promise.reject(new UnAuthorizedError());
		},

		async signInSocialUser(params, cb) {
			try {
				cb(null, await this.broker.call("v1.accounts.socialLogin", params));
			} catch(err) {
				cb(err);
			}
		},
	},
};
