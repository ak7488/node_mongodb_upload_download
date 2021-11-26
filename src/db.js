const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URL).connect();

module.exports = { client };
