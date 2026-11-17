import { Router, Response } from "express";
import prisma from "../utils/prisma";
import { authenticateJWT, AuthRequest } from "../middleware/auth.middleware";
import { notifyLike, notifyComment } from "../services/notification.service";

const router = Router();

function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[a-zA-Z0-9_]+/g) || [];
  return Array.from(new Set(matches.map((tag) => tag.toLowerCase())));
}

// POST /posts - Create a post
router.post("/", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { caption = "", mediaURL = "" } = req.body || {};
    if (!caption && !mediaURL) {
      return res.status(400).json({ success: false, error: "caption or mediaURL is required" });
    }

    const post = await prisma.post.create({
      data: {
        caption: String(caption),
        mediaURL: String(mediaURL),
        userId: req.user!.id,
      },
      include: {
        User: { select: { id: true, username: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: { ...post, hashtags: extractHashtags(post.caption) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to create post" });
  }
});

// GET /posts - Read paginated feed
router.get("/", async (req, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const tag = req.query.tag ? String(req.query.tag).replace(/^#/, "") : undefined;
    const userId = req.query.userId ? String(req.query.userId) : undefined;

    const where: any = {};
    if (userId) where.userId = userId;
    if (tag) where.caption = { contains: "#" + tag, mode: "insensitive" };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          User: { select: { id: true, username: true } },
          _count: { select: { Like: true, comments: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        posts: posts.map((p) => ({
          ...p,
          hashtags: extractHashtags(p.caption),
          likeCount: p._count.Like,
          commentCount: p._count.comments,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch posts" });
  }
});

// GET /posts/:id - Read single post
router.get("/:id", async (req, res: Response) => {
  try {
    const postId = String(req.params.id);
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        User: { select: { id: true, username: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, username: true } } },
        },
        _count: { select: { Like: true, comments: true } },
      },
    });
    if (!post) return res.status(404).json({ success: false, error: "Post not found" });

    res.json({
      success: true,
      data: {
        ...post,
        hashtags: extractHashtags(post.caption),
        likeCount: post._count.Like,
        commentCount: post._count.comments,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch post" });
  }
});

// PATCH /posts/:id - Update own post
router.patch("/:id", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const postId = String(req.params.id);
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, error: "Post not found" });
    if (post.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ success: false, error: "You can only edit your own posts" });
    }

    const { caption, mediaURL } = req.body || {};
    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(caption !== undefined ? { caption: String(caption) } : {}),
        ...(mediaURL !== undefined ? { mediaURL: String(mediaURL) } : {}),
      },
    });
    res.json({
      success: true,
      data: { ...updated, hashtags: extractHashtags(updated.caption) },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to update post" });
  }
});

// DELETE /posts/:id - Delete own post
router.delete("/:id", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const postId = String(req.params.id);
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, error: "Post not found" });
    if (post.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ success: false, error: "You can only delete your own posts" });
    }

    await prisma.post.delete({ where: { id: postId } });
    res.json({ success: true, message: "Post deleted" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to delete post" });
  }
});

// POST /posts/:id/like - Like a post
router.post("/:id/like", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const postId = String(req.params.id);
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, error: "Post not found" });

    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: "Post already liked" });
    }

    const like = await prisma.like.create({ data: { userId, postId } });
    if (post.userId) {
      await notifyLike(userId, post.userId, postId);
    }
    res.status(201).json({ success: true, data: like });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to like post" });
  }
});

// DELETE /posts/:id/like - Unlike a post
router.delete("/:id/like", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const postId = String(req.params.id);
    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Like not found" });
    }

    await prisma.like.delete({
      where: { userId_postId: { userId, postId } },
    });
    res.json({ success: true, message: "Post unliked" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to unlike post" });
  }
});

// POST /posts/:id/comments - Add comment
router.post("/:id/comments", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const postId = String(req.params.id);
    const content = req.body?.content?.trim();
    if (!content) {
      return res.status(400).json({ success: false, error: "Comment content is required" });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, error: "Post not found" });

    const comment = await prisma.comment.create({
      data: {
        content,
        postId: post.id,
        authorId: req.user!.id,
      },
      include: {
        author: { select: { id: true, username: true } },
      },
    });

    if (post.userId) {
      await notifyComment(req.user!.id, post.userId, post.id, comment.id);
    }
    res.status(201).json({ success: true, data: comment });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to add comment" });
  }
});

// GET /posts/:id/comments - List comments on a post
router.get("/:id/comments", async (req, res: Response) => {
  try {
    const postId = String(req.params.id);
    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, username: true } } },
    });
    res.json({ success: true, data: comments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch comments" });
  }
});

export default router;
