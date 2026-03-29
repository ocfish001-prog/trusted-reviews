export interface User {
  id: string;
  email: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  zip_code?: string;
  home_lat?: number;
  home_lng?: number;
  invite_code: string;
  created_at: string;
}

export interface Business {
  id: string;
  name: string;
  category?: string;
  address?: string;
  lat?: number;
  lng?: number;
  google_place_id?: string;
  osm_id?: string;
}

export interface OsmPlaceUpsertPayload {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  osm_id: string;
  google_place_id?: string;
}

export interface GooglePlaceUpsertPayload {
  name: string;
  address?: string;
  category?: string;
  lat?: number;
  lng?: number;
  google_place_id: string;
}

export interface ReviewSearchResult {
  id: string;
  rating: number;
  body?: string;
  pros?: string[];
  cons?: string[];
  visibility: string;
  ai_polished: boolean;
  created_at: string;
  business: Business;
  reviewer_name?: string;
}

export interface CombinedSearchResponse {
  businesses: Business[];
  reviews: ReviewSearchResult[];
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
  /** API returns this as "reviewer" — normalised to "user" in api.ts */
  user?: User;
  /** Also accepted as the raw API field name */
  reviewer?: User;
  business?: Business;
  trust_distance?: number;
  /** API may return full User object or a name string */
  via_friend?: string | User | null;
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
  /** Some endpoints also return "token" as an alias */
  token?: string;
  token_type: string;
  /** User object returned by the login endpoint */
  user?: User;
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
