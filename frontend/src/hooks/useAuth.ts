'use client';

import { useState, useEffect, useCallback } from 'react';
import { getToken, getStoredUser, setStoredUser, clearToken } from '@/lib/auth';
import { getMe } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [loading, setLoading] = useState<boolean>(!getStoredUser());
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await getMe();
      setUser(me);
      setStoredUser(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return { user, loading, error, refetch: fetchUser, logout };
}
