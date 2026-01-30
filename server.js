const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();
connectDB();

const app = express();

/**
 * ======================
 *  CORS CONFIG
 * ======================
 */
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * ======================
 *  MIDDLEWARE
 * ======================
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/**
 * ======================
 *  ROUTES
 * ======================
 */
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

/**
 * ======================
 *  ERROR HANDLING
 * ======================
 */
app.use(notFound);
app.use(errorHandler);

/**
 * ======================
 *  SERVER
 * ======================
 */
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});

/**
 * ======================
 *  SOCKET.IO
 * ======================
 */
const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🔌 Socket connected");

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.userId = userData._id;
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("👥 User joined room:", room);
  });

  socket.on("typing", (room) => {
    socket.in(room).emit("typing");
  });

  socket.on("stop typing", (room) => {
    socket.in(room).emit("stop typing");
  });

  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;

    if (!chat.users) return;

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;
      socket.in(user._id).emit("message received", newMessageReceived);
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected");
    if (socket.userId) socket.leave(socket.userId);
  });
});
