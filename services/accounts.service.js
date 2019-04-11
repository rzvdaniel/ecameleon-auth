"use strict";

const crypto 		= require("crypto");
const bcrypt 		= require("bcrypt");
const _ 			= require("lodash");
const jwt 			= require("jsonwebtoken");
const speakeasy		= require("speakeasy");

const DbService 	= require("../mixins/db.mixin");
const CacheCleaner 	= require("../mixins/cache.cleaner.mixin");
const ConfigLoader 	= require("../mixins/config.mixin");
const C 			= require("../constants");
let path 			= require("path");
const fs 			= require("fs");

const { MoleculerRetryableError, MoleculerClientError } = require("moleculer").Errors;

module.exports = {
	name: "accounts",
	version: 1,

	mixins: [
		DbService("accounts"),
		CacheCleaner([
			"cache.clean.accounts"
		]),
		ConfigLoader([
			"site.**",
			"mail.**",
			"accounts.**"
		])
	],

	/**
	 * Service settings
	 */
	settings: {
		rest: true,

		actions: {
			sendMail: "mail.send"
		},

		fields: {
			id: { type: "string", readonly: true, primaryKey: true, secure: true, columnName: "_id" },
			username: { type: "string", maxlength: 50, required: true },
			firstName: { type: "string", maxlength: 50, required: true },
			lastName: { type: "string", maxlength: 50, required: true },
			email: { type: "string", maxlength: 100, required: true },
			password: { type: "string", minlength: 6, maxlength: 60, hidden: true },
			avatar: { type: "string" },
			roles: { required: true },
			socialLinks: { type: "object" },
			status: { type: "number", default: 1 },
			plan: { type: "string", required: true },
			verified: { type: "boolean", default: false },
			token: { type: "string", readonly: true },
			"totp.enabled": { type: "boolean", default: false },
			passwordless: { type: "boolean", default: false },
			passwordlessTokenExpires: { hidden: true },
			resetTokenExpires: { hidden: true },
			verificationToken: { hidden: true },
			createdAt: { type: "number", updateable: false, default: Date.now },
			updatedAt: { type: "number", readonly: true, updateDefault: Date.now },
			lastLoginAt: { type: "number" },
		},
	},

	/**
	 * Service dependencies
	 */
	dependencies: [],

	/**
	 * Actions
	 */
	actions: {
		/**
		 * Register a new user account
		 *
		 */
		register: {
			params: {
				username: { type: "string", min: 3, optional: true },
				password: { type: "string", min: 8, optional: true },
				email: { type: "email" },
				firstName: { type: "string", min: 2 },
				lastName: { type: "string", min: 2 },
				avatar: { type: "string", optional: true },
			},
			rest: true,
			async handler(ctx) {
				if (!this.config["accounts.signup.enabled"])
					throw new MoleculerClientError("Sign up is not available.", 400, "ERR_SIGNUP_DISABLED");

				const params = Object.assign({}, ctx.params);
				const entity = {};

				// Verify email
				let found = await this.getUserByEmail(ctx, params.email);
				if (found)
					throw new MoleculerClientError("Email has already been registered.", 400, "ERR_EMAIL_EXISTS");

				// Verify username
				if (this.config["accounts.username.enabled"]) {
					if (!ctx.params.username) {
						throw new MoleculerClientError("Username can't be empty.", 400, "ERR_USERNAME_EMPTY");
					}

					let found = await this.getUserByUsername(ctx, params.username);
					if (found)
						throw new MoleculerClientError("Username has already been registered.", 400, "ERR_USERNAME_EXISTS");

					entity.username = params.username;
				}

				// Set basic data
				entity.email = params.email;
				entity.firstName = params.firstName;
				entity.lastName = params.lastName;
				entity.roles = this.config["accounts.defaultRoles"];
				entity.plan = this.config["accounts.defaultPlan"];
				entity.avatar = params.avatar;
				entity.socialLinks = {};
				entity.createdAt = Date.now();
				entity.verified = true;
				entity.status = 1;

				if (!entity.avatar) {
					// Default avatar as Gravatar
					const md5 = crypto.createHash("md5").update(entity.email).digest("hex");
					entity.avatar = `https://gravatar.com/avatar/${md5}?s=64&d=robohash`;
				}

				// Generate passwordless token or hash password
				if (params.password) {
					entity.passwordless = false;
					entity.password = await bcrypt.hash(params.password, 10);
				} else if (this.config["accounts.passwordless.enabled"]) {
					entity.passwordless = true;
					entity.password = this.generateToken();
				} else {
					throw new MoleculerClientError("Password can't be empty.", 400, "ERR_PASSWORD_EMPTY");
				}

				// Generate verification token
				if (this.config["accounts.verification.enabled"]) {
					entity.verified = false;
					entity.verificationToken = this.generateToken();
				}

				// Create new user
				const user = await this.adapter.insert(entity);

				// Send email
				if (user.verified) {
					// Send welcome email
					this.sendMail(ctx, user, "welcome");
					user.token = await this.getToken(user);
				} else {
					// Send verification email
					this.sendMail(ctx, user, "activate", { token: entity.verificationToken });
				}

				return this.transformDocuments(ctx, {}, user);
			}
		}
	},

	/**
	 * Events
	 */
	events: {

	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Generate a token
		 *
		 * @param {Number} len Token length
		 */
		generateToken(len = 25) {
			return crypto.randomBytes(len).toString("hex");
		},

		/**
		 * Get user by email
		 *
		 * @param {Context} ctx
		 * @param {String} email
		 */
		async getUserByEmail(ctx, email) {
			return await this.adapter.findOne({ email });
		},

		/**
		 * Get user by username
		 *
		 * @param {Context} ctx
		 * @param {String} username
		 */
		async getUserByUsername(ctx, username) {
			return await this.adapter.findOne({ username });
		},

		/**
		 * Send email to the user email address
		 *
		 * @param {Context} ctx
		 * @param {Object} user
		 * @param {String} template
		 * @param {Object?} data
		 */
		async sendMail(ctx, user, template, data) {
			if (!this.config["mail.enabled"])
				return this.Promise.resolve(false);

			var site = this.configObj.site;

			try {
				return await ctx.call(this.settings.actions.sendMail, {
					to: user.email,
					template: template,
					data: _.defaultsDeep(data, {
						user,
						site: this.config["site.url"],
						siteName: this.config["site.name"]
					})
				}, { retries: 3, timeout: 10000 });

			} catch(err) {
				/* istanbul ignore next */
				this.logger.error("Send mail error!", err);
				/* istanbul ignore next */
				throw err;
			}
		},

	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {

	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {

	}
};