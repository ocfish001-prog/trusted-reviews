import { getToken } from './auth';
import type {
  AuthTokens,
  LoginPayload,
  SignupPayload,
  User,
  Review,
  Business,
  Invite,
  CreateReviewPayload,
  AIAssistPayload,
  FeedFilters,
  GooglePlaceUpsertPayload,
  CombinedSearchResponse,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail || body.message || message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// Auth
export async function login(payload: LoginPayload): Promise<AuthTokens> {
  // Send JSON with email field (matches backend LoginRequest schema)
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: payload.email, password: payload.password }),
  });
  if (!res.ok) {
    let message = 'Invalid email or password.';
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch { /* empty */ }
    throw new ApiError(message, res.status);
  }
  const data = await res.json();
  // Normalise: backend may return "token" or "access_token"
  if (!data.access_token && data.token) {
    data.access_token = data.token;
  }
  return data as AuthTokens;
}

export async function signup(payload: SignupPayload): Promise<{ user: User; token: string }> {
  return request<{ user: User; token: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestMagicLink(email: string): Promise<{ message: string }> {
  return request('/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getMe(): Promise<User> {
  // The backend does not expose a /users/me route.
  // We return the stored user from localStorage (set during login/signup).
  // This avoids a 404 and keeps the auth hook working correctly.
  const { getStoredUser } = await import('./auth');
  const stored = getStoredUser();
  if (stored) return stored;
  throw new Error('Not authenticated');
}

// Users
export async function getUserProfile(username: string): Promise<User> {
  return request<User>(`/users/${username}`);
}

export async function updateProfile(data: Partial<User>): Promise<User> {
  return request<User>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** Normalise a raw review from the API to match the Review type the UI expects. */
function normalizeReview(r: Review & { reviewer?: User }): Review {
  // Backend returns "reviewer" — map to "user"
  if (!r.user && r.reviewer) {
    r.user = r.reviewer;
  }
  // Backend may return via_friend as a full User object — extract .name
  if (r.via_friend && typeof r.via_friend === 'object') {
    r.via_friend = (r.via_friend as User).name;
  }
  return r;
}

// Reviews / Feed
export async function getFeed(filters: FeedFilters = {}): Promise<{ reviews: Review[]; next_cursor?: string }> {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.cursor) params.set('cursor', filters.cursor);
  const qs = params.toString();
  const raw = await request<{ reviews: (Review & { reviewer?: User })[]; next_cursor?: string; has_more?: boolean }>(
    `/feed${qs ? `?${qs}` : ''}`
  );
  return {
    reviews: raw.reviews.map(normalizeReview),
    next_cursor: raw.next_cursor,
  };
}

export async function getUserReviews(userId: string): Promise<Review[]> {
  const raw = await request<(Review & { reviewer?: User })[]>(`/users/${userId}/reviews`);
  return raw.map(normalizeReview);
}

export async function createReview(payload: CreateReviewPayload): Promise<Review> {
  return request<Review>('/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function aiAssist(payload: AIAssistPayload): Promise<{ result: string }> {
  return request<{ result: string }>('/reviews/ai-assist', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Business
export async function getBusiness(id: string): Promise<Business> {
  return request<Business>(`/businesses/${id}`);
}

export async function searchBusinesses(query: string): Promise<Business[]> {
  return request<Business[]>(`/businesses/search?q=${encodeURIComponent(query)}`);
}

export async function upsertGoogleBusiness(placeData: GooglePlaceUpsertPayload): Promise<Business> {
  return request<Business>('/businesses/google-place', {
    method: 'POST',
    body: JSON.stringify(placeData),
  });
}

export async function combinedSearch(
  query: string,
  category?: string
): Promise<CombinedSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (category) params.set('category', category);
  return request<CombinedSearchResponse>(`/businesses/combined-search?${params.toString()}`);
}

export async function getBusinessReviews(id: string): Promise<{ reviews: Review[]; network_stats: { friend_count: number; hop2_count: number; avg_rating: number } }> {
  return request(`/businesses/${id}/reviews`);
}

// Map
export interface MapBusiness extends Business {
  trust_distance: number;
  avg_rating: number;
  review_count: number;
  top_review_snippet?: string;
  via_friend?: string;
}

export async function getMapBusinesses(): Promise<MapBusiness[]> {
  // Derive map data from the feed — extract unique businesses with their best trust distance
  const { reviews } = await getFeed({ cursor: undefined });
  const businessMap = new Map<string, MapBusiness>();

  for (const review of reviews) {
    if (!review.business || review.business.lat == null || review.business.lng == null) continue;
    const existing = businessMap.get(review.business_id);
    const dist = review.trust_distance ?? 99;

    if (!existing || dist < existing.trust_distance) {
      businessMap.set(review.business_id, {
        ...review.business,
        trust_distance: dist,
        avg_rating: review.rating,
        review_count: 1,
        top_review_snippet: review.body.slice(0, 120),
        via_friend: typeof review.via_friend === 'string' ? review.via_friend : review.via_friend?.name,
      });
    } else {
      // Update avg rating
      existing.avg_rating = (existing.avg_rating * existing.review_count + review.rating) / (existing.review_count + 1);
      existing.review_count += 1;
    }
  }

  return Array.from(businessMap.values());
}

// Invites
export async function getInvites(): Promise<Invite[]> {
  return request<Invite[]>('/invites');
}

export async function createInvite(): Promise<Invite> {
  return request<Invite>('/invites', { method: 'POST' });
}
