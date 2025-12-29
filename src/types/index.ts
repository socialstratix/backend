import { Document, ObjectId } from 'mongoose';

// Base document interface
export interface BaseDocument extends Document {
  createdAt: Date;
  updatedAt: Date;
}

// User Types
export type UserType = 'brand' | 'influencer';

export interface IUser extends BaseDocument {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  userType: UserType;
  isEmailVerified: boolean;
  lastLogin?: Date;
}

// Plain object version of IUser (without Document methods)
export type UserPlainObject = Omit<IUser, keyof Document> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

// Location interface
export interface ILocation {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

// Brand Types
export interface IBrand extends BaseDocument {
  userId: ObjectId;
  description?: string;
  website?: string;
  location?: ILocation;
  logo?: string;
  tags?: string[];
}

// Influencer Types
export interface IInfluencer extends BaseDocument {
  userId: ObjectId;
  bio?: string;
  description?: string;
  location?: ILocation;
  mobile?: string;
  countryCode?: string;
  profileImage?: string;
  coverImage?: string;
  rating?: number;
  isTopCreator: boolean;
  hasVerifiedPayment: boolean;
  tags?: string[];
}

// Social Media Platform Types
export type Platform = 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'x';

export interface ISocialMediaProfile extends BaseDocument {
  influencerId: ObjectId;
  platform: Platform;
  username: string;
  profileUrl?: string;
  followers: number;
  following: number;
  posts: number;
  isVerified: boolean;
  lastSynced?: Date;
}

// Campaign Types
export type CampaignStatus = 'draft' | 'active' | 'closed' | 'completed';

export interface ICampaign extends BaseDocument {
  brandId: ObjectId;
  name: string;
  description: string;
  budget: number;
  status: CampaignStatus;
  platforms: Platform[];
  tags?: string[];
  location?: string;
  publishDate?: Date;
  publishTime?: string;
  deadline?: Date;
  requirements?: string;
  attachments?: string[];
  isClosed: boolean;
}

// Campaign Application Types
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface ICampaignApplication extends BaseDocument {
  campaignId: ObjectId;
  influencerId: ObjectId;
  status: ApplicationStatus;
  message?: string;
  proposedRate?: number;
}

// Saved Campaign Types
export interface ISavedCampaign extends BaseDocument {
  influencerId: ObjectId;
  campaignId: ObjectId;
  savedAt: Date;
}

// Conversation Types
export interface ILastMessage {
  text: string;
  senderId: ObjectId;
  timestamp: Date;
}

export interface IConversation extends BaseDocument {
  participants: ObjectId[];
  lastMessage?: ILastMessage;
  unreadCount?: Record<string, number>;
}

// Message Types
export interface IMessage extends BaseDocument {
  conversationId: ObjectId;
  senderId: ObjectId;
  text: string;
  attachments?: string[];
  isRead: boolean;
  readAt?: Date;
}

// Tag Types
export type TagCategory = 'campaign' | 'influencer' | 'general';

export interface ITag extends BaseDocument {
  name: string;
  category?: TagCategory;
  usageCount: number;
}

// Notification Types
export type NotificationType =
  | 'campaign_application'
  | 'message'
  | 'campaign_update'
  | 'campaign_accepted'
  | 'campaign_rejected';

export interface INotification extends BaseDocument {
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: ObjectId;
  isRead: boolean;
  readAt?: Date;
}

