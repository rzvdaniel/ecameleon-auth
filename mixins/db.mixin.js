"use strict";

const _ 			= require("lodash");
const path 			= require("path");
const mkdir			= require("mkdirp").sync;
const DbService		= require("moleculer-db");
const MongoAdapter 	= require("moleculer-db-adapter-mongo");

module.exports = function(collection, opts = {}) {
	let adapter;

	switch (process.env.DB_ADAPTER) {
		case 'memory':
			adapter = new DbService.MemoryAdapter();
			break;

		case 'nedb':
			const dir = path.resolve(process.env.NEDB_FOLDER);
			mkdir(dir);
			adapter = new DbService.MemoryAdapter({ filename: path.join(dir, `${collection}.db`) });
			break;
			
		case 'mongo':
			adapter = new MongoAdapter(process.env.MONGO_URI || process.env.MONGO_URI_DEFAULT, { useNewUrlParser: true });
			// Mongo has an internal reconnect logic
			opts.autoReconnect = false;
			break;
	}

	const schema = {
		mixins: [DbService],
		collection: collection,
		adapter: adapter,

		methods: {
			entityChanged(type, json, ctx) {
				return this.clearCache().then(() => {
					const eventName = `${this.name}.entity.${type}`;
					this.broker.broadcast(eventName, { meta: ctx.meta, entity: json });
				});
			},
		},

		async afterConnected() {
			const dbAdapterConfig = process.env.DB_ADAPTER;
			const testing = dbAdapterConfig === 'memory';
		
			this.logger.info("Connected to database.");
			
			/* istanbul ignore next */
			if (!testing) {
				// Create indexes
				if (this.settings.indexes) {
					try {
						if (_.isFunction(this.adapter.collection.createIndex))
							await this.Promise.all(this.settings.indexes.map(idx => this.adapter.collection.createIndex(idx)));
					} catch(err) {
						this.logger.error("Unable to create indexes.", err);
					}
				}
			}

			if (process.env.TEST_E2E) {
				// Clean collection
				this.logger.info(`Clear '${collection}' collection before tests...`);
				await this.adapter.clear();
			}

			// Seeding if the DB is empty
			const count = await this.adapter.count();
			if (count == 0 && _.isFunction(this.seedDB)) {
				this.logger.info(`Seed '${collection}' collection...`);
				await this.seedDB();
			}
		}
	};

	return schema;
};
