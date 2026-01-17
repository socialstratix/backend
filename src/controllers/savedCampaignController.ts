import { Request, Response } from 'express';
import { SavedCampaign } from '../models/SavedCampaign';
import { Campaign } from '../models/Campaign';
import { Influencer } from '../models/Influencer';
import { AuthRequest } from '../middleware/auth';

export class SavedCampaignController {
  /**
   * Save a campaign
   * @route POST /api/v1/saved-campaigns/:campaignId
   */
  static async saveCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Check if user is an influencer
      if (req.user.userType !== 'influencer') {
        res.status(403).json({
          success: false,
          message: 'Only influencers can save campaigns',
        });
        return;
      }

      const { campaignId } = req.params;

      // Verify campaign exists
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
        return;
      }

      // Get influencer profile
      const influencer = await Influencer.findOne({ userId: req.user._id });
      if (!influencer) {
        res.status(404).json({
          success: false,
          message: 'Influencer profile not found',
        });
        return;
      }

      // Check if already saved
      const existingSave = await SavedCampaign.findOne({
        influencerId: influencer._id,
        campaignId,
      });

      if (existingSave) {
        res.status(200).json({
          success: true,
          message: 'Campaign already saved',
          data: {
            savedCampaign: existingSave,
          },
        });
        return;
      }

      // Create saved campaign
      const savedCampaign = new SavedCampaign({
        influencerId: influencer._id,
        campaignId,
        savedAt: new Date(),
      });

      await savedCampaign.save();

      res.status(201).json({
        success: true,
        message: 'Campaign saved successfully',
        data: {
          savedCampaign,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to save campaign',
        error: error.message,
      });
    }
  }

  /**
   * Unsave a campaign
   * @route DELETE /api/v1/saved-campaigns/:campaignId
   */
  static async unsaveCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Check if user is an influencer
      if (req.user.userType !== 'influencer') {
        res.status(403).json({
          success: false,
          message: 'Only influencers can unsave campaigns',
        });
        return;
      }

      const { campaignId } = req.params;

      // Get influencer profile
      const influencer = await Influencer.findOne({ userId: req.user._id });
      if (!influencer) {
        res.status(404).json({
          success: false,
          message: 'Influencer profile not found',
        });
        return;
      }

      // Delete saved campaign
      const result = await SavedCampaign.findOneAndDelete({
        influencerId: influencer._id,
        campaignId,
      });

      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Saved campaign not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Campaign unsaved successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to unsave campaign',
        error: error.message,
      });
    }
  }

  /**
   * Get all saved campaigns for the logged-in influencer
   * @route GET /api/v1/saved-campaigns
   */
  static async getSavedCampaigns(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Check if user is an influencer
      if (req.user.userType !== 'influencer') {
        res.status(403).json({
          success: false,
          message: 'Only influencers can view saved campaigns',
        });
        return;
      }

      const { sortBy, sortOrder } = req.query;

      // Get influencer profile
      const influencer = await Influencer.findOne({ userId: req.user._id });
      if (!influencer) {
        res.status(404).json({
          success: false,
          message: 'Influencer profile not found',
        });
        return;
      }

      // Build sort query
      let sortQuery: any = { savedAt: -1 }; // Default sort by save date (newest first)

      // Fetch saved campaigns
      const savedCampaigns = await SavedCampaign.find({
        influencerId: influencer._id,
      })
        .sort(sortQuery)
        .lean();

      // Get campaign IDs
      const campaignIds = savedCampaigns.map((sc) => sc.campaignId);

      // Determine sort order (asc = 1, desc = -1)
      const order = sortOrder === 'asc' ? 1 : -1;
      
      // Default sort orders based on field
      const defaultOrder: Record<string, number> = {
        date: -1,    // newest first
        budget: -1,  // highest first
        name: 1,     // A-Z
      };

      // Build sort query for campaigns
      let campaignSortQuery: any = { createdAt: defaultOrder.date };
      if (sortBy === 'budget') {
        campaignSortQuery = { budget: sortOrder ? order : defaultOrder.budget };
      } else if (sortBy === 'name') {
        campaignSortQuery = { name: sortOrder ? order : defaultOrder.name };
      } else if (sortBy === 'date') {
        campaignSortQuery = { createdAt: sortOrder ? order : defaultOrder.date };
      }

      // Fetch full campaign details with case-insensitive sorting for name field
      let query = Campaign.find({
        _id: { $in: campaignIds },
      });
      
      if (sortBy === 'name') {
        query = query.collation({ locale: 'en', strength: 2 });
      }
      
      const campaigns = await query
        .populate({
          path: 'brandId',
          select: 'userId logo',
          populate: {
            path: 'userId',
            select: 'name email avatar',
          },
        })
        .sort(campaignSortQuery)
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
        message: 'Failed to fetch saved campaigns',
        error: error.message,
      });
    }
  }

  /**
   * Check if a campaign is saved
   * @route GET /api/v1/saved-campaigns/check/:campaignId
   */
  static async checkIfSaved(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Check if user is an influencer
      if (req.user.userType !== 'influencer') {
        res.status(403).json({
          success: false,
          message: 'Only influencers can check saved status',
        });
        return;
      }

      const { campaignId } = req.params;

      // Get influencer profile
      const influencer = await Influencer.findOne({ userId: req.user._id });
      if (!influencer) {
        res.status(404).json({
          success: false,
          message: 'Influencer profile not found',
        });
        return;
      }

      // Check if saved
      const savedCampaign = await SavedCampaign.findOne({
        influencerId: influencer._id,
        campaignId,
      });

      res.status(200).json({
        success: true,
        data: {
          isSaved: !!savedCampaign,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to check saved status',
        error: error.message,
      });
    }
  }

  /**
   * Get all saved campaign IDs for the logged-in influencer
   * @route GET /api/v1/saved-campaigns/ids
   */
  static async getSavedCampaignIds(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Check if user is an influencer
      if (req.user.userType !== 'influencer') {
        res.status(403).json({
          success: false,
          message: 'Only influencers can view saved campaigns',
        });
        return;
      }

      // Get influencer profile
      const influencer = await Influencer.findOne({ userId: req.user._id });
      if (!influencer) {
        res.status(404).json({
          success: false,
          message: 'Influencer profile not found',
        });
        return;
      }

      // Fetch saved campaign IDs
      const savedCampaigns = await SavedCampaign.find({
        influencerId: influencer._id,
      })
        .select('campaignId')
        .lean();

      const campaignIds = savedCampaigns.map((sc) => sc.campaignId.toString());

      res.status(200).json({
        success: true,
        data: {
          campaignIds,
          count: campaignIds.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch saved campaign IDs',
        error: error.message,
      });
    }
  }
}

