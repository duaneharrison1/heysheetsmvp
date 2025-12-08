import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface FeedbackItem {
  id: string;
  store_id: string;
  store_url: string | null;
  message_id: string;
  message_content: string;
  feedback_type: 'like' | 'dislike';
  conversation_history: Array<{ role: string; content: string }> | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  created_at: string;
}

const PAGE_SIZE = 20;

interface FeedbackFilters {
  feedbackType?: 'all' | 'like' | 'dislike';
  storeId?: string;
  priority?: string;
  page?: number;
}

export const useFeedback = (filters: FeedbackFilters = {}, enabled = true) => {
  const { feedbackType = 'all', storeId = 'all', priority = 'all', page = 1 } = filters;
  
  return useQuery({
    queryKey: ['feedback', feedbackType, storeId, priority, page],
    queryFn: async () => {
      let query = supabase
        .from('chat_feedback')
        .select('*', { count: 'exact' });

      if (feedbackType !== 'all') {
        query = query.eq('feedback_type', feedbackType);
      }
      if (storeId !== 'all') {
        query = query.eq('store_id', storeId);
      }
      if (priority !== 'all') {
        if (priority === 'none') {
          query = query.is('priority', null);
        } else {
          query = query.eq('priority', priority);
        }
      }

      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled,
  });
};

export const useFeedbackStores = (enabled = true) => {
  return useQuery({
    queryKey: ['feedback-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled,
  });
};
