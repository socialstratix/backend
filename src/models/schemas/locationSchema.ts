import mongoose, { Schema } from 'mongoose';
import { ILocation } from '../../types';

export const locationSchema = new Schema<ILocation>(
  {
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

