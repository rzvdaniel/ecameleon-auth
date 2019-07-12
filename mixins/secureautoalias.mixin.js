const C = require("../constants");

module.exports = {
	name: "secureautoalias",
	version: 1,

	actions: {
		// Change visibility of default actions
		create: {
			visibility: C.VISIBILITY_PROTECTED
		},
		list: {
			visibility: C.VISIBILITY_PROTECTED,
		},
		find: {
			visibility: C.VISIBILITY_PROTECTED
		},
		get: {
			visibility: C.VISIBILITY_PROTECTED
		},
		update: {
			visibility: C.VISIBILITY_PROTECTED
		},
		remove: {
			visibility: C.VISIBILITY_PROTECTED
		}
	}
};