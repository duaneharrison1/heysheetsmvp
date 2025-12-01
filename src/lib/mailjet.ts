/**
 * Mailjet API client for the frontend
 * Provides methods to interact with the Mailjet edge function
 */

import { supabase } from '@/lib/supabase';

// Key to track if we've already synced this user in this session
const MAILJET_SYNC_KEY = 'mailjet_user_synced';

export interface MailjetContact {
  email: string;
  name?: string;
  isExcludedFromCampaigns?: boolean;
}

export interface SendEmailParams {
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface SendCampaignParams {
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderEmail?: string;
  senderName?: string;
}

/**
 * Get the user's access token for API calls
 */
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

/**
 * Call the Mailjet edge function
 */
async function callMailjetFunction<T>(body: Record<string, any>): Promise<T> {
  const token = await getAuthToken();
  
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mailjet`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Mailjet API call failed');
  }

  return data as T;
}

/**
 * Sync the current user to Mailjet contact list
 * Called automatically on login - only syncs once per session to avoid spam
 * This handles the case where database triggers don't work (pg_net not enabled)
 */
export async function syncCurrentUserToMailjet(): Promise<void> {
  try {
    // Check if we've already synced in this session
    const sessionSynced = sessionStorage.getItem(MAILJET_SYNC_KEY);
    if (sessionSynced) {
      return; // Already synced this session
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return;
    }

    // Get user's name from metadata
    const name = user.user_metadata?.full_name || 
                 user.user_metadata?.name || 
                 user.email.split('@')[0];

    // Call add_contact - this is idempotent, won't create duplicates
    const token = await getAuthToken();
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mailjet`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          operation: 'add_contact',
          email: user.email,
          name: name,
        }),
      }
    );

    if (response.ok) {
      // Mark as synced for this session
      sessionStorage.setItem(MAILJET_SYNC_KEY, 'true');
      console.log('[Mailjet] User synced to contact list');
    } else {
      const error = await response.json();
      console.warn('[Mailjet] Failed to sync user:', error);
    }
  } catch (error) {
    // Don't throw - this is a background operation that shouldn't block the UI
    console.warn('[Mailjet] Error syncing user:', error);
  }
}

/**
 * Mailjet API client
 */
export const mailjetApi = {
  /**
   * Get the default list info (id, name, subscriberCount)
   */
  async getDefaultList(): Promise<{ id?: number; name?: string; subscriberCount?: number; error?: string }> {
    return callMailjetFunction({ operation: 'get_default_list' });
  },

  /**
   * List contacts from the default list
   */
  async listContacts(
    limit: number = 100,
    offset: number = 0
  ): Promise<{ contacts: MailjetContact[]; total: number; error?: string }> {
    return callMailjetFunction({
      operation: 'list_contacts',
      limit,
      offset,
    });
  },

  /**
   * Send an email to specific recipients
   */
  async sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return callMailjetFunction({
      operation: 'send_email',
      ...params,
    });
  },

  /**
   * Send a campaign to the default contact list
   */
  async sendCampaign(params: SendCampaignParams): Promise<{ success: boolean; messageId?: string; recipientCount?: number; error?: string }> {
    return callMailjetFunction({
      operation: 'send_campaign',
      ...params,
    });
  },

  /**
   * Sync all Supabase users to Mailjet default list
   */
  async syncUsers(): Promise<{ synced: number; failed: number; errors: string[] }> {
    return callMailjetFunction({
      operation: 'sync_users',
    });
  },

  /**
   * Get email statistics for the default list
   */
  async getStats(): Promise<{ stats: any; error?: string }> {
    return callMailjetFunction({
      operation: 'get_stats',
    });
  },
};

export default mailjetApi;
