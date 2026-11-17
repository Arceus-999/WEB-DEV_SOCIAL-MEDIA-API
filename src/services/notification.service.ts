import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { NotificationType } from '@prisma/client';
import prisma from '../utils/prisma';

let io: Server | null = null;

export const initSocketIO = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication error: Token missing'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; role: string };
      socket.data.userId = payload.id;
      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`Socket connected: user:${userId}`);
    }
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: user:${userId}`);
    });
  });

  return io;
};

export interface TriggerNotificationInput {
  type: NotificationType;
  recipientId: string;
  actorId: string;
  postId?: string;
  commentId?: string;
  message?: string;
}

export const createAndEmitNotification = async (input: TriggerNotificationInput) => {
  if (!input.recipientId) throw new Error('recipientId is required');
  if (input.recipientId === input.actorId) return null;

  const notification = await prisma.notification.create({
    data: {
      type: input.type,
      recipientId: input.recipientId,
      actorId: input.actorId,
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
      message: input.message ?? 'New notification',
    },
    include: {
      actor: { select: { id: true, username: true } },
      post: { select: { id: true, caption: true, mediaURL: true } },
    },
  });

  if (io) {
    io.to(`user:${input.recipientId}`).emit('notification:new', notification);
  }

  return notification;
};

export const notifyLike = async (actorId: string, recipientId: string, postId: string) => {
  if (actorId === recipientId) return null;
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  return createAndEmitNotification({
    type: 'LIKE',
    recipientId,
    actorId,
    postId,
    message: `${actor?.username ?? 'Someone'} liked your post`,
  });
};

export const notifyComment = async (actorId: string, recipientId: string, postId: string, commentId: string) => {
  if (actorId === recipientId) return null;
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  return createAndEmitNotification({
    type: 'COMMENT',
    recipientId,
    actorId,
    postId,
    commentId,
    message: `${actor?.username ?? 'Someone'} commented on your post`,
  });
};

export const notifyFollow = async (actorId: string, recipientId: string) => {
  if (actorId === recipientId) return null;
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  return createAndEmitNotification({
    type: 'FOLLOW',
    recipientId,
    actorId,
    message: `${actor?.username ?? 'Someone'} started following you`,
  });
};
