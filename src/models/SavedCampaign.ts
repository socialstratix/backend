import mongoose, { Schema } from 'mongoose';
import { ISavedCampaign } from '../types';

const savedCampaignSchema = new Schema<ISavedCampaign>(
  {
    influencerId: {
      type: Schema.Types.ObjectId,
      ref: 'Influencer',
      required: [true, 'Influencer ID is required'],
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: [true, 'Campaign ID is required'],
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound unique index to prevent duplicate saves
savedCampaignSchema.index({ influencerId: 1, campaignId: 1 }, { unique: true });

// Index for efficient queries
savedCampaignSchema.index({ influencerId: 1, savedAt: -1 });
savedCampaignSchema.index({ campaignId: 1 });

export const SavedCampaign = mongoose.model<ISavedCampaign>('SavedCampaign', savedCampaignSchema);

