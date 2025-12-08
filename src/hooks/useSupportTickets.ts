import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface SupportTicket {
  id: string;
  user_id: string | null;
  store_id: string | null;
  category: 'feedback' | 'bug' | 'question' | 'other';
  subject: string;
  message: string;
  contact_email: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  user_email?: string | null;
  store_name?: string | null;
  store_url?: string | null;
}

const PAGE_SIZE = 20;

interface TicketFilters {
  category?: string;
  status?: string;
  priority?: string;
  page?: number;
}

export const useSupportTickets = (filters: TicketFilters = {}, enabled = true) => {
  const { category = 'all', status = 'all', priority = 'all', page = 1 } = filters;
  
  return useQuery({
    queryKey: ['support-tickets', category, status, priority, page],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select('*', { count: 'exact' });

      if (category !== 'all') {
        query = query.eq('category', category);
      }
      if (status !== 'all') {
        query = query.eq('status', status);
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
      
      const rawTickets: SupportTicket[] = data || [];
      const userIds = Array.from(
        new Set(rawTickets.map(t => t.user_id).filter(Boolean) as string[])
      );

      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, email')
          .in('id', userIds);
        
        if (!profileError) {
          profiles = profileData || [];
        }
      }

      const profileMap = new Map<string, any>();
      profiles.forEach((p: any) => profileMap.set(p.id, p));

      const enriched = rawTickets.map(t => {
        const ticket = { ...t } as SupportTicket;
        if (t.user_id) {
          const p = profileMap.get(t.user_id);
          if (p) {
            ticket.user_name = p.email || null;
            ticket.user_email = p.email || null;
          }
        }
        if (t.store_id) {
          ticket.store_url = `${window.location.origin}/store/${t.store_id}`;
        }
        return ticket;
      });

      return { data: enriched, count: count || 0 };
    },
    enabled,
  });
};

export const useTicketStores = (enabled = true) => {
  return useQuery({
    queryKey: ['ticket-stores'],
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
