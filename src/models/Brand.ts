import mongoose, { Schema } from 'mongoose';
import { IBrand, ILocation } from '../types';

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

const brandSchema = new Schema<IBrand>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    description: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Please provide a valid URL'],
    },
    location: {
      type: locationSchema,
    },
    logo: {
      type: String,
      trim: true,
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
brandSchema.index({ userId: 1 }, { unique: true });

export const Brand = mongoose.model<IBrand>('Brand', brandSchema);

