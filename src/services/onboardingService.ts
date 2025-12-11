import { Influencer } from '../models/Influencer';
import { Brand } from '../models/Brand';
import { SocialMediaProfile } from '../models/SocialMediaProfile';
import { ILocation, Platform } from '../types';

export interface SocialMediaData {
  platform: Platform;
  username: string;
  profileUrl?: string;
  followers?: number;
  following?: number;
  posts?: number;
}

export interface InfluencerOnboardingData {
  location?: {
    country?: string;
    countryCode?: string;
    mobile?: string;
    state?: string;
    pincode?: string;
    city?: string;
    address?: string;
  };
  description?: string;
  tags?: string[];
  socialMedia?: SocialMediaData[];
  profileImage?: string;
}

export interface BrandOnboardingData {
  description?: string;
  website?: string;
  location?: ILocation;
  logo?: string;
  tags?: string[];
}

export class OnboardingService {
  /**
   * Complete influencer onboarding
   */
  static async completeInfluencerOnboarding(
    userId: string,
    data: InfluencerOnboardingData
  ): Promise<any> {
    // Find or create influencer profile
    let influencer = await Influencer.findOne({ userId });

    if (!influencer) {
      // Create new influencer profile
      influencer = new Influencer({
        userId,
        isTopCreator: false,
        hasVerifiedPayment: false,
      });
    }

    // Update influencer profile
    if (data.location) {
      influencer.location = {
        country: data.location.country,
        state: data.location.state,
        pincode: data.location.pincode,
        city: data.location.city,
        address: data.location.address,
      };
      influencer.mobile = data.location.mobile;
      influencer.countryCode = data.location.countryCode;
    }

    if (data.description) {
      influencer.description = data.description;
    }

    if (data.tags && data.tags.length > 0) {
      influencer.tags = data.tags;
    }

    if (data.profileImage) {
      influencer.profileImage = data.profileImage;
    }

    await influencer.save();

    // Create or update social media profiles
    if (data.socialMedia && data.socialMedia.length > 0) {
      for (const socialData of data.socialMedia) {
        if (socialData.username) {
          await SocialMediaProfile.findOneAndUpdate(
            {
              influencerId: influencer._id,
              platform: socialData.platform,
            },
            {
              influencerId: influencer._id,
              platform: socialData.platform,
              username: socialData.username,
              profileUrl: socialData.profileUrl,
              followers: socialData.followers || 0,
              following: socialData.following || 0,
              posts: socialData.posts || 0,
              isVerified: false,
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    // Get updated influencer with social media profiles
    const socialMediaProfiles = await SocialMediaProfile.find({
      influencerId: influencer._id,
    });

    return {
      influencer,
      socialMediaProfiles,
    };
  }

  /**
   * Complete brand onboarding
   */
  static async completeBrandOnboarding(
    userId: string,
    data: BrandOnboardingData
  ): Promise<any> {
    // Find or create brand profile
    let brand = await Brand.findOne({ userId });

    if (!brand) {
      brand = new Brand({
        userId,
      });
    }

    // Update brand profile
    if (data.description) {
      brand.description = data.description;
    }

    if (data.website) {
      brand.website = data.website;
    }

    if (data.location) {
      brand.location = data.location;
    }

    if (data.logo) {
      brand.logo = data.logo;
    }

    if (data.tags && data.tags.length > 0) {
      brand.tags = data.tags;
    }

    await brand.save();

    return {
      brand,
    };
  }
}

