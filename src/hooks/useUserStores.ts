/**
 * Centralized User Stores Hook
 * ============================
 * Single source of truth for user's stores.
 * Uses TanStack Query to cache stores and prevent duplicate fetches.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface UserStore {
  id: string;
  name: string;
  type?: string;
  category?: string;
  logo?: string | null;
  sheet_id?: string | null;
  is_active?: boolean;
  created_at?: string;
  description?: string;
  location?: string;
  website?: string;
  phone?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Query key for user stores - use this when invalidating
 */
export const USER_STORES_QUERY_KEY = (userId: string) => ['user-stores', userId] as const;

/**
 * Fetch all stores for a user
 */
async function fetchUserStores(userId: string): Promise<UserStore[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[useUserStores] Error fetching stores:', error);
    throw error;
  }

  return data || [];
}

/**
 * Hook to get all stores for the current user
 * Uses TanStack Query for caching
 */
export function useUserStores() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: stores, isLoading: storesLoading, error, refetch } = useQuery({
    queryKey: USER_STORES_QUERY_KEY(user?.id || ''),
    queryFn: () => fetchUserStores(user!.id),
    enabled: !!user?.id, // Only fetch when user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    stores: stores ?? [],
    firstStore: stores?.[0] ?? null,
    firstStoreId: stores?.[0]?.id ?? null,
    isLoading: authLoading || storesLoading,
    error,
    refetch,
  };
}

/**
 * Hook to invalidate stores cache (call after creating/deleting stores)
 */
export function useInvalidateStores() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: USER_STORES_QUERY_KEY(user.id) });
    }
  };
}

/**
 * Hook to get a single store by ID (from cache or fetches)
 */
export function useStore(storeId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['store', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      if (error) {
        console.error('[useStore] Error fetching store:', error);
        throw error;
      }

      return data as UserStore;
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
