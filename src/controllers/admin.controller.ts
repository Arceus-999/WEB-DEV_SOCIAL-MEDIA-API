import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { ApiResponse, PaginatedResponse } from "../types/api.types";

export const createReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.body;
    if (!postId) { res.status(400).json({ success: false, message: "postId is required" }); return; }
    const existing = await prisma.report.findFirst({ where: { userId: req.user!.id, postId } });
    if (existing) { res.status(409).json({ success: false, message: "You already reported this post" }); return; }
    const report = await prisma.report.create({ data: { userId: req.user!.id, postId } });
    res.status(201).json({ success: true, data: report });
  } catch (err) {
    console.error("REPORT ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to submit report" });
  }
};

export const getAdminReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const [items, total] = await Promise.all([
      prisma.report.findMany({
        include: {
          User: { select: { id: true, username: true, email: true } },
          post: { select: { id: true, caption: true, mediaURL: true, User: { select: { id: true, username: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.report.count(),
    ]);
    const response: ApiResponse<PaginatedResponse<typeof items[number]>> = {
      success: true, data: { items, total, limit, offset, hasMore: offset + items.length < total },
    };
    res.json(response);
  } catch { res.status(500).json({ success: false, message: "Failed to fetch reports" }); }
};

export const reviewReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.report.delete({ where: { id } });
    res.json({ success: true, message: "Report reviewed and dismissed", data: { id } });
  } catch { res.status(404).json({ success: false, message: "Report not found" }); }
};

export const moderatePostVisibility = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const action = req.body.action || "DELETE";
    if (action === "DISMISS_REPORTS") {
      const result = await prisma.report.deleteMany({ where: { postId: id } });
      res.json({ success: true, message: "Reports cleared for post", data: { postId: id, clearedCount: result.count } });
      return;
    }
    await prisma.post.delete({ where: { id } });
    res.json({ success: true, message: "Violating post removed by admin", data: { id } });
  } catch { res.status(404).json({ success: false, message: "Post not found" }); }
};

export const deletePostAsAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.post.delete({ where: { id } });
    res.json({ success: true, message: "Post deleted by admin", data: { id } });
  } catch { res.status(404).json({ success: false, message: "Post not found" }); }
};