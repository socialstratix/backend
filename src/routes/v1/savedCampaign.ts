import { Router } from 'express';
import { SavedCampaignController } from '../../controllers/savedCampaignController';
import { authenticate } from '../../middleware/auth';

const router = Router();

/**
 * @route   GET /api/v1/saved-campaigns/ids
 * @desc    Get all saved campaign IDs for the logged-in influencer
 * @access  Private (Influencer only)
 */
router.get('/ids', authenticate, SavedCampaignController.getSavedCampaignIds);

/**
 * @route   GET /api/v1/saved-campaigns/check/:campaignId
 * @desc    Check if a campaign is saved
 * @access  Private (Influencer only)
 */
router.get('/check/:campaignId', authenticate, SavedCampaignController.checkIfSaved);

/**
 * @route   GET /api/v1/saved-campaigns
 * @desc    Get all saved campaigns for the logged-in influencer
 * @access  Private (Influencer only)
 * @query   sortBy - Sort campaigns (date, budget, name) - Default: date
 */
router.get('/', authenticate, SavedCampaignController.getSavedCampaigns);

/**
 * @route   POST /api/v1/saved-campaigns/:campaignId
 * @desc    Save a campaign
 * @access  Private (Influencer only)
 */
router.post('/:campaignId', authenticate, SavedCampaignController.saveCampaign);

/**
 * @route   DELETE /api/v1/saved-campaigns/:campaignId
 * @desc    Unsave a campaign
 * @access  Private (Influencer only)
 */
router.delete('/:campaignId', authenticate, SavedCampaignController.unsaveCampaign);

export default router;

