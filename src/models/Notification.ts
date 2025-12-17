import mongoose, { Schema } from 'mongoose';
import { INotification, NotificationType } from '../types';

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    type: {
      type: String,
      enum: [
        'campaign_application',
        'message',
        'campaign_update',
        'campaign_accepted',
        'campaign_rejected',
      ],
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
      // Polymorphic reference - can reference different collections
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 }); // For fetching unread notifications
// Note: userId is already included in the compound index above, so no need for separate index

export const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema
);

