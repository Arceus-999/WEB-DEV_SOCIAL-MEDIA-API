import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { ApiResponse, PaginatedResponse } from '../types/api.types';
import { ReportStatus } from '@prisma/client';

export const createReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { postId, reason, details } = req.body;
    if (!postId || !reason) { res.status(400).json({ success: false, message: 'postId and reason are required' }); return; }
    const report = await prisma.report.create({ data: { reporterId: req.user!.id, postId, reason, details } });
    res.status(201).json({ success: true, data: report });
  } catch (err: any) {
    console.error('REPORT ERROR:', err); if (err.code === 'P2002') { res.status(409).json({ success: false, message: 'Already reported' }); return; }
    res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
};

export const getAdminReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const status = req.query.status as ReportStatus | undefined;
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, username: true, email: true } },
          post: { select: { id: true, caption: true, isHidden: true, author: { select: { id: true, username: true } } } },
          reviewedBy: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.report.count({ where }),
    ]);
    const response: ApiResponse<PaginatedResponse<typeof items[number]>> = {
      success: true, data: { items, total, limit, offset, hasMore: offset + items.length < total },
    };
    res.json(response);
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch reports' }); }
};

export const reviewReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, adminNotes } = req.body;
    if (!['RESOLVED', 'DISMISSED'].includes(status)) {
      res.status(400).json({ success: false, message: 'Status must be RESOLVED or DISMISSED' }); return;
    }
    const updated = await prisma.report.update({
      where: { id: req.params.id as string },
      data: { status: status as ReportStatus, adminNotes, reviewedById: req.user!.id },
    });
    res.json({ success: true, data: updated });
  } catch { res.status(404).json({ success: false, message: 'Report not found' }); }
};

export const moderatePostVisibility = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const [post] = await prisma.$transaction([
      prisma.post.update({ where: { id }, data: { isHidden: Boolean(req.body.isHidden) } }),
      prisma.report.updateMany({
        where: { postId: id, status: 'PENDING' },
        data: { status: 'RESOLVED', adminNotes: req.body.adminNotes ?? 'Moderated by admin', reviewedById: req.user!.id },
      }),
    ]);
    res.json({ success: true, message: 'Post moderation updated', data: post });
  } catch { res.status(404).json({ success: false, message: 'Post not found' }); }
};

export const deletePostAsAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.post.delete({ where: { id } });
    res.json({ success: true, message: 'Post deleted', data: { id } });
  } catch { res.status(404).json({ success: false, message: 'Post not found' }); }
};
