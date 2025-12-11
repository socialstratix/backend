import mongoose, { Schema } from 'mongoose';
import { IConversation, ILastMessage } from '../types';

const lastMessageSchema = new Schema<ILastMessage>(
  {
    text: {
      type: String,
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      required: [true, 'At least two participants are required'],
      validate: {
        validator: (v: mongoose.Types.ObjectId[]) => v.length >= 2,
        message: 'Conversation must have at least 2 participants',
      },
    },
    lastMessage: {
      type: lastMessageSchema,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 }); // For sorting by most recent conversations

export const Conversation = mongoose.model<IConversation>(
  'Conversation',
  conversationSchema
);

