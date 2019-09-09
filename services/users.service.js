const SecureAutoalias 	= require("../mixins/secureautoalias.mixin");
const DbService 		= require("../mixins/db.mixin");
const CacheCleaner 		= require("../mixins/cache.cleaner.mixin");
const C = require("../constants");

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

	actions: {

		list: {
			// Expose as "v1/users/"
			visibility: C.VISIBILITY_PUBLISHED,
      rest: "GET /",
      async handler(ctx) {
        return await this.adapter.find();
      }
    }
	}
};