import { Router } from 'express';
import { BrandController } from '../../controllers/brandController';
import { authenticate } from '../../middleware/auth';
import { uploadLogo } from '../../middleware/upload';

const router = Router();

/**
 * @route   POST /api/v1/brand
 * @desc    Create a new brand profile
 * @access  Private
 */
router.post('/', authenticate, BrandController.createBrand);

/**
 * @route   GET /api/v1/brand
 * @desc    Get all brands with pagination and filtering
 * @access  Public
 */
router.get('/', BrandController.getAllBrands);

/**
 * @route   POST /api/v1/brand/upload-logo
 * @desc    Upload brand logo
 * @access  Private
 */
router.post('/upload-logo', authenticate, uploadLogo, BrandController.uploadLogo);

/**
 * @route   GET /api/v1/brand/id/:brandId
 * @desc    Get brand profile by brand ID (MongoDB _id)
 * @access  Public
 */
router.get('/id/:brandId', BrandController.getBrandById);

/**
 * @route   GET /api/v1/brand/:userId
 * @desc    Get brand profile by user ID
 * @access  Public
 */
router.get('/:userId', BrandController.getBrandByUserId);

/**
 * @route   PUT /api/v1/brand/:userId
 * @desc    Update brand profile
 * @access  Private (Brand only)
 */
router.put('/:userId', authenticate, uploadLogo, BrandController.updateBrand);

/**
 * @route   DELETE /api/v1/brand/:userId
 * @desc    Delete brand profile
 * @access  Private (Brand only)
 */
router.delete('/:userId', authenticate, BrandController.deleteBrand);

export default router;
