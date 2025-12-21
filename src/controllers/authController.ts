import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { generateToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import storageService from '../services/storageService';
import path from 'path';

export class AuthController {
  /**
   * Sign up a new user
   * POST /api/v1/auth/signup
   */
  static async signup(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, userType, avatar } = req.body;

      // Validation
      if (!email || !password || !name || !userType) {
        res.status(400).json({
          success: false,
          message: 'Please provide email, password, name, and userType',
        });
        return;
      }

      if (!['brand', 'influencer'].includes(userType)) {
        res.status(400).json({
          success: false,
          message: 'userType must be either "brand" or "influencer"',
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
        return;
      }

      // Create user
      const user = await AuthService.signupUser({
        email,
        password,
        name,
        userType,
        avatar,
      });

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        userType: user.userType,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            userType: user.userType,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
          },
          token,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during signup';
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Please provide email and password',
        });
        return;
      }

      // Login user
      const user = await AuthService.loginUser({ email, password });

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        userType: user.userType,
      });

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            userType: user.userType,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
          },
          token,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid email or password';
      res.status(401).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Get current authenticated user
   * GET /api/v1/auth/me
   */
  static async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Get user with profile
      const user = await AuthService.getUserById(req.user._id.toString());

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            userType: user.userType,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
            profile: (user as any).profile || null,
          },
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Update current authenticated user
   * PUT /api/v1/auth/me
   */
  static async updateMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      const { name, avatar } = req.body;

      // Get user as Mongoose document (not plain object) so we can save it
      const user = await User.findById(req.user._id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Handle avatar file upload if file is present
      if (req.file) {
        try {
          // Delete old avatar if it exists and is a Google Drive URL
          if (user.avatar && user.avatar.includes('drive.google.com')) {
            try {
              await storageService.deleteFile(user.avatar);
            } catch (deleteError) {
              // Log but don't fail if deletion fails
              console.warn('Failed to delete old avatar:', deleteError);
            }
          }

          // Generate unique filename
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(req.file.originalname);
          const name = path.basename(req.file.originalname, ext);
          const filename = `avatar-${uniqueSuffix}${ext}`;

          // Upload to Google Drive - use influencer-profile folder for avatars
          const avatarUrl = await storageService.uploadFile({
            buffer: req.file.buffer,
            filename: filename,
            mimetype: req.file.mimetype,
            folderType: 'influencer-profile', // Using same folder as profile images
          });

          user.avatar = avatarUrl;
        } catch (uploadError: any) {
          res.status(500).json({
            success: false,
            message: 'Failed to upload avatar to Google Drive',
            error: uploadError.message,
          });
          return;
        }
      } else if (avatar !== undefined) {
        // If avatar is provided as a string (URL), use it directly
        user.avatar = avatar;
      }

      // Update name field
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim() === '') {
          res.status(400).json({
            success: false,
            message: 'Name cannot be empty',
          });
          return;
        }
        user.name = name.trim();
      }

      await user.save();

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            userType: user.userType,
            avatar: user.avatar,
            isEmailVerified: user.isEmailVerified,
            profile: (user as any).profile || null,
          },
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  /**
   * Upload user avatar
   * POST /api/v1/auth/upload-avatar
   */
  static async uploadAvatar(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
        return;
      }

      // Get user
      const user = await User.findById(req.user._id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Delete old avatar if it exists
      if (user.avatar) {
        try {
          await storageService.deleteFile(user.avatar);
        } catch (deleteError) {
          console.warn('Failed to delete old avatar:', deleteError);
        }
      }

      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname);
      const name = path.basename(req.file.originalname, ext);
      const filename = `avatar-${uniqueSuffix}${ext}`;

      // Upload to storage (Cloudinary with Drive fallback)
      const avatarUrl = await storageService.uploadFile({
        buffer: req.file.buffer,
        filename: filename,
        mimetype: req.file.mimetype,
        folderType: 'influencer-profile', // Using same folder as profile images
      });

      // Update user avatar
      user.avatar = avatarUrl;
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          avatarUrl,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to upload avatar',
        error: error.message,
      });
    }
  }
}

