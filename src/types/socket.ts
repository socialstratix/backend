import { IMessage } from './index';

export interface ServerToClientEvents {
  newMessage: (message: IMessage) => void;
  messageRead: (data: { messageId: string; readAt: Date }) => void;
  userOnline: (userId: string) => void;
  userOffline: (userId: string) => void;
  typing: (data: { userId: string; conversationId: string; isTyping: boolean }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  sendMessage: (data: { conversationId: string; text: string }, callback?: (response: { success: boolean; message?: IMessage; error?: string }) => void) => void;
  typing: (data: { conversationId: string; isTyping: boolean }) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  messageRead: (data: { messageId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  userType: 'brand' | 'influencer';
}


