import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import mongoose from 'mongoose';
import { io } from '../socket';

export const sendMessage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user._id;
    const { conversationId, text, attachments } = req.body;

    // Validate input
    if (!conversationId || !text?.trim()) {
      res.status(400).json({
        success: false,
        message: 'Conversation ID and message text are required',
      });
      return;
    }

    // Check if conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
      return;
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
      return;
    }

    // Create the message
    const message = await Message.create({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      senderId: userId,
      text: text.trim(),
      attachments: attachments || [],
      isRead: false,
    });

    // Populate sender info
    await message.populate('senderId', 'name avatar email');

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        text: text.trim(),
        senderId: userId,
        timestamp: new Date(),
      },
      updatedAt: new Date(),
    });

    // Emit to socket if available
    if (io) {
      // Emit to conversation room
      io.to(conversationId).emit('newMessage', message.toObject());

      // Also emit to each participant's personal room
      conversation.participants.forEach((participantId) => {
        io.to(participantId.toString()).emit('newMessage', message.toObject());
      });
    }

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully',
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send message',
    });
  }
};

export const markAsRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    // Find message
    const message = await Message.findById(id);
    if (!message) {
      res.status(404).json({
        success: false,
        message: 'Message not found',
      });
      return;
    }

    // Only the receiver can mark as read (not the sender)
    if (message.senderId.toString() === userId.toString()) {
      res.status(400).json({
        success: false,
        message: 'You cannot mark your own message as read',
      });
      return;
    }

    // Verify user is participant in the conversation
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: userId,
    });

    if (!conversation) {
      res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
      return;
    }

    // Update message
    message.isRead = true;
    message.readAt = new Date();
    await message.save();

    // Emit read receipt via socket
    if (io) {
      io.to(message.senderId.toString()).emit('messageRead', {
        messageId: message._id.toString(),
        readAt: message.readAt,
      });
    }

    res.json({
      success: true,
      data: message,
      message: 'Message marked as read',
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to mark message as read',
    });
  }
};

export const getUnreadCount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user._id;

    // Get all conversations where user is participant
    const conversations = await Conversation.find({
      participants: userId,
    }).select('_id');

    const conversationIds = conversations.map((c) => c._id);

    // Count unread messages in these conversations where user is NOT the sender
    const unreadCount = await Message.countDocuments({
      conversationId: { $in: conversationIds },
      senderId: { $ne: userId },
      isRead: false,
    });

    res.json({
      success: true,
      data: {
        unreadCount,
      },
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get unread count',
    });
  }
};


