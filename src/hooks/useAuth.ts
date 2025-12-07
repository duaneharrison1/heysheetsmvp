/**
 * Centralized Auth Hook
 * =====================
 * Single source of truth for user authentication state.
 * Uses TanStack Query to cache auth state and prevent duplicate fetches.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Query key for auth state - use this when invalidating
 */
export const AUTH_QUERY_KEY = ['auth-user'] as const;

/**
 * Fetch the current user from Supabase
 */
async function fetchUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('[useAuth] Error fetching user:', error);
    return null;
  }
  return user;
}

/**
 * Centralized auth hook using TanStack Query
 * - Caches user state to prevent duplicate fetches
 * - Listens for auth state changes
 * - Provides consistent auth state across all components
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchUser,
    staleTime: Infinity, // Never refetch automatically - auth state changes via listener
    gcTime: Infinity, // Keep cached forever during session
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Listen for auth state changes and update cache
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only update on meaningful events
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          // Update cache directly instead of refetching
          queryClient.setQueryData(AUTH_QUERY_KEY, session?.user ?? null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [queryClient]);

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
    error,
  };
}

/**
 * Hook to invalidate auth state (call after sign out)
 */
export function useInvalidateAuth() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
  };
}
