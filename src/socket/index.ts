import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { authenticateSocket } from '../middleware/auth';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../types/socket';
import { setupMessageHandlers } from './messageHandler';

// Store online users (userId -> socketId mapping)
export const onlineUsers = new Map<string, string>();

export const initializeSocket = (httpServer: HTTPServer): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
> => {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGINS?.split(',') || [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
      ],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Apply authentication middleware
  io.use(authenticateSocket);

  // Handle connections
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    
    console.log(`✅ User connected: ${userId} (${socket.id})`);

    // Store user as online
    onlineUsers.set(userId, socket.id);

    // Join user's personal room
    socket.join(userId);

    // Broadcast to others that user is online
    socket.broadcast.emit('userOnline', userId);

    // Setup message handlers
    setupMessageHandlers(io, socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${userId} (${socket.id})`);
      
      // Remove from online users
      onlineUsers.delete(userId);
      
      // Broadcast to others that user is offline
      socket.broadcast.emit('userOffline', userId);
    });
  });

  console.log('🔌 Socket.IO server initialized');

  return io;
};

export let io: SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export const setSocketInstance = (instance: SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>): void => {
  io = instance;
};


