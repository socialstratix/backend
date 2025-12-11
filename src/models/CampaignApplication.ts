import mongoose, { Schema } from 'mongoose';
import { ICampaignApplication, ApplicationStatus } from '../types';

const campaignApplicationSchema = new Schema<ICampaignApplication>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign ID is required'],
    },
    influencerId: {
      type: Schema.Types.ObjectId,
      ref: 'Influencer',
      required: [true, 'Influencer ID is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
    },
    message: {
      type: String,
      trim: true,
    },
    proposedRate: {
      type: Number,
      min: [0, 'Proposed rate cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
campaignApplicationSchema.index(
  { campaignId: 1, influencerId: 1 },
  { unique: true }
); // One application per influencer per campaign
campaignApplicationSchema.index({ campaignId: 1, status: 1 });
campaignApplicationSchema.index({ influencerId: 1, status: 1 });

export const CampaignApplication = mongoose.model<ICampaignApplication>(
  'CampaignApplication',
  campaignApplicationSchema
);

