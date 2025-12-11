import mongoose, { Schema } from 'mongoose';
import { IInfluencer, ILocation } from '../types';

const locationSchema = new Schema<ILocation>(
  {
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

const influencerSchema = new Schema<IInfluencer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    description: {
      type: String,
      trim: true,
    },
    location: {
      type: locationSchema,
    },
    mobile: {
      type: String,
      trim: true,
    },
    countryCode: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      trim: true,
    },
    coverImage: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be more than 5'],
    },
    isTopCreator: {
      type: Boolean,
      default: false,
    },
    hasVerifiedPayment: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
influencerSchema.index({ userId: 1 }, { unique: true });
influencerSchema.index({ isTopCreator: 1 });
influencerSchema.index({ tags: 1 }); // For tag-based queries
influencerSchema.index({ tags: 'text', bio: 'text', description: 'text' }); // Text search index

export const Influencer = mongoose.model<IInfluencer>('Influencer', influencerSchema);

