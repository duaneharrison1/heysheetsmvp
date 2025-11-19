import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'user' | 'super_admin';

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRole(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle(); // Changed from .single() to .maybeSingle() to handle missing profiles

        if (error && error.code !== 'PGRST116') {
          throw error; // Only throw if it's not a "no rows" error
        }

        setRole((data?.role as UserRole) || 'user'); // Default to 'user' if no profile exists
      } catch (err: any) {
        console.error('Failed to fetch user role:', err);
        setError(err?.message || 'Failed to fetch role');
        setRole('user'); // Default to user on error
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      await fetchUserRole();
    });

    return () => subscription?.unsubscribe();
  }, []);

  return { role, loading, error, isSuperAdmin: role === 'super_admin' };
};
