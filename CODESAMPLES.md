
# config.mixin.js

/**
* Example of service calls
*/
async started() {

    const result = await this.broker.call("v1.config.hello");
    const result2 = await this.broker.call("v1.config.welcome", {name: "Razvan"});
    const result3 = await this.broker.call("v1.config.test", {keys: [1, 2, 3]});
}