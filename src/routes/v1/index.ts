import { Router } from 'express';
import authRoutes from './auth';
import onboardingRoutes from './onboarding';
import brandRoutes from './brand';
import campaignRoutes from './campaign';
import influencerRoutes from './influencer';
import savedCampaignRoutes from './savedCampaign';
import conversationRoutes from './conversation.routes';
import messageRoutes from './message.routes';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/brand', brandRoutes);
router.use('/campaign', campaignRoutes);
router.use('/influencer', influencerRoutes);
router.use('/saved-campaigns', savedCampaignRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);

export default router;

