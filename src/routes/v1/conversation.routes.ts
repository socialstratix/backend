import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  getConversations,
  getConversation,
  createConversation,
  getMessages,
  deleteConversation,
} from '../../controllers/conversationController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all conversations for logged-in user
router.get('/', getConversations);

// Create or get existing conversation
router.post('/', createConversation);

// Get single conversation
router.get('/:id', getConversation);

// Get messages for a conversation
router.get('/:id/messages', getMessages);

// Delete conversation
router.delete('/:id', deleteConversation);

export default router;


