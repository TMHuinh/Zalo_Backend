const express = require("express");
const app = express();
const cors = require("cors");

// ✅ parse JSON trước
app.use(express.json());

// ✅ CORS
app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);

// ✅ routes
app.use("/api", require("./routes"));
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
// ✅ error middleware
app.use(require("./middlewares/error.middleware"));

module.exports = app;
