import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { initSocketIO } from "./services/notification.service";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import postRoutes from "./routes/post.routes";
import commentRoutes from "./routes/comment.routes";
import notificationRoutes from "./routes/notification.routes";
import adminRoutes from "./routes/admin.routes";
import { authenticateJWT } from "./middleware/auth.middleware";
import { createReport } from "./controllers/admin.controller";

dotenv.config();
const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());
initSocketIO(httpServer);

app.get("/health", (_req, res) => {
  res.json({ success: true, status: "OK", modules: ["users", "posts", "comments", "notifications", "admin"] });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/posts", postRoutes);
app.use("/comments", commentRoutes);
app.use("/notifications", notificationRoutes);
app.post("/reports", authenticateJWT, createReport);
app.use("/admin", adminRoutes);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
