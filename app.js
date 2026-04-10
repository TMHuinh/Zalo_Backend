const express = require("express");
const app = express();
const cors = require("cors");

// ✅ parse JSON trước
app.use(express.json());

// ✅ CORS
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

// ✅ routes
app.use("/api", require("./routes"));

// ✅ error middleware
app.use(require("./middlewares/error.middleware"));

module.exports = app;
