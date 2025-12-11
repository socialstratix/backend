import { Router } from 'express';
import authRoutes from './auth';
import onboardingRoutes from './onboarding';
import brandRoutes from './brand';
import campaignRoutes from './campaign';
import influencerRoutes from './influencer';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/brand', brandRoutes);
router.use('/campaign', campaignRoutes);
router.use('/influencer', influencerRoutes);

export default router;

