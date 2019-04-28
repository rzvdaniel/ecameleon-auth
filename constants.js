"use strict";

module.exports = {

	/**
	 * Role-based ACL (Access-Control-List) constants
	 *
	 * Special roles:
	 * 		- $everyone (unauthenticated users)
	 * 		- $authenticated (authenticated user)
	 * 		- $owner (owner of entity)
	 * 		- $system (???)
	 *
	 * TODO:
	 * 	- Other role names can't start with $. It's an internal special role marker.
	 *  - Other role names can't contain colon (:). It's a permission separator
	 */
	ROLE_SYSTEM: "$system",
	ROLE_EVERYONE: "$everyone",
	ROLE_AUTHENTICATED: "$authenticated",
	ROLE_OWNER: "$owner",

	/**
	 * Service endpoints visibility
	 */
	VISIBILITY_PRIVATE: "private",
	VISIBILITY_PROTECTED: "protected",
	VISIBILITY_PUBLIC: "public",
	VISIBILITY_PUBLISHED: "published",
};
