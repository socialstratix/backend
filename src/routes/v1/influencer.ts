import { Router } from 'express';
import { InfluencerController } from '../../controllers/influencerController';
import { authenticate } from '../../middleware/auth';
import { uploadInfluencerImages } from '../../middleware/upload';

const router = Router();

/**
 * @route   GET /api/v1/influencer
 * @desc    Get all influencers with pagination and filtering
 * @access  Public
 */
router.get('/', InfluencerController.getAllInfluencers);

/**
 * @route   GET /api/v1/influencer/id/:influencerId
 * @desc    Get influencer by MongoDB _id
 * @access  Public
 */
router.get('/id/:influencerId', InfluencerController.getInfluencerById);

/**
 * @route   GET /api/v1/influencer/:influencerId/followers
 * @desc    Get influencer followers data (dummy API for demo)
 * @access  Public
 */
router.get('/:influencerId/followers', InfluencerController.getInfluencerFollowers);

/**
 * @route   GET /api/v1/influencer/:influencerId/shorts
 * @desc    Get influencer shorts data (dummy API for demo)
 * @access  Public
 */
router.get('/:influencerId/shorts', InfluencerController.getInfluencerShorts);

/**
 * @route   GET /api/v1/influencer/:influencerId/videos
 * @desc    Get influencer videos data (dummy API for demo)
 * @access  Public
 */
router.get('/:influencerId/videos', InfluencerController.getInfluencerVideos);

/**
 * @route   GET /api/v1/influencer/:userId
 * @desc    Get influencer by user ID
 * @access  Public
 */
router.get('/:userId', InfluencerController.getInfluencerByUserId);

/**
 * @route   PUT /api/v1/influencer/:userId
 * @desc    Update influencer profile
 * @access  Private (Influencer only)
 */
router.put('/:userId', authenticate, uploadInfluencerImages, InfluencerController.updateInfluencer);

export default router;

