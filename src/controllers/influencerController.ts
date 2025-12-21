import { Request, Response } from 'express';
import { Influencer } from '../models/Influencer';
import { User } from '../models/User';
import { SocialMediaProfile } from '../models/SocialMediaProfile';
import { AuthRequest } from '../middleware/auth';
import storageService from '../services/storageService';
import path from 'path';

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
        // First, find users that match the search query by name
        // This allows searching influencers by their user name
        const matchingUsers = await User.find({
          name: { $regex: search, $options: 'i' },
          userType: 'influencer',
        }).select('_id');
        
        const matchingUserIds = matchingUsers.map((user) => user._id);
        
        // Build search filter to include user name search
        filter.$or = [
          { bio: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
        
        // If we found matching users by name, include them in the search
        if (matchingUserIds.length > 0) {
          filter.$or.push({ userId: { $in: matchingUserIds } });
        }
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

  /**
   * Update influencer profile
   * @route PUT /api/v1/influencer/:userId
   */
  static async updateInfluencer(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const updateData = req.body;

      // Check if authenticated user matches the userId
      if (req.user && req.user._id.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized to update this influencer profile',
        });
        return;
      }

      // Find influencer by userId
      let influencer = await Influencer.findOne({ userId });

      if (!influencer) {
        res.status(404).json({
          success: false,
          message: 'Influencer not found',
        });
        return;
      }

      // Handle image uploads if files are present
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      if (files) {
        try {
          // Handle profile image upload
          if (files.profileImage && files.profileImage[0]) {
            // Delete old profile image if it exists
            if (influencer.profileImage) {
              try {
                await storageService.deleteFile(influencer.profileImage);
              } catch (deleteError) {
                console.warn('Failed to delete old profile image:', deleteError);
              }
            }

            // Generate unique filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = path.extname(files.profileImage[0].originalname);
            const name = path.basename(files.profileImage[0].originalname, ext);
            const filename = `${name}-${uniqueSuffix}${ext}`;

            // Upload to storage (Cloudinary with Drive fallback)
            const profileImageUrl = await storageService.uploadFile({
              buffer: files.profileImage[0].buffer,
              filename: filename,
              mimetype: files.profileImage[0].mimetype,
              folderType: 'influencer-profile',
            });

            updateData.profileImage = profileImageUrl;
          }

          // Handle cover image upload
          if (files.coverImage && files.coverImage[0]) {
            // Delete old cover image if it exists
            if (influencer.coverImage) {
              try {
                await storageService.deleteFile(influencer.coverImage);
              } catch (deleteError) {
                console.warn('Failed to delete old cover image:', deleteError);
              }
            }

            // Generate unique filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = path.extname(files.coverImage[0].originalname);
            const name = path.basename(files.coverImage[0].originalname, ext);
            const filename = `${name}-${uniqueSuffix}${ext}`;

            // Upload to storage (Cloudinary with Drive fallback)
            const coverImageUrl = await storageService.uploadFile({
              buffer: files.coverImage[0].buffer,
              filename: filename,
              mimetype: files.coverImage[0].mimetype,
              folderType: 'influencer-cover',
            });

            updateData.coverImage = coverImageUrl;
          }
        } catch (uploadError: any) {
          res.status(500).json({
            success: false,
            message: 'Failed to upload images',
            error: uploadError.message,
          });
          return;
        }
      }

      // Update influencer fields
      if (updateData.description !== undefined) influencer.description = updateData.description;
      if (updateData.bio !== undefined) influencer.bio = updateData.bio;
      if (updateData.location) {
        // Handle location - if it's a JSON string (from FormData), parse it; otherwise use as is
        if (typeof updateData.location === 'string') {
          try {
            influencer.location = JSON.parse(updateData.location);
          } catch (e) {
            // If parsing fails, keep existing location
            console.warn('Failed to parse location:', e);
          }
        } else {
          influencer.location = updateData.location;
        }
      }
      if (updateData.profileImage) influencer.profileImage = updateData.profileImage;
      if (updateData.coverImage) influencer.coverImage = updateData.coverImage;
      if (updateData.tags) {
        // Handle tags - if it's a JSON string (from FormData), parse it; otherwise use as is
        if (typeof updateData.tags === 'string') {
          try {
            influencer.tags = JSON.parse(updateData.tags);
          } catch (e) {
            // If parsing fails, treat as single tag
            influencer.tags = [updateData.tags];
          }
        } else {
          influencer.tags = updateData.tags;
        }
      }

      await influencer.save();

      // Populate userId to get user details
      await influencer.populate('userId', 'name email avatar');

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

      // Format response to match GET endpoints
      const formattedInfluencer = {
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

      res.status(200).json({
        success: true,
        message: 'Influencer profile updated successfully',
        data: {
          influencer: formattedInfluencer,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update influencer profile',
        error: error.message,
      });
    }
  }

  /**
   * Get influencer followers data (dummy API for demo)
   * @route GET /api/v1/influencer/:influencerId/followers
   */
  static async getInfluencerFollowers(req: Request, res: Response): Promise<void> {
    try {
      const { influencerId } = req.params;
      const period = (req.query.period as string) || '7d';

      // Validate influencerId format (should be MongoDB ObjectId)
      if (!/^[0-9a-fA-F]{24}$/.test(influencerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid influencer ID format',
        });
        return;
      }

      // Validate period
      const validPeriods = ['7d', '30d'];
      const normalizedPeriod = validPeriods.includes(period) ? period : '7d';
      const periodLabel = normalizedPeriod === '7d' ? 'Last 7 days' : 'Last 30 days';

      // Generate realistic dummy follower data
      // Use influencerId as seed for consistent data per influencer
      const seed = influencerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Generate platform-specific followers with some variation
      const platformFollowers: {
        youtube?: number;
        instagram?: number;
        tiktok?: number;
        facebook?: number;
        x?: number;
      } = {};

      // YouTube: 50K-500K range
      platformFollowers.youtube = Math.floor(50000 + (seed % 450000));
      
      // Instagram: 30K-300K range
      platformFollowers.instagram = Math.floor(30000 + ((seed * 2) % 270000));
      
      // TikTok: 20K-200K range
      platformFollowers.tiktok = Math.floor(20000 + ((seed * 3) % 180000));
      
      // Facebook: 10K-100K range
      platformFollowers.facebook = Math.floor(10000 + ((seed * 4) % 90000));
      
      // X (Twitter): 5K-50K range
      platformFollowers.x = Math.floor(5000 + ((seed * 5) % 45000));

      // Calculate total followers
      const totalFollowers = Object.values(platformFollowers).reduce((sum, count) => sum + (count || 0), 0);

      // Adjust for different periods (30d might show slightly higher numbers)
      const periodMultiplier = normalizedPeriod === '30d' ? 1.05 : 1.0;
      const adjustedPlatformFollowers: typeof platformFollowers = {};
      for (const [platform, count] of Object.entries(platformFollowers)) {
        adjustedPlatformFollowers[platform as keyof typeof platformFollowers] = Math.floor(
          (count || 0) * periodMultiplier
        );
      }
      const adjustedTotal = Math.floor(totalFollowers * periodMultiplier);

      res.status(200).json({
        success: true,
        data: {
          influencerId,
          period: normalizedPeriod,
          platformFollowers: adjustedPlatformFollowers,
          totalFollowers: adjustedTotal,
          periodLabel,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch influencer followers',
        error: error.message,
      });
    }
  }

  /**
   * Get influencer shorts data (dummy API for demo)
   * @route GET /api/v1/influencer/:influencerId/shorts
   */
  static async getInfluencerShorts(req: Request, res: Response): Promise<void> {
    try {
      const { influencerId } = req.params;
      const period = (req.query.period as string) || '7d';

      // Validate influencerId format
      if (!/^[0-9a-fA-F]{24}$/.test(influencerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid influencer ID format',
        });
        return;
      }

      // Validate period
      const validPeriods = ['7d', '30d'];
      const normalizedPeriod = validPeriods.includes(period) ? period : '7d';
      const periodLabel = normalizedPeriod === '7d' ? 'Last 7 days' : 'Last 30 days';

      // Use influencerId as seed for consistent data
      const seed = influencerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

      // Generate 5-10 shorts based on period
      const itemCount = normalizedPeriod === '30d' ? 8 : 6;
      const shorts = [];

      const platforms: Array<'youtube' | 'instagram' | 'tiktok'> = ['youtube', 'instagram', 'tiktok'];
      const titles = [
        'Quick Tips for Better Content',
        'Behind the Scenes Moment',
        'Day in My Life',
        'Product Review Unboxing',
        'Travel Vlog Highlights',
        'Cooking Challenge',
        'Fitness Routine',
        'Tech Gadget Review',
        'Fashion Haul',
        'Comedy Skit',
      ];

      const now = new Date();
      const daysBack = normalizedPeriod === '30d' ? 30 : 7;

      for (let i = 0; i < itemCount; i++) {
        const itemSeed = (seed + i * 100) % 1000;
        const platform = platforms[itemSeed % platforms.length];
        const title = titles[(itemSeed + i) % titles.length];
        
        // Generate date within the period
        const daysAgo = Math.floor((itemSeed % daysBack) + 1);
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);

        // Generate views: 1K-500K for shorts
        const views = Math.floor(1000 + (itemSeed * 50) % 499000);

        // Generate duration: 15-60 seconds
        const durationSeconds = Math.floor(15 + (itemSeed % 45));
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Use picsum.photos for thumbnails with consistent seed
        const thumbnailSeed = seed + i * 10;

        shorts.push({
          id: `short-${influencerId}-${i}`,
          thumbnail: `https://picsum.photos/200/300?random=${thumbnailSeed}`,
          title,
          views,
          date: date.toISOString(),
          duration,
          platform,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          influencerId,
          period: normalizedPeriod,
          periodLabel,
          items: shorts,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch influencer shorts',
        error: error.message,
      });
    }
  }

  /**
   * Get influencer videos data (dummy API for demo)
   * @route GET /api/v1/influencer/:influencerId/videos
   */
  static async getInfluencerVideos(req: Request, res: Response): Promise<void> {
    try {
      const { influencerId } = req.params;
      const period = (req.query.period as string) || '7d';

      // Validate influencerId format
      if (!/^[0-9a-fA-F]{24}$/.test(influencerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid influencer ID format',
        });
        return;
      }

      // Validate period
      const validPeriods = ['7d', '30d'];
      const normalizedPeriod = validPeriods.includes(period) ? period : '7d';
      const periodLabel = normalizedPeriod === '7d' ? 'Last 7 days' : 'Last 30 days';

      // Use influencerId as seed for consistent data
      const seed = influencerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

      // Generate 3-5 videos based on period
      const itemCount = normalizedPeriod === '30d' ? 5 : 3;
      const videos = [];

      const platforms: Array<'youtube' | 'instagram' | 'tiktok'> = ['youtube', 'instagram', 'tiktok'];
      const titles = [
        'Complete Guide to Content Creation',
        'In-Depth Product Review',
        'Full Travel Documentary',
        'Comprehensive Tutorial Series',
        'Extended Interview Session',
        'Long-Form Storytelling',
        'Deep Dive Analysis',
      ];

      const now = new Date();
      const daysBack = normalizedPeriod === '30d' ? 30 : 7;

      for (let i = 0; i < itemCount; i++) {
        const itemSeed = (seed + i * 200) % 1000;
        const platform = platforms[itemSeed % platforms.length];
        const title = titles[(itemSeed + i) % titles.length];
        
        // Generate date within the period
        const daysAgo = Math.floor((itemSeed % daysBack) + 1);
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);

        // Generate views: 10K-2M for videos
        const views = Math.floor(10000 + (itemSeed * 200) % 1990000);

        // Generate duration: 2-30 minutes
        const durationMinutes = Math.floor(2 + (itemSeed % 28));
        const durationSeconds = Math.floor((itemSeed * 7) % 60);
        const duration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;

        // Use picsum.photos for thumbnails with consistent seed
        const thumbnailSeed = seed + i * 20;

        videos.push({
          id: `video-${influencerId}-${i}`,
          thumbnail: `https://picsum.photos/400/300?random=${thumbnailSeed}`,
          title,
          views,
          date: date.toISOString(),
          duration,
          platform,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          influencerId,
          period: normalizedPeriod,
          periodLabel,
          items: videos,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch influencer videos',
        error: error.message,
      });
    }
  }
}

