import { Router } from 'express';
import { CampaignController } from '../../controllers/campaignController';
import { authenticate } from '../../middleware/auth';

const router = Router();

/**
 * @route   POST /api/v1/campaign
 * @desc    Create a new campaign
 * @access  Private (Brand only)
 */
router.post('/', authenticate, CampaignController.createCampaign);

/**
 * @route   GET /api/v1/campaign
 * @desc    Get all campaigns
 * @access  Public
 * @query   status - Filter by status (active, previous, draft, closed, completed)
 * @query   sortBy - Sort campaigns (date, budget, name) - Default: date
 */
router.get('/', CampaignController.getAllCampaigns);

/**
 * @route   GET /api/v1/campaign/brand/:brandId
 * @desc    Get campaigns by brand ID
 * @access  Public
 * @query   status - Filter by status (active, previous, draft, closed, completed)
 * @query   sortBy - Sort campaigns (date, budget, name) - Default: date
 */
router.get('/brand/:brandId', CampaignController.getCampaignsByBrandId);

/**
 * @route   GET /api/v1/campaign/similar/:campaignId
 * @desc    Get similar campaigns by matching tags
 * @access  Public
 * @query   limit - Number of similar campaigns to return (default: 3)
 */
router.get('/similar/:campaignId', CampaignController.getSimilarCampaigns);

/**
 * @route   GET /api/v1/campaign/:campaignId
 * @desc    Get campaign by ID
 * @access  Public
 */
router.get('/:campaignId', CampaignController.getCampaignById);

/**
 * @route   PUT /api/v1/campaign/:campaignId
 * @desc    Update campaign
 * @access  Private (Brand only)
 */
router.put('/:campaignId', authenticate, CampaignController.updateCampaign);

/**
 * @route   DELETE /api/v1/campaign/:campaignId
 * @desc    Delete campaign
 * @access  Private (Brand only)
 */
router.delete('/:campaignId', authenticate, CampaignController.deleteCampaign);

/**
 * @route   POST /api/v1/campaign/:campaignId/apply
 * @desc    Apply to a campaign (Influencer only)
 * @access  Private (Influencer only)
 */
router.post('/:campaignId/apply', authenticate, CampaignController.applyToCampaign);

export default router;

