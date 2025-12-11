# Stratix Backend API

Backend API for the Stratix influencer marketing platform built with Node.js, Express, TypeScript, and MongoDB.

## Features

- MongoDB database with Mongoose ODM
- TypeScript for type safety
- Express.js REST API
- Comprehensive database schema for influencer marketing platform
- Support for brands, influencers, campaigns, messaging, and more

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # MongoDB connection configuration
│   ├── models/                   # Mongoose models
│   │   ├── User.ts
│   │   ├── Brand.ts
│   │   ├── Influencer.ts
│   │   ├── SocialMediaProfile.ts
│   │   ├── Campaign.ts
│   │   ├── CampaignApplication.ts
│   │   ├── Conversation.ts
│   │   ├── Message.ts
│   │   ├── Tag.ts
│   │   ├── Notification.ts
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   └── index.ts                 # Express app entry point
├── docs/
│   └── SCHEMA.md                # Database schema documentation
├── package.json
├── tsconfig.json
└── .env.example
```

## Database Collections

1. **users** - Base user authentication and profile
2. **brands** - Brand user profiles
3. **influencers** - Influencer user profiles
4. **socialMediaProfiles** - Social media platform data for influencers
5. **campaigns** - Marketing campaigns posted by brands
6. **campaignApplications** - Applications from influencers to campaigns
7. **conversations** - Message conversation threads
8. **messages** - Individual messages
9. **tags** - Tags/categories for campaigns and influencers
10. **notifications** - User notifications

See [SCHEMA.md](./docs/SCHEMA.md) for detailed schema documentation.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/stratix
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=your-secret-key-here
   ```

3. **Start MongoDB:**
   Make sure MongoDB is running on your system or use MongoDB Atlas.

4. **Run in development mode:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

6. **Start production server:**
   ```bash
   npm start
   ```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## API Endpoints

### Health Check
- `GET /health` - Check API status

## Database Models

All models are located in `src/models/` and use Mongoose schemas with:
- Type validation
- Indexes for performance
- Relationships via ObjectId references
- Timestamps (createdAt, updatedAt)

## TypeScript Types

All TypeScript interfaces are defined in `src/types/index.ts` and match the Mongoose schemas.

## Database Indexes

The schema includes optimized indexes for:
- Unique constraints (email, userId combinations)
- Query performance (status, platform, dates)
- Text search (tags, descriptions)
- Sorting (followers, dates, usage counts)

## Development

The project uses:
- **TypeScript** for type safety
- **Mongoose** for MongoDB ODM
- **Express** for REST API
- **dotenv** for environment variables

## License

MIT

