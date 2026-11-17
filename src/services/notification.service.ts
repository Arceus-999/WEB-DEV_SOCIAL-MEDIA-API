import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { NotificationType } from '@prisma/client';
import prisma from '../utils/prisma';

let io: Server | null = null;

export const initSocketIO = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
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
      post: { select: { id: true, caption: true } },
    },
  });

  if (io) {
    io.to(`user:${input.recipientId}`).emit('notification:new', notification);
  }

  return notification;
};
