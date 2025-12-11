import { Request, Response } from 'express';
import { OnboardingService } from '../services/onboardingService';

export class OnboardingController {
  /**
   * Complete influencer onboarding
   * POST /api/v1/onboarding/influencer
   */
  static async completeInfluencerOnboarding(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Validate user is an influencer
      if (req.user.userType !== 'influencer') {
        res.status(403).json({
          success: false,
          message: 'Only influencers can complete influencer onboarding',
        });
        return;
      }

      const onboardingData = req.body;

      // Complete onboarding
      const result = await OnboardingService.completeInfluencerOnboarding(
        req.user._id.toString(),
        onboardingData
      );

      res.status(200).json({
        success: true,
        message: 'Influencer onboarding completed successfully',
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during onboarding';
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Complete brand onboarding
   * POST /api/v1/onboarding/brand
   */
  static async completeBrandOnboarding(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Validate user is a brand
      if (req.user.userType !== 'brand') {
        res.status(403).json({
          success: false,
          message: 'Only brands can complete brand onboarding',
        });
        return;
      }

      const onboardingData = req.body;

      // Complete onboarding
      const result = await OnboardingService.completeBrandOnboarding(
        req.user._id.toString(),
        onboardingData
      );

      res.status(200).json({
        success: true,
        message: 'Brand onboarding completed successfully',
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during onboarding';
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  }
}

