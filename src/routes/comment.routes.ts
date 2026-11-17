import { Router, Response } from "express";
import prisma from "../utils/prisma";
import { authenticateJWT, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// DELETE /comments/:id - Delete own comment (or post owner / admin)
router.delete("/:id", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const commentId = String(req.params.id);
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { post: { select: { userId: true } } },
    });
    if (!comment) return res.status(404).json({ success: false, error: "Comment not found" });

    const isCommentOwner = comment.authorId === req.user!.id;
    const isPostOwner = comment.post.userId === req.user!.id;
    const isAdmin = req.user!.role === "ADMIN";
    if (!isCommentOwner && !isPostOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: "Not authorized to delete this comment" });
    }

    await prisma.comment.delete({ where: { id: commentId } });
    res.json({ success: true, message: "Comment deleted" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to delete comment" });
  }
});

export default router;
