import { Router } from 'express';
import { OnboardingController } from '../../controllers/onboardingController';
import { authenticate } from '../../middleware/auth';

const router = Router();

/**
 * @route   POST /api/v1/onboarding/influencer
 * @desc    Complete influencer onboarding
 * @access  Private (Influencer only)
 */
router.post('/influencer', authenticate, OnboardingController.completeInfluencerOnboarding);

/**
 * @route   POST /api/v1/onboarding/brand
 * @desc    Complete brand onboarding
 * @access  Private (Brand only)
 */
router.post('/brand', authenticate, OnboardingController.completeBrandOnboarding);

export default router;

