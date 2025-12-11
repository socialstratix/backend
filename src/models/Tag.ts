import mongoose, { Schema } from 'mongoose';
import { ITag, TagCategory } from '../types';

const tagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      enum: ['campaign', 'influencer', 'general'],
      default: 'general',
    },
    usageCount: {
      type: Number,
      default: 0,
      min: [0, 'Usage count cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
tagSchema.index({ name: 1 }, { unique: true });
tagSchema.index({ category: 1 });
tagSchema.index({ usageCount: -1 }); // For sorting by most used tags

export const Tag = mongoose.model<ITag>('Tag', tagSchema);

