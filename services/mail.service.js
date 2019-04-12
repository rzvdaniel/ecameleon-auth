"use strict";

const MailService = require("moleculer-mail");
const ConfigLoader = require("../mixins/config.mixin");
let path = require("path");

module.exports = {
	name: "mail",

	mixins: [
		MailService,
		ConfigLoader([
			"site.**",
			"mail.**",
		])
	],

	/**
	 * Service dependencies
	 */
	dependencies: [
		{ name: "config", version: 1 }
	],

	/**
	 * Service settings
	 */
	settings: {
		from: process.env.MAIL_NOREPLY,
		transport: {
			host: "smtp.mailtrap.io",
			port: 2525,
            auth: {
                user: process.env.MAILTRAP_USER,
                pass: process.env.MAILTRAP_PASS
            }
		},
		templateFolder: path.join(__dirname, "../templates/mail")
	},
};
