import { Router } from 'express';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware';
import {
  getAdminReports,
  reviewReport,
  moderatePostVisibility,
  deletePostAsAdmin,
} from '../controllers/admin.controller';

const router = Router();
router.use(authenticateJWT, requireAdmin);

router.get('/reports', getAdminReports);
router.patch('/reports/:id', reviewReport);
router.patch('/posts/:id', moderatePostVisibility);
router.delete('/posts/:id', deletePostAsAdmin);

export default router;
