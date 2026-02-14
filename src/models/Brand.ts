import mongoose, { Schema } from 'mongoose';
import { IBrand } from '../types';
import { locationSchema } from './schemas/locationSchema';
import { isValidUrl, validateTags } from '../utils/validation';

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
      validate: {
        validator: (value: string) => !value || isValidUrl(value),
        message: 'Please provide a valid URL (must start with http:// or https://)',
      },
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
      validate: {
        validator: (value: string[]) => {
          const result = validateTags(value);
          return result.isValid;
        },
        message: (props: any) => {
          const result = validateTags(props.value);
          return result.error || 'Invalid tags';
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to normalize tags
brandSchema.pre('save', function (next) {
  if (this.tags && Array.isArray(this.tags)) {
    const result = validateTags(this.tags);
    if (result.isValid && result.normalized) {
      this.tags = result.normalized;
    }
  }
  next();
});

// Indexes
brandSchema.index({ userId: 1 }, { unique: true });

export const Brand = mongoose.model<IBrand>('Brand', brandSchema);

