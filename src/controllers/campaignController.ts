import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign';
import { Brand } from '../models/Brand';
import { AuthRequest } from '../middleware/auth';
import { Platform } from '../types';

export class CampaignController {
  /**
   * Get all campaigns
   * @route GET /api/v1/campaign
   */
  static async getAllCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const { status, sortBy } = req.query;

      // Build filter query
      const filter: any = {};

      // Filter by status if provided
      if (status) {
        if (status === 'active') {
          filter.status = 'active';
          filter.isClosed = false;
        } else if (status === 'completed') {
          filter.status = 'completed';
        } else if (status === 'previous') {
          filter.status = { $in: ['closed', 'completed'] };
        } else {
          filter.status = status;
        }
      } else {
        // By default, only show active campaigns (not closed)
        filter.isClosed = false;
        filter.status = 'active';
      }

      // Build sort query
      let sortQuery: any = { createdAt: -1 }; // Default sort by date (newest first)
      if (sortBy === 'budget') {
        sortQuery = { budget: -1 }; // Sort by budget (highest first)
      } else if (sortBy === 'name') {
        sortQuery = { name: 1 }; // Sort by name (A-Z)
      } else if (sortBy === 'date') {
        sortQuery = { createdAt: -1 }; // Sort by date (newest first)
      }

      // Fetch campaigns with brand information
      const campaigns = await Campaign.find(filter)
        .populate({
          path: 'brandId',
          select: 'userId logo',
          populate: {
            path: 'userId',
            select: 'name email avatar',
          },
        })
        .sort(sortQuery)
        .lean();

      // Format response
      const formattedCampaigns = campaigns.map((campaign: any) => ({
        _id: campaign._id,
        brandId: campaign.brandId?._id || campaign.brandId,
        brandName: campaign.brandId?.userId?.name || 'Unknown Brand',
        brandAvatar: campaign.brandId?.userId?.avatar || campaign.brandId?.logo || '',
        name: campaign.name,
        description: campaign.description,
        budget: campaign.budget,
        status: campaign.status,
        platforms: campaign.platforms,
        tags: campaign.tags || [],
        location: campaign.location || '',
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        publishDate: campaign.publishDate,
        deadline: campaign.deadline,
        requirements: campaign.requirements,
        attachments: campaign.attachments || [],
        isClosed: campaign.isClosed,
      }));

      res.status(200).json({
        success: true,
        data: {
          campaigns: formattedCampaigns,
          count: formattedCampaigns.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch campaigns',
        error: error.message,
      });
    }
  }

  /**
   * Get similar campaigns by matching tags
   * @route GET /api/v1/campaign/similar/:campaignId
   */
  static async getSimilarCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId } = req.params;
      const { limit = 3 } = req.query;

      // Find the current campaign to get its tags
      const currentCampaign = await Campaign.findById(campaignId).select('tags platforms budget');
      
      if (!currentCampaign) {
        res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
        return;
      }

      const limitNum = parseInt(limit as string, 10);
      const currentTags = currentCampaign.tags || [];
      const currentPlatforms = currentCampaign.platforms || [];
      const currentBudget = currentCampaign.budget || 0;

      // Build filter to find similar campaigns
      const filter: any = {
        _id: { $ne: campaignId }, // Exclude current campaign
        isClosed: false,
        status: 'active',
      };

      // Find campaigns with matching tags
      if (currentTags.length > 0) {
        filter.tags = { $in: currentTags };
      }

      // Fetch campaigns with matching tags
      const campaigns = await Campaign.find(filter)
        .populate({
          path: 'brandId',
          select: 'userId logo',
          populate: {
            path: 'userId',
            select: 'name email avatar',
          },
        })
        .sort({ createdAt: -1 })
        .limit(limitNum * 2) // Get more to filter and sort
        .lean();

      // Calculate similarity score and sort
      const scoredCampaigns = campaigns.map((campaign: any) => {
        let score = 0;
        const campaignTags = campaign.tags || [];
        const campaignPlatforms = campaign.platforms || [];
        const campaignBudget = campaign.budget || 0;

        // Score based on shared tags (10 points per tag)
        if (currentTags.length > 0 && campaignTags.length > 0) {
          const sharedTags = currentTags.filter((tag) => campaignTags.includes(tag));
          score += sharedTags.length * 10;
        }

        // Score based on shared platforms (5 points per platform)
        if (currentPlatforms.length > 0 && campaignPlatforms.length > 0) {
          const sharedPlatforms = currentPlatforms.filter((platform) => 
            campaignPlatforms.includes(platform)
          );
          score += sharedPlatforms.length * 5;
        }

        // Score based on budget similarity (3 points if within 50% range)
        if (currentBudget > 0 && campaignBudget > 0) {
          const budgetDiff = Math.abs(currentBudget - campaignBudget);
          const avgBudget = (currentBudget + campaignBudget) / 2;
          if (avgBudget > 0 && budgetDiff / avgBudget < 0.5) {
            score += 3;
          }
        }

        return { ...campaign, similarityScore: score };
      })
      .filter((camp: any) => camp.similarityScore > 0) // Only campaigns with some similarity
      .sort((a: any, b: any) => b.similarityScore - a.similarityScore)
      .slice(0, limitNum); // Get top N similar campaigns

      // Format response
      const formattedCampaigns = scoredCampaigns.map((campaign: any) => ({
        _id: campaign._id,
        brandId: campaign.brandId?._id || campaign.brandId,
        brandName: campaign.brandId?.userId?.name || 'Unknown Brand',
        brandAvatar: campaign.brandId?.userId?.avatar || campaign.brandId?.logo || '',
        name: campaign.name,
        description: campaign.description,
        budget: campaign.budget,
        status: campaign.status,
        platforms: campaign.platforms,
        tags: campaign.tags || [],
        location: campaign.location || '',
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        publishDate: campaign.publishDate,
        deadline: campaign.deadline,
        requirements: campaign.requirements,
        attachments: campaign.attachments || [],
        isClosed: campaign.isClosed,
      }));

      res.status(200).json({
        success: true,
        data: {
          campaigns: formattedCampaigns,
          count: formattedCampaigns.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch similar campaigns',
        error: error.message,
      });
    }
  }

  /**
   * Get campaigns by brand ID
   * @route GET /api/v1/campaign/brand/:brandId
   */
  static async getCampaignsByBrandId(req: Request, res: Response): Promise<void> {
    try {
      const { brandId } = req.params;
      const { status, sortBy } = req.query;

      // Verify brand exists
      const brand = await Brand.findById(brandId);
      if (!brand) {
        res.status(404).json({
          success: false,
          message: 'Brand not found',
        });
        return;
      }

      // Build filter query - ensure brandId is properly matched
      // MongoDB/Mongoose automatically converts string to ObjectId if valid
      const filter: any = { brandId };

      // Filter by status if provided
      if (status) {
        if (status === 'active') {
          filter.status = 'active';
        } else if (status === 'previous') {
          filter.status = { $in: ['closed', 'completed'] };
        } else {
          filter.status = status;
        }
      }

      // Build sort query
      let sortQuery: any = { createdAt: -1 }; // Default sort by date (newest first)
      if (sortBy === 'budget') {
        sortQuery = { budget: -1 }; // Sort by budget (highest first)
      } else if (sortBy === 'name') {
        sortQuery = { name: 1 }; // Sort by name (A-Z)
      } else if (sortBy === 'date') {
        sortQuery = { createdAt: -1 }; // Sort by date (newest first)
      }

      // Fetch campaigns
      const campaigns = await Campaign.find(filter)
        .sort(sortQuery)
        .lean();

      // Format response
      const formattedCampaigns = campaigns.map((campaign) => ({
        _id: campaign._id,
        name: campaign.name,
        description: campaign.description,
        budget: campaign.budget,
        status: campaign.status,
        platforms: campaign.platforms,
        tags: campaign.tags || [],
        location: campaign.location || '',
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        publishDate: campaign.publishDate,
        deadline: campaign.deadline,
        requirements: campaign.requirements,
        attachments: campaign.attachments || [],
        isClosed: campaign.isClosed,
      }));

      res.status(200).json({
        success: true,
        data: {
          campaigns: formattedCampaigns,
          count: formattedCampaigns.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch campaigns',
        error: error.message,
      });
    }
  }

  /**
   * Create a new campaign
   * @route POST /api/v1/campaign
   */
  static async createCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userId = req.user._id;
      const { name, description, budget, platforms, tags, location, publishDate, publishTime, deadline, requirements, attachments } = req.body;

      // Validate required fields
      if (!name || !description || budget === undefined || !platforms) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: name, description, budget, and platforms are required',
        });
        return;
      }

      // Validate name and description are not empty strings
      if (typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({
          success: false,
          message: 'Campaign name is required and cannot be empty',
        });
        return;
      }

      if (typeof description !== 'string' || description.trim() === '') {
        res.status(400).json({
          success: false,
          message: 'Campaign description is required and cannot be empty',
        });
        return;
      }

      // Validate budget
      const budgetNum = Number(budget);
      if (isNaN(budgetNum) || budgetNum < 0) {
        res.status(400).json({
          success: false,
          message: 'Budget must be a valid number greater than or equal to 0',
        });
        return;
      }

      // Validate platforms
      if (!Array.isArray(platforms) || platforms.length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one platform is required',
        });
        return;
      }

      // Validate platform values
      const validPlatforms: Platform[] = ['youtube', 'facebook', 'instagram', 'tiktok', 'x'];
      const invalidPlatforms = platforms.filter((p: string) => !validPlatforms.includes(p as Platform));
      if (invalidPlatforms.length > 0) {
        res.status(400).json({
          success: false,
          message: `Invalid platform(s): ${invalidPlatforms.join(', ')}. Valid platforms are: ${validPlatforms.join(', ')}`,
        });
        return;
      }

      // Find brand by userId
      const brand = await Brand.findOne({ userId });
      if (!brand) {
        res.status(403).json({
          success: false,
          message: 'Brand profile not found. Please complete your brand profile first.',
        });
        return;
      }

      // Prepare campaign data
      const campaignData: any = {
        brandId: brand._id,
        name: name.trim(),
        description: description.trim(),
        budget: budgetNum,
        platforms: platforms as Platform[],
        status: 'active', // Default status
        isClosed: false, // Default value
      };

      // Add optional fields if provided
      if (tags && Array.isArray(tags) && tags.length > 0) {
        campaignData.tags = tags.filter((tag: string) => tag && tag.trim() !== '').map((tag: string) => tag.trim());
      }

      if (location && typeof location === 'string' && location.trim() !== '') {
        campaignData.location = location.trim();
      }

      if (publishDate) {
        campaignData.publishDate = new Date(publishDate);
      }

      if (publishTime && typeof publishTime === 'string' && publishTime.trim() !== '') {
        campaignData.publishTime = publishTime.trim();
      }

      if (deadline) {
        campaignData.deadline = new Date(deadline);
      }

      if (requirements && typeof requirements === 'string' && requirements.trim() !== '') {
        campaignData.requirements = requirements.trim();
      }

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        campaignData.attachments = attachments.filter((url: string) => url && typeof url === 'string');
      }

      // Create campaign
      const campaign = new Campaign(campaignData);
      await campaign.save();

      // Format response
      const formattedCampaign = {
        _id: campaign._id,
        brandId: campaign.brandId,
        name: campaign.name,
        description: campaign.description,
        budget: campaign.budget,
        status: campaign.status,
        platforms: campaign.platforms,
        tags: campaign.tags || [],
        location: campaign.location || '',
        publishDate: campaign.publishDate,
        publishTime: campaign.publishTime,
        deadline: campaign.deadline,
        requirements: campaign.requirements,
        attachments: campaign.attachments || [],
        isClosed: campaign.isClosed,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      };

      res.status(201).json({
        success: true,
        message: 'Campaign created successfully',
        data: {
          campaign: formattedCampaign,
        },
      });
    } catch (error: any) {
      
      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => err.message);
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create campaign',
        error: error.message,
      });
    }
  }

  /**
   * Get campaign by ID
   * @route GET /api/v1/campaign/:campaignId
   */
  static async getCampaignById(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(campaignId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid campaign ID format',
        });
        return;
      }

      // Fetch campaign with brand information populated
      const campaign = await Campaign.findById(campaignId)
        .populate({
          path: 'brandId',
          select: 'userId logo',
          populate: {
            path: 'userId',
            select: 'name email avatar',
          },
        })
        .lean();

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
        return;
      }

      // Format response with brand information
      const formattedCampaign = {
        _id: campaign._id,
        brandId: (campaign.brandId as any)?._id || campaign.brandId,
        brandName: (campaign.brandId as any)?.userId?.name || 'Unknown Brand',
        brandAvatar: (campaign.brandId as any)?.userId?.avatar || (campaign.brandId as any)?.logo || '',
        name: campaign.name,
        description: campaign.description,
        budget: campaign.budget,
        status: campaign.status,
        platforms: campaign.platforms,
        tags: campaign.tags || [],
        location: campaign.location || '',
        publishDate: campaign.publishDate,
        publishTime: campaign.publishTime,
        deadline: campaign.deadline,
        requirements: campaign.requirements,
        attachments: campaign.attachments || [],
        isClosed: campaign.isClosed,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      };

      res.status(200).json({
        success: true,
        data: {
          campaign: formattedCampaign,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch campaign',
        error: error.message,
      });
    }
  }

  /**
   * Update campaign
   * @route PUT /api/v1/campaign/:campaignId
   */
  static async updateCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { campaignId } = req.params;
      const userId = req.user._id;
      const { name, description, budget, platforms, tags, location, publishDate, publishTime, deadline, requirements, attachments, status, isClosed } = req.body;

      if (!mongoose.Types.ObjectId.isValid(campaignId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid campaign ID format',
        });
        return;
      }

      // Find campaign
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
        return;
      }

      // Verify user owns the brand that owns this campaign
      const brand = await Brand.findOne({ userId });
      if (!brand || campaign.brandId.toString() !== brand._id.toString()) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to update this campaign',
        });
        return;
      }

      // Validate and update fields
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') {
          res.status(400).json({
            success: false,
            message: 'Campaign name cannot be empty',
          });
          return;
        }
        campaign.name = name.trim();
      }

      if (description !== undefined) {
        if (typeof description !== 'string' || description.trim() === '') {
          res.status(400).json({
            success: false,
            message: 'Campaign description cannot be empty',
          });
          return;
        }
        campaign.description = description.trim();
      }

      if (budget !== undefined) {
        const budgetNum = Number(budget);
        if (isNaN(budgetNum) || budgetNum < 0) {
          res.status(400).json({
            success: false,
            message: 'Budget must be a valid number greater than or equal to 0',
          });
          return;
        }
        campaign.budget = budgetNum;
      }

      if (platforms !== undefined) {
        if (!Array.isArray(platforms) || platforms.length === 0) {
          res.status(400).json({
            success: false,
            message: 'At least one platform is required',
          });
          return;
        }

        const validPlatforms: Platform[] = ['youtube', 'facebook', 'instagram', 'tiktok', 'x'];
        const invalidPlatforms = platforms.filter((p: string) => !validPlatforms.includes(p as Platform));
        if (invalidPlatforms.length > 0) {
          res.status(400).json({
            success: false,
            message: `Invalid platform(s): ${invalidPlatforms.join(', ')}. Valid platforms are: ${validPlatforms.join(', ')}`,
          });
          return;
        }
        campaign.platforms = platforms as Platform[];
      }

      if (tags !== undefined) {
        if (Array.isArray(tags)) {
          campaign.tags = tags.filter((tag: string) => tag && tag.trim() !== '').map((tag: string) => tag.trim());
        }
      }

      if (location !== undefined) {
        if (location === null || location === '') {
          campaign.location = undefined;
        } else if (typeof location === 'string') {
          campaign.location = location.trim();
        }
      }

      if (publishDate !== undefined) {
        campaign.publishDate = publishDate ? new Date(publishDate) : undefined;
      }

      if (publishTime !== undefined) {
        campaign.publishTime = publishTime && typeof publishTime === 'string' ? publishTime.trim() : undefined;
      }

      if (deadline !== undefined) {
        campaign.deadline = deadline ? new Date(deadline) : undefined;
      }

      if (requirements !== undefined) {
        if (requirements === null || requirements === '') {
          campaign.requirements = undefined;
        } else if (typeof requirements === 'string') {
          campaign.requirements = requirements.trim();
        }
      }

      if (attachments !== undefined) {
        if (Array.isArray(attachments)) {
          campaign.attachments = attachments.filter((url: string) => url && typeof url === 'string');
        }
      }

      if (status !== undefined) {
        const validStatuses = ['draft', 'active', 'closed', 'completed'];
        if (!validStatuses.includes(status)) {
          res.status(400).json({
            success: false,
            message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
          });
          return;
        }
        campaign.status = status;
      }

      if (isClosed !== undefined) {
        campaign.isClosed = Boolean(isClosed);
      }

      await campaign.save();

      // Format response
      const formattedCampaign = {
        _id: campaign._id,
        brandId: campaign.brandId,
        name: campaign.name,
        description: campaign.description,
        budget: campaign.budget,
        status: campaign.status,
        platforms: campaign.platforms,
        tags: campaign.tags || [],
        location: campaign.location || '',
        publishDate: campaign.publishDate,
        publishTime: campaign.publishTime,
        deadline: campaign.deadline,
        requirements: campaign.requirements,
        attachments: campaign.attachments || [],
        isClosed: campaign.isClosed,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      };

      res.status(200).json({
        success: true,
        message: 'Campaign updated successfully',
        data: {
          campaign: formattedCampaign,
        },
      });
    } catch (error: any) {
      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => err.message);
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update campaign',
        error: error.message,
      });
    }
  }

  /**
   * Delete campaign
   * @route DELETE /api/v1/campaign/:campaignId
   */
  static async deleteCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { campaignId } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(campaignId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid campaign ID format',
        });
        return;
      }

      // Find campaign
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
        return;
      }

      // Verify user owns the brand that owns this campaign
      const brand = await Brand.findOne({ userId });
      if (!brand || campaign.brandId.toString() !== brand._id.toString()) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this campaign',
        });
        return;
      }

      // Delete campaign
      await Campaign.findByIdAndDelete(campaignId);

      res.status(200).json({
        success: true,
        message: 'Campaign deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete campaign',
        error: error.message,
      });
    }
  }
}

