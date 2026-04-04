const express = require("express");
const app = express();

app.use(express.json());

app.use("/api", require("./routes"));

app.use(require("./middlewares/error.middleware"));

module.exports = app;