import mongoose, { Schema } from 'mongoose';
import { ISocialMediaProfile, Platform } from '../types';

const socialMediaProfileSchema = new Schema<ISocialMediaProfile>(
  {
    influencerId: {
      type: Schema.Types.ObjectId,
      ref: 'Influencer',
      required: [true, 'Influencer ID is required'],
    },
    platform: {
      type: String,
      enum: ['youtube', 'facebook', 'instagram', 'tiktok', 'x'],
      required: [true, 'Platform is required'],
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
    },
    profileUrl: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Please provide a valid URL'],
    },
    followers: {
      type: Number,
      default: 0,
      min: [0, 'Followers cannot be negative'],
    },
    following: {
      type: Number,
      default: 0,
      min: [0, 'Following cannot be negative'],
    },
    posts: {
      type: Number,
      default: 0,
      min: [0, 'Posts cannot be negative'],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastSynced: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
socialMediaProfileSchema.index(
  { influencerId: 1, platform: 1 },
  { unique: true }
); // One profile per platform per influencer
socialMediaProfileSchema.index({ platform: 1 });
socialMediaProfileSchema.index({ followers: -1 }); // For sorting by followers (descending)

export const SocialMediaProfile = mongoose.model<ISocialMediaProfile>(
  'SocialMediaProfile',
  socialMediaProfileSchema
);

