import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  sendMessage,
  markAsRead,
  getUnreadCount,
} from '../../controllers/messageController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Send a message
router.post('/', sendMessage);

// Mark message as read
router.put('/:id/read', markAsRead);

// Get unread message count
router.get('/unread/count', getUnreadCount);

export default router;


