import { Request, Response } from 'express';
import { Influencer } from '../models/Influencer';
import { User } from '../models/User';
import { SocialMediaProfile } from '../models/SocialMediaProfile';

export class InfluencerController {
  /**
   * Get all influencers with pagination and filtering
   * @route GET /api/v1/influencer
   */
  static async getAllInfluencers(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        tags,
        location,
        isTopCreator,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build filter query
      const filter: any = {};

      if (search) {
        filter.$or = [
          { bio: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      if (tags) {
        const tagArray = typeof tags === 'string' ? tags.split(',') : tags;
        filter.tags = { $in: tagArray };
      }

      if (location) {
        filter['location.city'] = { $regex: location, $options: 'i' };
      }

      if (isTopCreator !== undefined) {
        filter.isTopCreator = isTopCreator === 'true';
      }

      // Get total count
      const total = await Influencer.countDocuments(filter);

      // Get paginated influencers
      const influencers = await Influencer.find(filter)
        .populate('userId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      // Get social media profiles for all influencers
      const influencerIds = influencers.map((inf) => inf._id);
      const socialProfiles = await SocialMediaProfile.find({
        influencerId: { $in: influencerIds },
      });

      // Group social profiles by influencer ID
      const profilesByInfluencer = socialProfiles.reduce((acc, profile) => {
        const infId = profile.influencerId.toString();
        if (!acc[infId]) {
          acc[infId] = [];
        }
        acc[infId].push(profile);
        return acc;
      }, {} as Record<string, typeof socialProfiles>);

      // Format response with social media profiles
      const formattedInfluencers = influencers.map((influencer) => {
        const profiles = profilesByInfluencer[influencer._id.toString()] || [];
        const platformFollowers: {
          x?: number;
          youtube?: number;
          facebook?: number;
          instagram?: number;
          tiktok?: number;
        } = {};

        profiles.forEach((profile) => {
          if (profile.platform === 'x') {
            platformFollowers.x = profile.followers;
          } else if (profile.platform === 'youtube') {
            platformFollowers.youtube = profile.followers;
          } else if (profile.platform === 'facebook') {
            platformFollowers.facebook = profile.followers;
          } else if (profile.platform === 'instagram') {
            platformFollowers.instagram = profile.followers;
          } else if (profile.platform === 'tiktok') {
            platformFollowers.tiktok = profile.followers;
          }
        });

        return {
          _id: influencer._id,
          userId: influencer.userId,
          bio: influencer.bio,
          description: influencer.description,
          location: influencer.location,
          profileImage: influencer.profileImage,
          coverImage: influencer.coverImage,
          rating: influencer.rating,
          isTopCreator: influencer.isTopCreator,
          hasVerifiedPayment: influencer.hasVerifiedPayment,
          tags: influencer.tags,
          createdAt: influencer.createdAt,
          updatedAt: influencer.updatedAt,
          user: influencer.userId && typeof influencer.userId === 'object'
            ? {
                name: (influencer.userId as any).name,
                email: (influencer.userId as any).email,
                avatar: (influencer.userId as any).avatar,
              }
            : undefined,
          platformFollowers,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          influencers: formattedInfluencers,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch influencers',
        error: error.message,
      });
    }
  }

  /**
   * Get influencer profile by influencer ID (MongoDB _id)
   * @route GET /api/v1/influencer/id/:influencerId
   */
  static async getInfluencerById(req: Request, res: Response): Promise<void> {
    try {
      const { influencerId } = req.params;

      // Find influencer by _id
      const influencer = await Influencer.findById(influencerId).populate('userId', 'name email avatar');

      if (!influencer) {
        res.status(404).json({
          success: false,
          message: 'Influencer not found',
        });
        return;
      }

      // Get social media profiles
      const socialProfiles = await SocialMediaProfile.find({
        influencerId: influencer._id,
      });

      // Format platform followers
      const platformFollowers: {
        x?: number;
        youtube?: number;
        facebook?: number;
        instagram?: number;
        tiktok?: number;
      } = {};

      socialProfiles.forEach((profile) => {
        if (profile.platform === 'x') {
          platformFollowers.x = profile.followers;
        } else if (profile.platform === 'youtube') {
          platformFollowers.youtube = profile.followers;
        } else if (profile.platform === 'facebook') {
          platformFollowers.facebook = profile.followers;
        } else if (profile.platform === 'instagram') {
          platformFollowers.instagram = profile.followers;
        } else if (profile.platform === 'tiktok') {
          platformFollowers.tiktok = profile.followers;
        }
      });

      // Format response
      const response = {
        success: true,
        data: {
          influencer: {
            _id: influencer._id,
            userId: influencer.userId,
            bio: influencer.bio,
            description: influencer.description,
            location: influencer.location,
            profileImage: influencer.profileImage,
            coverImage: influencer.coverImage,
            rating: influencer.rating,
            isTopCreator: influencer.isTopCreator,
            hasVerifiedPayment: influencer.hasVerifiedPayment,
            tags: influencer.tags,
            createdAt: influencer.createdAt,
            updatedAt: influencer.updatedAt,
            user: influencer.userId && typeof influencer.userId === 'object'
              ? {
                  name: (influencer.userId as any).name,
                  email: (influencer.userId as any).email,
                  avatar: (influencer.userId as any).avatar,
                }
              : undefined,
            platformFollowers,
          },
        },
      };

      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch influencer profile',
        error: error.message,
      });
    }
  }

  /**
   * Get influencer profile by user ID
   * @route GET /api/v1/influencer/:userId
   */
  static async getInfluencerByUserId(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // Find influencer by userId
      const influencer = await Influencer.findOne({ userId }).populate('userId', 'name email avatar');

      if (!influencer) {
        res.status(404).json({
          success: false,
          message: 'Influencer not found',
        });
        return;
      }

      // Get social media profiles
      const socialProfiles = await SocialMediaProfile.find({
        influencerId: influencer._id,
      });

      // Format platform followers
      const platformFollowers: {
        x?: number;
        youtube?: number;
        facebook?: number;
        instagram?: number;
        tiktok?: number;
      } = {};

      socialProfiles.forEach((profile) => {
        if (profile.platform === 'x') {
          platformFollowers.x = profile.followers;
        } else if (profile.platform === 'youtube') {
          platformFollowers.youtube = profile.followers;
        } else if (profile.platform === 'facebook') {
          platformFollowers.facebook = profile.followers;
        } else if (profile.platform === 'instagram') {
          platformFollowers.instagram = profile.followers;
        } else if (profile.platform === 'tiktok') {
          platformFollowers.tiktok = profile.followers;
        }
      });

      // Format response
      const response = {
        success: true,
        data: {
          influencer: {
            _id: influencer._id,
            userId: influencer.userId,
            bio: influencer.bio,
            description: influencer.description,
            location: influencer.location,
            profileImage: influencer.profileImage,
            coverImage: influencer.coverImage,
            rating: influencer.rating,
            isTopCreator: influencer.isTopCreator,
            hasVerifiedPayment: influencer.hasVerifiedPayment,
            tags: influencer.tags,
            createdAt: influencer.createdAt,
            updatedAt: influencer.updatedAt,
            user: influencer.userId && typeof influencer.userId === 'object'
              ? {
                  name: (influencer.userId as any).name,
                  email: (influencer.userId as any).email,
                  avatar: (influencer.userId as any).avatar,
                }
              : undefined,
            platformFollowers,
          },
        },
      };

      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch influencer profile',
        error: error.message,
      });
    }
  }
}

