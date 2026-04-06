require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/database");
const cors = require("cors");

const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  connectDB();
  console.log(`Server running on port ${PORT}`);
  console.log("http://localhost:3000/api");
});
app.use(
  cors({
    origin: "http://localhost:5173", // frontend của bạn
    credentials: true, // QUAN TRỌNG (cookie refreshToken)
  })
);
