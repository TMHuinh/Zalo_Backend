const { dynamo } = require("../config/aws");

exports.put = (params) => dynamo.put(params).promise();
exports.get = (params) => dynamo.get(params).promise();
exports.scan = (params) => dynamo.scan(params).promise();
exports.delete = (params) => dynamo.delete(params).promise();