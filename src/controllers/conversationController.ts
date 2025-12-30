import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { User } from '../models/User';
import mongoose from 'mongoose';

export const getConversations = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Find conversations where user is a participant
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('participants', 'name avatar email userType')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Conversation.countDocuments({
      participants: userId,
    });

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch conversations',
    });
  }
};

export const getConversation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    }).populate('participants', 'name avatar email userType');

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
      return;
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch conversation',
    });
  }
};

export const createConversation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user._id;
    const { participantId } = req.body;

    if (!participantId) {
      res.status(400).json({
        success: false,
        message: 'Participant ID is required',
      });
      return;
    }

    // Validate participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
      return;
    }

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      participants: {
        $all: [userId, participantId],
        $size: 2,
      },
    }).populate('participants', 'name avatar email userType');

    if (existingConversation) {
      res.json({
        success: true,
        data: existingConversation,
        message: 'Conversation already exists',
      });
      return;
    }

    // Create new conversation
    const conversation = await Conversation.create({
      participants: [userId, participantId],
    });

    await conversation.populate('participants', 'name avatar email userType');

    res.status(201).json({
      success: true,
      data: conversation,
      message: 'Conversation created successfully',
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create conversation',
    });
  }
};

export const getMessages = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
      return;
    }

    // Fetch messages
    const messages = await Message.find({
      conversationId: id,
    })
      .populate('senderId', 'name avatar email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Message.countDocuments({
      conversationId: id,
    });

    // Reverse messages so oldest is first
    messages.reverse();

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch messages',
    });
  }
};

export const deleteConversation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    // Find and delete conversation if user is participant
    const conversation = await Conversation.findOneAndDelete({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
      return;
    }

    // Also delete all messages in the conversation
    await Message.deleteMany({
      conversationId: id,
    });

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete conversation',
    });
  }
};


