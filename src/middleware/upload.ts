import multer from 'multer';
import path from 'path';

// Configure storage
// Use memory storage - files will be uploaded directly to Google Drive
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
  }
};

// File filter for campaign attachments - allow PDF, Word docs, and images
const campaignAttachmentFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || 
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/msword' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, Word documents, and image files are allowed!'));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Configure multer for campaign attachments
export const uploadCampaignAttachments = multer({
  storage,
  fileFilter: campaignAttachmentFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Export specific upload configurations
export const uploadLogo = upload.single('logo');
export const uploadProfileImage = upload.single('profileImage');
export const uploadAvatar = upload.single('avatar');
export const uploadInfluencerImages = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 }
]);

// Export campaign attachments upload (max 5 files)
export const uploadCampaignAttachmentsArray = uploadCampaignAttachments.array('attachments', 5);
