
# config.mixin.js

/**
* Example of service calls
*/
async started() {

    const result = await this.broker.call("v1.config.hello");
    const result2 = await this.broker.call("v1.config.welcome", {name: "Razvan"});
    const result3 = await this.broker.call("v1.config.test", {keys: [1, 2, 3]});
}

# config.service.js

/**
* Actions
*/
actions: {

    hello() {
        return "Hello Moleculer";
    },

    /**
        * Welcome a username
        *
        * @param {String} name - User name
        */
    welcome: {
        params: {
            name: "string"
        },
        handler(ctx) {
            return `Welcome, ${ctx.params.name}`;
        }
    },

    test: {
        params: {
            keys: "array",
            //keys: { type: "array", items: "integer", optional: false }
        },
        
        handler(ctx) {
            this.logger.info(ctx.params.keys);
        }
    },
}