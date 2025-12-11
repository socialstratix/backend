# Stratix Database Schema Documentation

## Overview

This document describes the MongoDB database schema for the Stratix influencer marketing platform. The schema supports brands posting campaigns, influencers discovering and applying to campaigns, messaging between users, and social media profile management.

## Database Collections

### 1. **users** Collection

Base user collection for authentication and common user data.

**Schema:**
- `_id`: ObjectId (auto-generated)
- `email`: String (required, unique, indexed)
- `password`: String (required, hashed)
- `name`: String (required)
- `avatar`: String (URL, optional)
- `userType`: String (enum: 'brand', 'influencer', required)
- `isEmailVerified`: Boolean (default: false)
- `createdAt`: Date (default: now)
- `updatedAt`: Date (default: now)
- `lastLogin`: Date (optional)

**Indexes:**
- `email` (unique)
- `userType`

**Relationships:**
- One-to-one with `brands` or `influencers` collections via `userId`

---

### 2. **brands** Collection

Extended profile for brand users.

**Schema:**
- `_id`: ObjectId
- `userId`: ObjectId (ref: users, required, unique, indexed)
- `companyName`: String (required)
- `description`: String (optional)
- `website`: String (optional)
- `location`: Object {
    - `address`: String
    - `city`: String
    - `state`: String
    - `country`: String
    - `pincode`: String
  }
- `logo`: String (URL, optional)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes:**
- `userId` (unique)

**Relationships:**
- Belongs to one `user` via `userId`
- Has many `campaigns` via `brandId`

---

### 3. **influencers** Collection

Extended profile for influencer users.

**Schema:**
- `_id`: ObjectId
- `userId`: ObjectId (ref: users, required, unique, indexed)
- `bio`: String (optional, max 500 characters)
- `description`: String (optional)
- `location`: Object {
    - `address`: String
    - `city`: String
    - `state`: String
    - `country`: String
    - `pincode`: String
  }
- `profileImage`: String (URL, optional)
- `coverImage`: String (URL, optional)
- `rating`: Number (0-5, optional)
- `isTopCreator`: Boolean (default: false)
- `hasVerifiedPayment`: Boolean (default: false)
- `tags`: Array of Strings (optional)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes:**
- `userId` (unique)
- `isTopCreator`
- `tags` (for tag-based queries)
- Text index on `tags`, `bio`, `description` (for search)

**Relationships:**
- Belongs to one `user` via `userId`
- Has many `socialMediaProfiles` via `influencerId`
- Has many `campaignApplications` via `influencerId`

---

### 4. **socialMediaProfiles** Collection

Social media platform profiles for influencers.

**Schema:**
- `_id`: ObjectId
- `influencerId`: ObjectId (ref: influencers, required, indexed)
- `platform`: String (enum: 'youtube', 'facebook', 'instagram', 'tiktok', 'x', required)
- `username`: String (required)
- `profileUrl`: String (URL, optional)
- `followers`: Number (default: 0)
- `following`: Number (default: 0)
- `posts`: Number (default: 0)
- `isVerified`: Boolean (default: false)
- `lastSynced`: Date (optional)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes:**
- `influencerId` + `platform` (compound, unique) - One profile per platform per influencer
- `platform`
- `followers` (descending, for sorting)

**Relationships:**
- Belongs to one `influencer` via `influencerId`

---

### 5. **campaigns** Collection

Marketing campaigns posted by brands.

**Schema:**
- `_id`: ObjectId
- `brandId`: ObjectId (ref: brands, required, indexed)
- `name`: String (required)
- `description`: String (required)
- `budget`: Number (required, min: 0)
- `status`: String (enum: 'draft', 'active', 'closed', 'completed', default: 'draft')
- `platforms`: Array of Strings (enum: ['youtube', 'facebook', 'instagram', 'tiktok', 'x'], required, min: 1)
- `tags`: Array of Strings (optional)
- `location`: String (optional)
- `publishDate`: Date (optional)
- `publishTime`: String (optional)
- `deadline`: Date (optional)
- `requirements`: String (optional)
- `attachments`: Array of Strings (URLs, optional)
- `isClosed`: Boolean (default: false)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes:**
- `brandId`
- `status`
- `platforms`
- `createdAt` (descending, for sorting)
- Text index on `tags`, `name`, `description` (for search)

**Relationships:**
- Belongs to one `brand` via `brandId`
- Has many `campaignApplications` via `campaignId`

---

### 6. **campaignApplications** Collection

Applications from influencers to campaigns.

**Schema:**
- `_id`: ObjectId
- `campaignId`: ObjectId (ref: campaigns, required, indexed)
- `influencerId`: ObjectId (ref: influencers, required, indexed)
- `status`: String (enum: 'pending', 'accepted', 'rejected', 'withdrawn', default: 'pending')
- `message`: String (optional)
- `proposedRate`: Number (optional, min: 0)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes:**
- `campaignId` + `influencerId` (compound, unique) - One application per influencer per campaign
- `campaignId` + `status`
- `influencerId` + `status`

**Relationships:**
- Belongs to one `campaign` via `campaignId`
- Belongs to one `influencer` via `influencerId`

---

### 7. **conversations** Collection

Conversation threads between users.

**Schema:**
- `_id`: ObjectId
- `participants`: Array of ObjectIds (ref: users, required, min: 2, indexed)
- `lastMessage`: Object {
    - `text`: String
    - `senderId`: ObjectId (ref: users)
    - `timestamp`: Date
  } (optional)
- `unreadCount`: Map (userId -> count mapping, optional)
- `createdAt`: Date
- `updatedAt`: Date

**Indexes:**
- `participants` (compound index)
- `updatedAt` (descending, for sorting by most recent)

**Relationships:**
- Has many `users` via `participants` (many-to-many)
- Has many `messages` via `conversationId`

---

### 8. **messages** Collection

Individual messages in conversations.

**Schema:**
- `_id`: ObjectId
- `conversationId`: ObjectId (ref: conversations, required, indexed)
- `senderId`: ObjectId (ref: users, required, indexed)
- `text`: String (required)
- `attachments`: Array of Strings (URLs, optional)
- `isRead`: Boolean (default: false)
- `readAt`: Date (optional)
- `createdAt`: Date (indexed for sorting)

**Indexes:**
- `conversationId` + `createdAt` (compound) - For fetching messages in a conversation chronologically
- `senderId`
- `createdAt` (descending, for sorting)

**Relationships:**
- Belongs to one `conversation` via `conversationId`
- Belongs to one `user` (sender) via `senderId`

---

### 9. **tags** Collection

Tags/categories used across the platform.

**Schema:**
- `_id`: ObjectId
- `name`: String (required, unique, indexed, lowercase)
- `category`: String (enum: 'campaign', 'influencer', 'general', default: 'general')
- `usageCount`: Number (default: 0, min: 0)
- `createdAt`: Date

**Indexes:**
- `name` (unique)
- `category`
- `usageCount` (descending, for sorting by most used)

**Relationships:**
- Referenced by `campaigns.tags` and `influencers.tags` (many-to-many via string matching)

---

### 10. **notifications** Collection

User notifications.

**Schema:**
- `_id`: ObjectId
- `userId`: ObjectId (ref: users, required, indexed)
- `type`: String (enum: 'campaign_application', 'message', 'campaign_update', 'campaign_accepted', 'campaign_rejected', required)
- `title`: String (required)
- `message`: String (required)
- `relatedId`: ObjectId (optional, polymorphic reference)
- `isRead`: Boolean (default: false)
- `readAt`: Date (optional)
- `createdAt`: Date

**Indexes:**
- `userId` + `isRead` + `createdAt` (compound) - For fetching unread notifications
- `userId`

**Relationships:**
- Belongs to one `user` via `userId`
- `relatedId` can reference different collections (polymorphic)

---

## Entity Relationship Diagram

```
Users (1) ──┬── (1) Brands
            │
            └── (1) Influencers (1) ── (many) SocialMediaProfiles

Brands (1) ── (many) Campaigns (1) ── (many) CampaignApplications (many) ── (1) Influencers

Users (many) ── (many) Conversations (1) ── (many) Messages (1) ── (1) Users (sender)

Tags ── (referenced by) Campaigns.tags, Influencers.tags

Users (1) ── (many) Notifications
```

## Relationships Summary

- **Users → Brands/Influencers**: One-to-one (via `userId`)
- **Brands → Campaigns**: One-to-many (via `brandId`)
- **Influencers → SocialMediaProfiles**: One-to-many (via `influencerId`)
- **Campaigns → CampaignApplications**: One-to-many (via `campaignId`)
- **Influencers → CampaignApplications**: One-to-many (via `influencerId`)
- **Users → Conversations**: Many-to-many (via `participants` array)
- **Conversations → Messages**: One-to-many (via `conversationId`)
- **Users → Messages**: One-to-many (via `senderId`)
- **Users → Notifications**: One-to-many (via `userId`)

## Index Strategy

### Unique Indexes
- `users.email`
- `brands.userId`
- `influencers.userId`
- `socialMediaProfiles.influencerId + platform`
- `campaignApplications.campaignId + influencerId`
- `tags.name`

### Compound Indexes
- `campaignApplications.campaignId + status`
- `campaignApplications.influencerId + status`
- `messages.conversationId + createdAt`
- `notifications.userId + isRead + createdAt`

### Text Indexes
- `influencers.tags + bio + description` (for influencer search)
- `campaigns.tags + name + description` (for campaign search)

### Sorting Indexes
- `socialMediaProfiles.followers` (descending)
- `campaigns.createdAt` (descending)
- `conversations.updatedAt` (descending)
- `messages.createdAt` (descending)
- `tags.usageCount` (descending)

## Data Types

- **ObjectId**: MongoDB's unique identifier (12-byte identifier)
- **Date**: ISO 8601 format timestamps
- **String**: UTF-8 encoded strings
- **Number**: 64-bit floating point numbers
- **Boolean**: true/false values
- **Array**: Ordered list of values
- **Object/Map**: Key-value pairs

## Validation Rules

- Email format validation for `users.email`
- URL format validation for `brands.website` and `socialMediaProfiles.profileUrl`
- Enum validation for status fields and platform types
- Minimum value validation for numeric fields (budget, followers, etc.)
- Maximum length validation for text fields (bio: 500 characters)
- Array length validation (platforms: min 1, participants: min 2)

## Notes

- All timestamps use ISO 8601 format
- ObjectId references use Mongoose's `ref` for population
- Text indexes enable full-text search capabilities
- Compound indexes optimize common query patterns
- Soft deletes can be added with `deletedAt` field if needed
- Password field uses `select: false` to prevent accidental exposure
- All string fields are trimmed to remove leading/trailing whitespace

