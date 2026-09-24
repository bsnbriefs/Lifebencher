export type UserRole = 'client' | 'admin';

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export type Gender = 'female' | 'male' | 'non-binary' | 'other';

export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  age: number;
  gender: Gender;
  location: string;
  profession: string;
  education: string;
  bio: string;
  photos: string[];
  interests: string[];
  values: string[];
  relationshipGoal: string;
  lifestyle: {
    faith?: string;
    smoking?: 'no' | 'occasionally' | 'yes';
    drinking?: 'no' | 'socially' | 'frequently';
    exercise?: 'active' | 'sometimes' | 'rarely';
    kids?: 'wants kids' | 'has kids' | 'open to kids' | 'prefers none';
  };
  isVerified: boolean;
  isVisible: boolean;
  compatibilityScore?: number;
  compatibilityReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilePreferences {
  id: string;
  profileId: string;
  preferredGender: Gender[];
  ageMin: number;
  ageMax: number;
  preferredLocations: string[];
  preferredRelationshipGoals: string[];
}

export type MatchRequestStatus = 'pending' | 'accepted' | 'declined';

export interface MatchRequest {
  id: string;
  senderId: string;
  receiverId: string;
  senderProfile?: Profile;
  receiverProfile?: Profile;
  status: MatchRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export type MatchStatus = 'active' | 'expired' | 'ended';

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  user1Profile?: Profile;
  otherProfile?: Profile;
  status: MatchStatus;
  startedAt: string;
  expiresAt: string;
  endedAt?: string;
  extendedCount: number;
}

export interface MatchExtension {
  id: string;
  matchId: string;
  paidByUserId: string;
  paymentId: string;
  daysAdded: number;
  previousExpiresAt: string;
  newExpiresAt: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  matchId: string;
  participantIds: string[];
  otherUser?: Profile;
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt?: string;
  createdAt: string;
  isSending?: boolean;
}

export type ContactExchangeStatus = 'pending' | 'completed' | 'declined';

export interface ContactExchangeRequest {
  id: string;
  matchId: string;
  initiatorId: string;
  user1Id: string;
  user2Id: string;
  user1Consented: boolean;
  user2Consented: boolean;
  user1Contact?: { phone: string; whatsapp?: string; email: string };
  user2Contact?: { phone: string; whatsapp?: string; email: string };
  status: ContactExchangeStatus;
  consentedAt?: string;
}

export interface PaymentTier {
  days: number;
  amountNgn: number;
  label: string;
  isPopular?: boolean;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  matchId: string;
  reference: string;
  amount: number;
  currency: 'NGN';
  status: 'pending' | 'success' | 'failed';
  extensionDays: number;
  paystackId?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface PlatformSettings {
  defaultMatchDays: number;
  extensionTiers: PaymentTier[];
}

export type NavigationTab = 'discover' | 'matches' | 'messages' | 'profile';
