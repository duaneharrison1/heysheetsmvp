/**
 * Mailjet API client for the frontend
 * Provides methods to interact with the Mailjet edge function
 */

import { supabase } from '@/lib/supabase';

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
