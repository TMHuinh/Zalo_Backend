require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/database");
const { handleSocket } = require("./sockets");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT;

handleSocket(io);

app.set("io", io);

server.listen(PORT, "0.0.0.0", async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
});
