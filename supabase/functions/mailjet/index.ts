import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Mailjet API endpoints
const MAILJET_API_URL = 'https://api.mailjet.com/v3/REST';
const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send';

// Default contact list ID - REQUIRED for production
// Set MAILJET_DEFAULT_LIST_ID in environment variables
const DEFAULT_LIST_ID = Deno.env.get('MAILJET_DEFAULT_LIST_ID') 
  ? Number(Deno.env.get('MAILJET_DEFAULT_LIST_ID')) 
  : null;

interface MailjetContact {
  email: string;
  name?: string;
  isExcludedFromCampaigns?: boolean;
}

interface AddContactRequest {
  operation: 'add_contact';
  email: string;
  name?: string;
}

interface ListContactsRequest {
  operation: 'list_contacts';
  listId?: number;
  limit?: number;
  offset?: number;
}

interface SendEmailRequest {
  operation: 'send_email';
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

interface SendCampaignRequest {
  operation: 'send_campaign';
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderEmail?: string;
  senderName?: string;
}

interface GetListsRequest {
  operation: 'get_lists';
}

interface SyncUsersRequest {
  operation: 'sync_users';
}

interface GetStatsRequest {
  operation: 'get_stats';
}

interface GetDefaultListRequest {
  operation: 'get_default_list';
}

type MailjetRequest = 
  | AddContactRequest 
  | ListContactsRequest 
  | SendEmailRequest 
  | SendCampaignRequest
  | GetListsRequest
  | SyncUsersRequest
  | GetStatsRequest
  | GetDefaultListRequest;

/**
 * Logging helper
 */
function log(requestId: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data) : '';
  console.log(`[${timestamp}] [${requestId}] ${message}`, logData);
}

/**
 * Get Mailjet auth headers
 */
function getMailjetAuth(): string {
  const apiKey = Deno.env.get('MAILJET_API_KEY');
  const secretKey = Deno.env.get('MAILJET_SECRET_KEY');

  console.log('Mailjet credentials check:', { 
    hasApiKey: !!apiKey, 
    apiKeyLength: apiKey?.length,
    hasSecretKey: !!secretKey,
    secretKeyLength: secretKey?.length,
  });

  if (!apiKey || !secretKey) {
    throw new Error('Mailjet API credentials not configured. Set MAILJET_API_KEY and MAILJET_SECRET_KEY environment variables.');
  }

  // Mailjet uses Basic auth with apiKey:secretKey
  const credentials = `${apiKey}:${secretKey}`;
  return 'Basic ' + btoa(credentials);
}

/**
 * Get the default list ID - throws if not configured
 */
function getDefaultListId(): number {
  if (!DEFAULT_LIST_ID) {
    throw new Error('MAILJET_DEFAULT_LIST_ID environment variable is required');
  }
  return DEFAULT_LIST_ID;
}

/**
 * Check if user is super admin
 */
async function isSuperAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) return false;
  return data.role === 'super_admin';
}

/**
 * Add a contact to Mailjet and subscribe to the default list
 */
async function addContact(
  authHeader: string, 
  email: string, 
  name?: string
): Promise<{ success: boolean; contactId?: number; error?: string }> {
  const listId = getDefaultListId();
  
  try {
    // First, create or get the contact
    const contactResponse = await fetch(`${MAILJET_API_URL}/contact`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Email: email,
        Name: name || email.split('@')[0],
        IsExcludedFromCampaigns: false,
      }),
    });

    let contactId: number;

    if (contactResponse.status === 400) {
      // Contact already exists, get their ID
      const getContactResponse = await fetch(`${MAILJET_API_URL}/contact/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!getContactResponse.ok) {
        return { success: false, error: 'Contact not found and could not be created' };
      }

      const existingContact = await getContactResponse.json();
      contactId = existingContact.Data[0].ID;
    } else if (!contactResponse.ok) {
      const error = await contactResponse.text();
      return { success: false, error: `Failed to create contact: ${error}` };
    } else {
      const contactData = await contactResponse.json();
      contactId = contactData.Data[0].ID;
    }

    // Add contact to the default list
    const listResponse = await fetch(`${MAILJET_API_URL}/contactslist/${listId}/managecontact`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Email: email,
        Action: 'addnoforce',
      }),
    });

    if (!listResponse.ok) {
      const error = await listResponse.text();
      console.error('Failed to add contact to list:', error);
      return { success: true, contactId, error: `Contact created but failed to add to list: ${error}` };
    }

    return { success: true, contactId };
  } catch (error) {
    console.error('Error adding contact:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * List contacts from the default Mailjet list
 * Uses the listrecipient endpoint to get subscription details
 */
async function listContacts(
  authHeader: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ contacts: MailjetContact[]; total: number; error?: string }> {
  const listId = getDefaultListId();
  
  try {
    // Use listrecipient endpoint to get contacts subscribed to a specific list
    // This gives us IsUnsubscribed status for each contact
    const url = `${MAILJET_API_URL}/listrecipient?ContactsList=${listId}&Limit=${limit}&Offset=${offset}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { contacts: [], total: 0, error: `Failed to fetch contacts: ${error}` };
    }

    const data = await response.json();
    const recipients = data.Data || [];
    
    // Now fetch contact details for each recipient
    const contacts: MailjetContact[] = [];
    
    for (const recipient of recipients) {
      // Each listrecipient has ContactID and IsUnsubscribed
      const contactId = recipient.ContactID;
      const isUnsubscribed = recipient.IsUnsubscribed || false;
      
      // Fetch contact details
      const contactUrl = `${MAILJET_API_URL}/contact/${contactId}`;
      const contactResp = await fetch(contactUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });
      
      if (contactResp.ok) {
        const contactData = await contactResp.json();
        const c = contactData.Data?.[0];
        if (c) {
          contacts.push({
            email: c.Email,
            name: c.Name,
            isExcludedFromCampaigns: isUnsubscribed || c.IsExcludedFromCampaigns || false,
          });
        }
      }
    }

    return { contacts, total: data.Total || contacts.length };
  } catch (error) {
    console.error('Error listing contacts:', error);
    return { contacts: [], total: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Get all contact lists (for debugging/admin)
 */
async function getContactLists(authHeader: string): Promise<{ lists: any[]; error?: string }> {
  try {
    const response = await fetch(`${MAILJET_API_URL}/contactslist`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { lists: [], error: `Failed to fetch contact lists: ${error}` };
    }

    const data = await response.json();
    const lists = data.Data?.map((l: any) => ({
      id: l.ID,
      name: l.Name,
      subscriberCount: l.SubscriberCount || 0,
      createdAt: l.CreatedAt,
    })) || [];

    return { lists };
  } catch (error) {
    console.error('Error getting contact lists:', error);
    return { lists: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Get the default list info
 */
async function getDefaultListInfo(authHeader: string): Promise<{ id?: number; name?: string; subscriberCount?: number; error?: string }> {
  if (!DEFAULT_LIST_ID) {
    return { error: 'MAILJET_DEFAULT_LIST_ID environment variable is not set' };
  }
  
  try {
    // Test API connection first
    const allListsResp = await fetch(`${MAILJET_API_URL}/contactslist?Limit=100`, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    });
    
    const responseText = await allListsResp.text();
    console.log('Mailjet API response status:', allListsResp.status);
    console.log('Mailjet API response:', responseText);
    
    if (!allListsResp.ok) {
      return { error: `Mailjet API error (status ${allListsResp.status}): ${responseText}` };
    }
    
    let allListsData;
    try {
      allListsData = JSON.parse(responseText);
    } catch {
      return { error: `Invalid JSON response from Mailjet: ${responseText}` };
    }
    
    const lists = allListsData.Data || [];
    console.log('Found lists:', lists.length);
    
    // Find our list
    const targetList = lists.find((l: any) => l.ID === DEFAULT_LIST_ID);
    
    if (targetList) {
      return { 
        id: targetList.ID, 
        name: targetList.Name,
        subscriberCount: targetList.SubscriberCount || 0,
      };
    }
    
    // If we have lists but not our target, show what's available
    if (lists.length > 0) {
      const availableIds = lists.map((l: any) => `${l.ID}:${l.Name}`).join(', ');
      return { error: `List ID ${DEFAULT_LIST_ID} not found. Available: [${availableIds}]` };
    }
    
    // No lists at all - likely wrong API account or new account
    return { error: `No contact lists found in Mailjet account. Create a list first or check API credentials are for the correct account.` };
  } catch (error) {
    console.error('Error getting default list info:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Send email via Mailjet
 */
async function sendEmail(
  authHeader: string,
  to: Array<{ email: string; name?: string }>,
  subject: string,
  htmlContent: string,
  textContent?: string,
  senderEmail?: string,
  senderName?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const fromEmail = senderEmail || Deno.env.get('MAILJET_SENDER_EMAIL') || 'noreply@heysheets.com';
    const fromName = senderName || Deno.env.get('MAILJET_SENDER_NAME') || 'HeySheets';

    const response = await fetch(MAILJET_SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: fromEmail, Name: fromName },
          To: to.map(t => ({ Email: t.email, Name: t.name || t.email.split('@')[0] })),
          Subject: subject,
          HTMLPart: htmlContent,
          TextPart: textContent || htmlContent.replace(/<[^>]*>/g, ''),
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Failed to send email: ${error}` };
    }

    const data = await response.json();
    const messageId = data.Messages?.[0]?.To?.[0]?.MessageID;
    return { success: true, messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sync all users from Supabase to the default Mailjet list
 */
async function syncUsersToMailjet(
  supabase: any,
  authHeader: string
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name');

  if (error) {
    return { synced: 0, failed: 0, errors: [`Failed to fetch users: ${error.message}`] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of users || []) {
    if (!user.email) continue;

    const result = await addContact(authHeader, user.email, user.full_name);
    if (result.success) {
      synced++;
    } else {
      failed++;
      if (result.error) {
        errors.push(`${user.email}: ${result.error}`);
      }
    }
  }

  return { synced, failed, errors };
}

/**
 * Get email statistics for the default list
 */
async function getStats(authHeader: string): Promise<{ stats: any; error?: string }> {
  const listId = getDefaultListId();
  
  try {
    const listStatsResponse = await fetch(`${MAILJET_API_URL}/contactslist/${listId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!listStatsResponse.ok) {
      const error = await listStatsResponse.text();
      return { stats: null, error: `Failed to fetch stats: ${error}` };
    }

    const listData = await listStatsResponse.json();
    return { stats: listData.Data?.[0] || null };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { stats: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  log(requestId, '📧 Mailjet function called');

  try {
    // Get authorization token
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if internal call (using service role key)
    const token = authorizationHeader.replace('Bearer ', '');
    const isInternalCall = token === serviceRoleKey;
    let userId: string | null = null;

    if (!isInternalCall) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
    }

    // Parse request body
    const body: MailjetRequest = await req.json();
    log(requestId, `Operation: ${body.operation}`, { userId, isInternalCall });

    // Get Mailjet auth
    const mailjetAuth = getMailjetAuth();

    // Handle add_contact - can be called internally for new signups
    if (body.operation === 'add_contact') {
      const { email, name } = body as AddContactRequest;
      
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'Email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await addContact(mailjetAuth, email, name);
      log(requestId, 'Add contact result', result);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All other operations require super admin
    if (!isInternalCall && userId) {
      const isAdmin = await isSuperAdmin(supabase, userId);
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Super admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    switch (body.operation) {
      case 'list_contacts': {
        const { limit, offset } = body as ListContactsRequest;
        const result = await listContacts(mailjetAuth, limit, offset);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_lists': {
        const result = await getContactLists(mailjetAuth);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send_email': {
        const { to, subject, htmlContent, textContent } = body as SendEmailRequest;
        if (!to || !subject || !htmlContent) {
          return new Response(
            JSON.stringify({ error: 'to, subject, and htmlContent are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const result = await sendEmail(mailjetAuth, to, subject, htmlContent, textContent);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send_campaign': {
        const { subject, htmlContent, textContent, senderEmail, senderName } = body as SendCampaignRequest;
        if (!subject || !htmlContent) {
          return new Response(
            JSON.stringify({ error: 'subject and htmlContent are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get all subscribed contacts from the default list
        const contactsResult = await listContacts(mailjetAuth, 10000);
        if (contactsResult.error) {
          return new Response(
            JSON.stringify({ error: contactsResult.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Filter to only subscribed contacts
        const subscribedContacts = contactsResult.contacts.filter(c => !c.isExcludedFromCampaigns);
        if (subscribedContacts.length === 0) {
          return new Response(
            JSON.stringify({ error: 'No subscribed contacts in list' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const to = subscribedContacts.map(c => ({ email: c.email, name: c.name }));
        const result = await sendEmail(mailjetAuth, to, subject, htmlContent, textContent, senderEmail, senderName);
        return new Response(
          JSON.stringify({ ...result, recipientCount: to.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync_users': {
        const result = await syncUsersToMailjet(supabase, mailjetAuth);
        log(requestId, 'Sync users result', result);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_stats': {
        const result = await getStats(mailjetAuth);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_default_list': {
        const result = await getDefaultListInfo(mailjetAuth);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown operation: ${(body as any).operation}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log(requestId, '❌ Error', { error: errMsg });
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

console.log('Mailjet function ready');
