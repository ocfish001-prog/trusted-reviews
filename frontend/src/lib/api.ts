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
  // FastAPI OAuth2 form
  const formData = new URLSearchParams();
  formData.append('username', payload.email);
  formData.append('password', payload.password);
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  if (!res.ok) {
    let message = 'Invalid email or password.';
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch { /* empty */ }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export async function signup(payload: SignupPayload): Promise<User> {
  return request<User>('/auth/signup', {
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
  return request<User>('/users/me');
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

// Reviews / Feed
export async function getFeed(filters: FeedFilters = {}): Promise<{ reviews: Review[]; next_cursor?: string }> {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.cursor) params.set('cursor', filters.cursor);
  const qs = params.toString();
  return request<{ reviews: Review[]; next_cursor?: string }>(`/feed${qs ? `?${qs}` : ''}`);
}

export async function getUserReviews(userId: string): Promise<Review[]> {
  return request<Review[]>(`/users/${userId}/reviews`);
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

export async function getBusinessReviews(id: string): Promise<{ reviews: Review[]; network_stats: { friend_count: number; hop2_count: number; avg_rating: number } }> {
  return request(`/businesses/${id}/reviews`);
}

// Invites
export async function getInvites(): Promise<Invite[]> {
  return request<Invite[]>('/invites');
}

export async function createInvite(): Promise<Invite> {
  return request<Invite>('/invites', { method: 'POST' });
}
