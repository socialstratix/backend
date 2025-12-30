import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../types/socket';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import mongoose from 'mongoose';

export const setupMessageHandlers = (
  io: SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  socket: Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >
): void => {
  const userId = socket.data.userId;

  // Handle joining a conversation room
  socket.on('joinConversation', (conversationId: string) => {
    socket.join(conversationId);
    console.log(`User ${userId} joined conversation ${conversationId}`);
  });

  // Handle leaving a conversation room
  socket.on('leaveConversation', (conversationId: string) => {
    socket.leave(conversationId);
    console.log(`User ${userId} left conversation ${conversationId}`);
  });

  // Handle sending a message
  socket.on('sendMessage', async (data, callback) => {
    try {
      const { conversationId, text } = data;

      // Validate input
      if (!conversationId || !text?.trim()) {
        if (callback) {
          callback({
            success: false,
            error: 'Conversation ID and message text are required',
          });
        }
        return;
      }

      // Check if conversation exists and user is a participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        if (callback) {
          callback({
            success: false,
            error: 'Conversation not found',
          });
        }
        return;
      }

      const isParticipant = conversation.participants.some(
        (p) => p.toString() === userId
      );
      if (!isParticipant) {
        if (callback) {
          callback({
            success: false,
            error: 'You are not a participant in this conversation',
          });
        }
        return;
      }

      // Create the message
      const message = await Message.create({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        senderId: new mongoose.Types.ObjectId(userId),
        text: text.trim(),
        isRead: false,
      });

      // Populate sender info
      await message.populate('senderId', 'name avatar email');

      // Update conversation's last message
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: {
          text: text.trim(),
          senderId: new mongoose.Types.ObjectId(userId),
          timestamp: new Date(),
        },
        updatedAt: new Date(),
      });

      // Emit to all participants in the conversation
      io.to(conversationId).emit('newMessage', message.toObject());

      // Also emit to each participant's personal room (for conversation list updates)
      conversation.participants.forEach((participantId) => {
        io.to(participantId.toString()).emit('newMessage', message.toObject());
      });

      // Send success callback
      if (callback) {
        callback({
          success: true,
          message: message.toObject(),
        });
      }

      console.log(`Message sent in conversation ${conversationId} by user ${userId}`);
    } catch (error) {
      console.error('Error sending message:', error);
      if (callback) {
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send message',
        });
      }
    }
  });

  // Handle typing indicator
  socket.on('typing', async (data) => {
    try {
      const { conversationId, isTyping } = data;

      // Verify user is participant
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      const isParticipant = conversation.participants.some(
        (p) => p.toString() === userId
      );
      if (!isParticipant) return;

      // Emit typing indicator to other participants in the conversation
      socket.to(conversationId).emit('typing', {
        userId,
        conversationId,
        isTyping,
      });
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  });

  // Handle message read
  socket.on('messageRead', async (data) => {
    try {
      const { messageId } = data;

      // Update message
      const message = await Message.findById(messageId);
      if (!message) return;

      // Only the receiver can mark as read
      if (message.senderId.toString() === userId) return;

      message.isRead = true;
      message.readAt = new Date();
      await message.save();

      // Notify sender
      io.to(message.senderId.toString()).emit('messageRead', {
        messageId,
        readAt: message.readAt,
      });

      console.log(`Message ${messageId} marked as read by user ${userId}`);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });
};


