import { Router, Response } from "express";
import prisma from "../utils/prisma";
import { authenticateJWT, AuthRequest } from "../middleware/auth.middleware";
import { createAndEmitNotification } from "../services/notification.service";

const router = Router();

// GET /users - List all users for discovery & follow dropdowns
router.get("/", async (_req, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        bio: true,
        _count: {
          select: {
            Follow_Follow_followingIdToUser: true,
            Follow_Follow_followerIdToUser: true,
          },
        },
      },
    });
    res.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        bio: u.bio,
        followers: u._count.Follow_Follow_followingIdToUser,
        following: u._count.Follow_Follow_followerIdToUser,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch users" });
  }
});

// GET /users/:id - View profile with counts and posts
router.get("/:id", async (req, res: Response) => {
  try {
    const targetId = String(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        username: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            Post: true,
            Follow_Follow_followingIdToUser: true,
            Follow_Follow_followerIdToUser: true,
          },
        },
        Post: {
          orderBy: { createdAt: "desc" },
          select: { id: true, caption: true, mediaURL: true, createdAt: true },
        },
      },
    });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        bio: user.bio,
        role: user.role,
        createdAt: user.createdAt,
        counts: {
          posts: user._count.Post,
          followers: user._count.Follow_Follow_followingIdToUser,
          following: user._count.Follow_Follow_followerIdToUser,
        },
        posts: user.Post,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch profile" });
  }
});

// PATCH /users/:id - Edit own profile (username / bio)
router.patch("/:id", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id);
    if (req.user!.id !== targetId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ success: false, error: "You can only edit your own profile" });
    }
    const { username, bio } = req.body || {};
    const data: { username?: string; bio?: string | null } = {};
    if (username !== undefined) data.username = String(username).trim();
    if (bio !== undefined) data.bio = bio === null ? null : String(bio);

    const updated = await prisma.user.update({
      where: { id: targetId },
      data,
      select: { id: true, username: true, email: true, bio: true, role: true, createdAt: true },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ success: false, error: "Username already taken" });
    }
    res.status(500).json({ success: false, error: err.message || "Failed to update profile" });
  }
});

// POST /users/:id/follow - Send an Instagram-style Follow Request
router.post("/:id/follow", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.id;
    const followingId = String(req.params.id);
    if (followerId === followingId) {
      return res.status(400).json({ success: false, error: "You cannot follow yourself" });
    }

    const [actor, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: followerId }, select: { username: true } }),
      prisma.user.findUnique({ where: { id: followingId }, select: { id: true } }),
    ]);
    if (!target) return res.status(404).json({ success: false, error: "Target user not found" });

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: "Already following this user" });
    }

    const pendingReq = await prisma.notification.findFirst({
      where: {
        type: "FOLLOW",
        actorId: followerId,
        recipientId: followingId,
        message: { contains: "requested to follow you" },
      },
    });
    if (pendingReq) {
      return res.status(200).json({ success: true, status: "REQUESTED", message: "Follow request already sent" });
    }

    await createAndEmitNotification({
      type: "FOLLOW",
      actorId: followerId,
      recipientId: followingId,
      message: `${actor?.username || "Someone"} requested to follow you`,
    });

    res.status(201).json({ success: true, status: "REQUESTED", message: "Follow request sent!" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to send follow request" });
  }
});

// POST /users/:id/follow/accept - Accept an incoming follow request from :id
router.post("/:id/follow/accept", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const recipientId = req.user!.id;
    const followerId = String(req.params.id);

    const [recipient, follower] = await Promise.all([
      prisma.user.findUnique({ where: { id: recipientId }, select: { username: true } }),
      prisma.user.findUnique({ where: { id: followerId }, select: { id: true, username: true } }),
    ]);
    if (!follower) return res.status(404).json({ success: false, error: "Requester not found" });

    const follow = await prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId: recipientId } },
      update: {},
      create: { followerId, followingId: recipientId },
    });

    // Clear the pending request notification
    await prisma.notification.deleteMany({
      where: {
        type: "FOLLOW",
        actorId: followerId,
        recipientId,
        message: { contains: "requested to follow you" },
      },
    });

    // Notify requester that their follow request was accepted
    await createAndEmitNotification({
      type: "FOLLOW",
      actorId: recipientId,
      recipientId: followerId,
      message: `${recipient?.username || "User"} accepted your follow request`,
    });

    res.status(201).json({ success: true, message: `Accepted follow request from @${follower.username}`, data: follow });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to accept follow request" });
  }
});

// DELETE /users/:id/follow - Unfollow a user or cancel follow request
router.delete("/:id/follow", authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.id;
    const followingId = String(req.params.id);

    await prisma.notification.deleteMany({
      where: {
        type: "FOLLOW",
        actorId: followerId,
        recipientId: followingId,
        message: { contains: "requested to follow you" },
      },
    });

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
    }
    res.json({ success: true, message: "Unfollowed / cancelled request" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to unfollow user" });
  }
});

// GET /users/:id/followers - List followers
router.get("/:id/followers", async (req, res: Response) => {
  try {
    const targetId = String(req.params.id);
    const rows = await prisma.follow.findMany({
      where: { followingId: targetId },
      orderBy: { createdAt: "desc" },
      include: {
        User_Follow_followerIdToUser: { select: { id: true, username: true, bio: true } },
      },
    });
    res.json({
      success: true,
      data: rows.map((r) => ({ ...r.User_Follow_followerIdToUser, followedAt: r.createdAt })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch followers" });
  }
});

// GET /users/:id/following - List following
router.get("/:id/following", async (req, res: Response) => {
  try {
    const targetId = String(req.params.id);
    const rows = await prisma.follow.findMany({
      where: { followerId: targetId },
      orderBy: { createdAt: "desc" },
      include: {
        User_Follow_followingIdToUser: { select: { id: true, username: true, bio: true } },
      },
    });
    res.json({
      success: true,
      data: rows.map((r) => ({ ...r.User_Follow_followingIdToUser, followedAt: r.createdAt })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to fetch following" });
  }
});

export default router;
