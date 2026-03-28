export interface User {
  id: string;
  email: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  invite_code: string;
  created_at: string;
}

export interface Business {
  id: string;
  name: string;
  category?: string;
  address?: string;
}

export interface Review {
  id: string;
  user_id: string;
  business_id: string;
  rating: number;
  body: string;
  pros?: string[];
  cons?: string[];
  visibility: 'friends' | '2hop' | 'private';
  ai_polished: boolean;
  created_at: string;
  user?: User;
  business?: Business;
  trust_distance?: number;
  via_friend?: string;
}

export interface Invite {
  id: string;
  code: string;
  created_by: string;
  used_by?: string;
  used_at?: string;
  created_at: string;
  status: 'pending' | 'used' | 'expired';
}

export interface FeedFilters {
  category?: string;
  cursor?: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  invite_code: string;
}

export interface CreateReviewPayload {
  business_id: string;
  rating: number;
  body: string;
  pros?: string[];
  cons?: string[];
  visibility: 'friends' | '2hop' | 'private';
}

export interface AIAssistPayload {
  body: string;
  action: 'polish' | 'structure' | 'add_detail';
}
