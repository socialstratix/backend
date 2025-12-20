import { Router } from 'express';
import { AuthController } from '../../controllers/authController';
import { authenticate } from '../../middleware/auth';
import { uploadAvatar } from '../../middleware/upload';

const router = Router();

/**
 * @route   POST /api/v1/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', AuthController.signup);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', AuthController.login);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', authenticate, AuthController.getMe);

/**
 * @route   PUT /api/v1/auth/me
 * @desc    Update current authenticated user
 * @access  Private
 */
router.put('/me', authenticate, uploadAvatar, AuthController.updateMe);

/**
 * @route   POST /api/v1/auth/upload-avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post('/upload-avatar', authenticate, uploadAvatar, AuthController.uploadAvatar);

export default router;

