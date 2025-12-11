import mongoose, { Schema } from 'mongoose';
import { ICampaign, CampaignStatus, Platform } from '../types';

const campaignSchema = new Schema<ICampaign>(
  {
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Brand ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Campaign description is required'],
      trim: true,
    },
    budget: {
      type: Number,
      required: [true, 'Budget is required'],
      min: [0, 'Budget cannot be negative'],
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'closed', 'completed'],
      default: 'draft',
    },
    platforms: {
      type: [String],
      enum: ['youtube', 'facebook', 'instagram', 'tiktok', 'x'],
      required: [true, 'At least one platform is required'],
      validate: {
        validator: (v: Platform[]) => v.length > 0,
        message: 'At least one platform must be selected',
      },
    },
    tags: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      trim: true,
    },
    publishDate: {
      type: Date,
    },
    publishTime: {
      type: String,
      trim: true,
    },
    deadline: {
      type: Date,
    },
    requirements: {
      type: String,
      trim: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
campaignSchema.index({ brandId: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ platforms: 1 });
campaignSchema.index({ createdAt: -1 }); // For sorting by newest first
campaignSchema.index({ tags: 'text', name: 'text', description: 'text' }); // Text search index

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);

