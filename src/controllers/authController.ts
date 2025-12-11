import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { generateToken } from '../utils/jwt';

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
}

