import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiResponse, PaginatedResponse } from '../types/api.types';
import { createAndEmitNotification } from '../services/notification.service';
import { NotificationType } from '@prisma/client';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';
    const where = { recipientId: userId, ...(unreadOnly ? { isRead: false } : {}) };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { actor: { select: { id: true, username: true } }, post: { select: { id: true, caption: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
    ]);

    const response: ApiResponse<PaginatedResponse<typeof items[number]>> = {
      success: true,
      data: { items, total, limit, offset, hasMore: offset + items.length < total },
    };
    res.json(response);
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.notification.findFirst({ where: { id: req.params.id as string, recipientId: req.user!.id } });
    if (!existing) { res.status(404).json({ success: false, message: 'Notification not found' }); return; }
    const updated = await prisma.notification.update({ where: { id: existing.id }, data: { isRead: true } });
    res.json({ success: true, data: updated });
  } catch { res.status(500).json({ success: false, message: 'Failed to update notification' }); }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await prisma.notification.updateMany({ where: { recipientId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true, data: { updatedCount: result.count } });
  } catch { res.status(500).json({ success: false, message: 'Failed to mark all as read' }); }
};

export const triggerTestNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, recipientId, postId, commentId, message } = req.body;
    const notification = await createAndEmitNotification({
      type: (type as NotificationType) || 'LIKE', recipientId, actorId: req.user!.id, postId, commentId, message,
    });
    res.status(201).json({ success: true, data: notification });
  } catch (err: any) { res.status(400).json({ success: false, message: err.message || 'Could not trigger notification' }); }
};
