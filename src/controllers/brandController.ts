import { Request, Response } from 'express';
import { Brand } from '../models/Brand';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import storageService from '../services/storageService';
import path from 'path';

export class BrandController {
  /**
   * Create a new brand profile
   * @route POST /api/v1/brand
   */
  static async createBrand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { description, website, location, logo, tags } = req.body;

      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userId = req.user._id;

      // Check if brand already exists for this user
      const existingBrand = await Brand.findOne({ userId });
      if (existingBrand) {
        res.status(400).json({
          success: false,
          message: 'Brand profile already exists for this user',
        });
        return;
      }

      // Create new brand
      const brand = new Brand({
        userId,
        description,
        website,
        location,
        logo,
        tags: tags || [],
      });

      await brand.save();

      res.status(201).json({
        success: true,
        message: 'Brand profile created successfully',
        data: {
          brand,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to create brand profile',
        error: error.message,
      });
    }
  }

  /**
   * Get all brands with pagination and filtering
   * @route GET /api/v1/brand
   */
  static async getAllBrands(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        tags,
        location,
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build filter query
      const filter: any = {};

      if (search) {
        filter.$or = [
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      if (tags) {
        const tagArray = typeof tags === 'string' ? tags.split(',') : tags;
        filter.tags = { $in: tagArray };
      }

      if (location) {
        filter.location = { $regex: location, $options: 'i' };
      }

      // Get total count
      const total = await Brand.countDocuments(filter);

      // Get paginated brands
      const brands = await Brand.find(filter)
        .populate('userId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      res.status(200).json({
        success: true,
        data: {
          brands,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch brands',
        error: error.message,
      });
    }
  }

  /**
   * Get brand profile by brand ID (MongoDB _id)
   * @route GET /api/v1/brand/id/:brandId
   */
  static async getBrandById(req: Request, res: Response): Promise<void> {
    try {
      const { brandId } = req.params;

      // Find brand by _id
      const brand = await Brand.findById(brandId);

      if (!brand) {
        res.status(404).json({
          success: false,
          message: 'Brand not found',
        });
        return;
      }

      // Populate user information
      const user = await User.findById(brand.userId).select('name email avatar');

      // Format response
      const response = {
        success: true,
        data: {
          brand: {
            _id: brand._id,
            userId: brand.userId,
            description: brand.description,
            website: brand.website,
            location: brand.location,
            logo: brand.logo,
            tags: brand.tags,
            createdAt: brand.createdAt,
            updatedAt: brand.updatedAt,
            user: user
              ? {
                  name: user.name,
                  email: user.email,
                  avatar: user.avatar,
                }
              : undefined,
          },
        },
      };

      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch brand profile',
        error: error.message,
      });
    }
  }

  /**
   * Get brand profile by user ID
   * @route GET /api/v1/brand/:userId
   */
  static async getBrandByUserId(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // Find brand by userId
      const brand = await Brand.findOne({ userId });

      if (!brand) {
        res.status(404).json({
          success: false,
          message: 'Brand not found',
        });
        return;
      }

      // Populate user information
      const user = await User.findById(userId).select('name email avatar');

      // Format response
      const response = {
        success: true,
        data: {
          brand: {
            _id: brand._id,
            userId: brand.userId,
            description: brand.description,
            website: brand.website,
            location: brand.location,
            logo: brand.logo,
            tags: brand.tags,
            createdAt: brand.createdAt,
            updatedAt: brand.updatedAt,
            user: user
              ? {
                  name: user.name,
                  email: user.email,
                  avatar: user.avatar,
                }
              : undefined,
          },
        },
      };

      res.status(200).json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch brand profile',
        error: error.message,
      });
    }
  }

  /**
   * Update brand profile
   * @route PUT /api/v1/brand/:userId
   */
  static async updateBrand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const updateData = req.body;

      // Check if authenticated user matches the userId
      if (req.user && req.user._id.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized to update this brand profile',
        });
        return;
      }

      // Find brand by userId
      let brand = await Brand.findOne({ userId });

      if (!brand) {
        res.status(404).json({
          success: false,
          message: 'Brand not found',
        });
        return;
      }

      // Handle logo upload if file is present
      if (req.file) {
        try {
          // Delete old logo if it exists and is a Google Drive URL
          if (brand.logo && brand.logo.includes('drive.google.com')) {
            try {
              await storageService.deleteFile(brand.logo);
            } catch (deleteError) {
              // Log but don't fail if deletion fails
              console.warn('Failed to delete old logo:', deleteError);
            }
          }

          // Generate unique filename
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(req.file.originalname);
          const name = path.basename(req.file.originalname, ext);
          const filename = `${name}-${uniqueSuffix}${ext}`;

          // Upload to Google Drive
          const logoUrl = await storageService.uploadFile({
            buffer: req.file.buffer,
            filename: filename,
            mimetype: req.file.mimetype,
            folderType: 'brand',
          });

          updateData.logo = logoUrl;
        } catch (uploadError: any) {
          res.status(500).json({
            success: false,
            message: 'Failed to upload logo to Google Drive',
            error: uploadError.message,
          });
          return;
        }
      }

      // Update brand fields
      if (updateData.description !== undefined) brand.description = updateData.description;
      if (updateData.website !== undefined) brand.website = updateData.website;
      if (updateData.location) brand.location = updateData.location;
      if (updateData.logo) brand.logo = updateData.logo;
      if (updateData.tags) {
        // Handle tags - if it's a JSON string (from FormData), parse it; otherwise use as is
        if (typeof updateData.tags === 'string') {
          try {
            brand.tags = JSON.parse(updateData.tags);
          } catch (e) {
            // If parsing fails, treat as single tag
            brand.tags = [updateData.tags];
          }
        } else {
          brand.tags = updateData.tags;
        }
      }

      await brand.save();

      res.status(200).json({
        success: true,
        message: 'Brand profile updated successfully',
        data: {
          brand,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to update brand profile',
        error: error.message,
      });
    }
  }

  /**
   * Upload brand logo
   * @route POST /api/v1/brand/upload-logo
   */
  static async uploadLogo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
        return;
      }

      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname);
      const name = path.basename(req.file.originalname, ext);
      const filename = `${name}-${uniqueSuffix}${ext}`;

      // Upload to Google Drive
      const logoUrl = await storageService.uploadFile({
        buffer: req.file.buffer,
        filename: filename,
        mimetype: req.file.mimetype,
        folderType: 'brand',
      });

      res.status(200).json({
        success: true,
        message: 'Logo uploaded successfully',
        data: {
          logoUrl,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to upload logo',
        error: error.message,
      });
    }
  }

  /**
   * Delete brand profile
   * @route DELETE /api/v1/brand/:userId
   */
  static async deleteBrand(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // Check if authenticated user matches the userId
      if (req.user && req.user._id.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized to delete this brand profile',
        });
        return;
      }

      // Find and delete brand
      const brand = await Brand.findOneAndDelete({ userId });

      if (!brand) {
        res.status(404).json({
          success: false,
          message: 'Brand not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Brand profile deleted successfully',
        data: {
          brand,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete brand profile',
        error: error.message,
      });
    }
  }
}
