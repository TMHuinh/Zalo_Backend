const express = require("express");
const app = express();
const cors = require("cors");
const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/user/user.routes");


// ✅ parse JSON trước
app.use(express.json());

// ✅ CORS
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

// ✅ routes
app.use("/api/auth", authRoutes);
app.use("/api", require("./routes"));
app.use("/api/users", userRoutes);

// ✅ error middleware
app.use(require("./middlewares/error.middleware"));

module.exports = app;