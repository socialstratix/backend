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
            // Delete old profile image if it exists and is a Google Drive URL
            if (influencer.profileImage && influencer.profileImage.includes('drive.google.com')) {
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

            // Upload to Google Drive
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
            // Delete old cover image if it exists and is a Google Drive URL
            if (influencer.coverImage && influencer.coverImage.includes('drive.google.com')) {
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

            // Upload to Google Drive
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
            message: 'Failed to upload images to Google Drive',
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
}

