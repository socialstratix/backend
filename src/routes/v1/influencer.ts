import { Router } from 'express';
import { InfluencerController } from '../../controllers/influencerController';

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
 * @route   GET /api/v1/influencer/:userId
 * @desc    Get influencer by user ID
 * @access  Public
 */
router.get('/:userId', InfluencerController.getInfluencerByUserId);

export default router;

