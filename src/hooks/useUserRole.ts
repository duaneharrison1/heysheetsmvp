import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'user' | 'super_admin';

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've already fetched to prevent duplicate calls
  const hasFetched = useRef(false);
  const isMounted = useRef(true);

  const fetchUserRole = useCallback(async (force = false) => {
    // Skip if already fetched and not forced
    if (hasFetched.current && !force) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!isMounted.current) return;
      
      if (!user) {
        setRole(null);
        setLoading(false);
        hasFetched.current = true;
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted.current) return;

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setRole((data?.role as UserRole) || 'user');
      hasFetched.current = true;
    } catch (err: any) {
      if (!isMounted.current) return;
      console.error('Failed to fetch user role:', err);
      setError(err?.message || 'Failed to fetch role');
      setRole('user');
      hasFetched.current = true;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    hasFetched.current = false;
    
    fetchUserRole();

    // Listen for auth changes - only refetch on actual state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only refetch on meaningful events, not TOKEN_REFRESHED which happens frequently
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        hasFetched.current = false; // Reset to allow refetch
        fetchUserRole(true);
      }
    });

    return () => {
      isMounted.current = false;
      subscription?.unsubscribe();
    };
  }, [fetchUserRole]);

  return { role, loading, error, isSuperAdmin: role === 'super_admin' };
};
