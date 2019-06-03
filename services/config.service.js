"use strict";

const _ 					= require("lodash");
const DbService 			= require("../mixins/db.mixin");
const CacheCleaner 			= require("../mixins/cache.cleaner.mixin");
const { ValidationError } 	= require("moleculer").Errors;
const { match } 			= require("moleculer").Utils;

/**
 * config service
 */
module.exports = {
	name: "config",
	version: 1,

	mixins: [
		DbService("configurations"),
		CacheCleaner([
			"cache.clean.config"
		])
	],

	/**
	 * Service settings
	 */
	settings: {
		defaultConfig: {
			"site.name": process.env.SITE_NAME,
			"site.url": process.env.NOW_URL || "http://localhost:4000",

			"mail.enabled": process.env.MAIL_ENABLED,
			"mail.from": process.env.MAIL_NOREPLY,

			"accounts.signup.enabled": process.env.ACCOUNTS_SIGNUP_ENABLED,
			"accounts.username.enabled": process.env.ACCOUNTS_USERNAME_ENABLED,
			"accounts.passwordless.enabled": process.env.ACCOUNTS_PASSWORDLESS_ENABLED,
			"accounts.verification.enabled": process.env.ACCOUNTS_VERIFICATION_ENABLED,
			"accounts.defaultRoles": [process.env.ACCOUNTS_DEFAULT_ROLE],
			"accounts.defaultPlan": process.env.ACCOUNTS_DEFAULT_PLAN,
			"accounts.jwt.expiresIn": process.env.ACCOUNTS_JWT_EXPIRESIN,
			"accounts.two-factor.enabled": process.env.ACCOUNTS_TWOFACTOR_ENABLED
		},

		// Fields in responses
		fields: {
			key: true,
			value: true,
			isDefault: true,
			createdAt: true,
			updatedAt: true
		},

		// Indexes on collection
		indexes: [
			{ key: 1 }
		]
	},

	/**
	 * Actions
	 */
	actions: {
		
		/**
		 * Get configurations by key or keys
		 *
		 * @actions
		 * @param {String|Array<String>} key
		 * @returns {Object|Array<String>}
		 */
		loadKeys: {
			params: {
				key: "array",
			},
			async handler(ctx) {
				if (ctx.params.key == null)
					throw new ValidationError("Param 'key' must be defined.", "ERR_KEY_NOT_DEFINED");

				return await this.transformDocuments(ctx, {}, await this.get(ctx.params.key));
			}
		},

		/**
		 * Set configuration values by key
		 *
		 * @actions
		 * @param {String} key
		 * @param {any} value
		 * @returns {Object|Array<Object>}
		 */
		setKey: {
			params: {
				key: { type: "string" },
				value: { type: "any" }
			},			
			async handler(ctx) {			
				const { changed, item } = await this.set(ctx.params.key, ctx.params.value);
				const res = await this.transformDocuments(ctx, {}, item);
				if (changed)
					this.broker.broadcast(`${this.name}.${item.key}.changed`, res);

				return res;
			}
		},

		/**
		 * Set configuration values by keys
		 *
		 * @actions
		 * @param {Object|Array<Object>} items
		 * @returns {Object|Array<Object>}
		 */
		setKeys: {
			params: {
				type: "array", items: {
					type: "object", props: {
						key: "string",
						value: "any"
					}
				}
			},
			async handler(ctx) {
				return this.Promise.all(ctx.params.map(async p => {
					const { changed, item } = await this.set(p.key, p.value);
					const res = await this.transformDocuments(ctx, {}, item);
					if (changed)
						this.broker.broadcast(`${this.name}.${item.key}.changed`, res);

					return res;
				}));
			}
		},

		all: {
			cache: true,
			handler() {
				return this.adapter.find({});
			}
		}
	},

	/**
	 * Methods
	 */
	methods: {

		/**
		 * Get configurations by key.
		 *
		 * @methods
		 * @param {String|Array<String>} key Config key
		 * @returns {Object|Array<Object>}
		 */
		async get(key) {
			if (Array.isArray(key)) {
				const res = await this.Promise.all(key.map(k => this.getByMask(k)));
				return _.uniqBy(_.flattenDeep(res), item => item.key);
			} else {
				if (key.indexOf("*") == -1 && key.indexOf("?") == -1)
					return await this.adapter.findOne({ key });

				return await this.getByMask(key);
			}
		},

		/**
		 * Get configurations by key mask.
		 *
		 * @methods
		 * @param {String} mask Key mask
		 * @returns {Array<Object>}
		 */
		async getByMask(mask) {
			const allItems = await this.broker.call(`${this.fullName}.all`);

			/* istanbul ignore next */
			if (!allItems)
				return [];

			return allItems.filter(item => match(item.key, mask));
		},

		/**
		 * Check whether a configuration key exists.
		 *
		 * @methods
		 * @param {String} key
		 * @returns {Boolean}
		 */
		async has(key) {
			const res = await this.adapter.findOne({ key });
			return res != null;
		},

		/**
		 * Set a configuration value.
		 *
		 * @methods
		 * @param {String} key Key
		 * @param {any} value Value
		 * @param {Boolean} isDefault
		 *
		 * @returns {Object}
		 */
		async set(key, value, isDefault = false) {
			const item = await this.adapter.findOne({ key });
			if (item != null) {
				if (!_.isEqual(item.value, value)) {
					// Modify
					return {
						item: await this.adapter.updateById(item._id, { $set: { value, isDefault, updatedAt: Date.now() } }),
						changed: true,
					};
				}

				// No changes
				return {
					item,
					changed: false,
				};
			}

			// Create new
			return {
				item: await this.adapter.insert({ key, value, isDefault, createdAt: Date.now() }),
				changed: true,
				new: true
			};
		},

		/**
		 * Run configuration migration. Add missing keys.
		 *
		 * @methods
		 * @private
		 */
		migrateConfig() {
			return this.Promise.all(Object.keys(this.settings.defaultConfig).map(async key => {
				const value = this.settings.defaultConfig[key];
				const item = await this.get(key);
				if (!item) {
					this.logger.info(`Save new config: "${key}" =`, value);
					return this.set(key, value, true);
				} else if (item.isDefault && !_.isEqual(item.value, value)) {
					this.logger.info(`Update default config: "${key}" =`, value);
					return this.set(key, value, true);
				}
			}));
		}
	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		return this.migrateConfig();
	},

};
