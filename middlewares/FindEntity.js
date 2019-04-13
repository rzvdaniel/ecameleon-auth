"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

module.exports = {

	/**
	 * Looks for an entity and adds it to the current context.
	 *
	 * @param {String} id
	 */

	// Wrap local action handlers
	localAction(handler, action) {

		// If this feature enabled
		if (action.needEntity) {
			return async function FindEntityMiddleware(ctx) {
				const svc = ctx.service;
				const entity = await svc.getById(ctx.params.id, true);
				if (!entity)
					throw new MoleculerClientError("Entity not found!", 400, "ERR_ENTITY_NOT_FOUND");

				ctx.entity = entity;

				// Call the handler
				return handler(ctx);

			}.bind(this);
		}

		// Return original handler, because feature is disabled
		return handler;
	}
};
