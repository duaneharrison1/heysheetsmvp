import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useStores = (userId?: string, enabled = true) => {
  return useQuery({
    queryKey: ['stores', userId],
    queryFn: async () => {
      let query = supabase.from('stores').select('id, name');
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!userId,
  });
};

export const useAllStores = (enabled = true) => {
  return useQuery({
    queryKey: ['all-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, type, is_active, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled,
  });
};

export const useStoreUsers = (enabled = true) => {
  return useQuery({
    queryKey: ['store-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email')
        .limit(1000);

      if (error) throw error;
      return data || [];
    },
    enabled,
  });
};
