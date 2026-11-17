import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  triggerTestNotification,
} from '../controllers/notification.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/', getNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.post('/test-trigger', triggerTestNotification);

export default router;
