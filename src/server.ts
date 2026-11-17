import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initSocketIO } from './services/notification.service';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import { authenticateJWT } from './middleware/auth.middleware';
import { createReport } from './controllers/admin.controller';

dotenv.config();
const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());
initSocketIO(httpServer);

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'OK', module: 'Member 5' });
});

app.use('/notifications', notificationRoutes);
app.post('/reports', authenticateJWT, createReport);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
