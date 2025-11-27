/**
 * Google Calendar API Helper for Supabase Edge Functions (Deno)
 *
 * Provides calendar operations using service account authentication.
 * Same service account as Sheets integration.
 */

// Service account credentials (same as google-sheet function)
const SERVICE_EMAIL = 'heysheets-backend@heysheets-mvp.iam.gserviceaccount.com';

// Private key from google-sheet function
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCxPluzavXlIBhv
B/0akE5hWxP3CqZjsgfEfZEj5WLLX8wk/4ZX52oxQ7bs+bIF0TXFnOcl7y13tFT8
BwnYfq+Z0l+VU77egV/1OUwqvdR4qn2sV0vRxyBVqRNAc+BhGJiBsHVhmWa+xtQa
lWTiEq0GWCR8waouOD7h3A1FJDGgv8IMLHTEaIUhFUtWhG4fVN1KPE7oikfLFQSd
A8HUxMftqBMyhhw415m+J3FphKUQ117TUTfmrg+JLu6IYek2wTyXMjqVqkVplomq
yTc7nXZ0lCVpFlYik8DhA7Bm6Neuq//twM8etDcAS9PZPFXe0/MTbKjLcOixXPtI
YCJM1R1bAgMBAAECggEABfMp8OPuTTq+lzuVa4bcmrgL+4cH/uDDEf2FGcdhgaI9
oCBTyi+iiPTU9y+Koldbjr6to8BbrmEHWU6DLhlSm79MJh8hkSaWqgy6WdT1hPd0
MIzdprUgiL+cPdWl+pxwwinCRvx3ToAuLpZFRLGLzWK4FtgJdnO86KgSaffFErhO
ykl7gHFPc7KPPZHS0hQQhBu2DQUXWKkcuGzXQ4ttjHRB3YtUdl0bIfwiZjEfaLjk
qmXdYUQs8gkPywwFRfuXsXZHz52HmXtpSWNA4Ze0lA3QSxSia+s2oDbWTz2tO1dR
+CuE0mFkn4SPoUNlAluQmXoq2MNBq2URxCnE8nbSQQKBgQDw9JopBHL5npvgZyl/
rgm8i9K1y5vcaM/cHKbonWuGgwJ+bXR8EJBLgKIcanJx4FxPw/8awsPRbQb9VQ7w
GArM5y4f6S6Zl3Rypp6WWVutaQ2F9+3wLubV3qzDFYvkuFBVur+8jGOT6Oa41LNN
UhqearrAK3CBD3ZOILFHfKRNrwKBgQC8T2TwS/drRql7rSMIDdDgfbAYj/+ZQpDd
2YxcbfWFYv1IOcJDzN3wUwRbPfaNRds/FYrs1Ymi2zlqq+YE/RliERD9ISf7ECda
agnIWVhXCWK+DtbE1xetK5hDL2Lx6bn/5vZAbjeeVLJ4XJ6lNDiFaRI4V5yDt3Vv
klN/F26iFQKBgQCKFVLHEMKm5Esl5Vi1z9HKmEJvZjhyrin4VP8drSDym99w/l7T
vlZCvnuoVyQwuEeOep6WAmlfeeCYiwcddlmyJQWcye+nm1DjZzLYrGrKTLqwPG3B
x88HXy2YOp/Jugpnpra8YaOrHrwhzdrXA6c3g6hz+jDl9StyCHAvrHEoBwKBgBM/
nla9vSW3DF36/ai2GNLJpjVsirj0x/AVa7aK+tzOmItIdCYQC+Oj6L8W31vjdxzE
q/W3giEmfYD83z9FS9HtYqotOHP+W7dvPV7AWzpSWEiLJcLrJZ1q5l5/uoJ13LBe
wG8nlQHXMIMDHKhQZTKl4dnmgrYoC5YDBAvqrkFdAoGAcWlMGnmZ3rhRZzRMfr4S
74LMDx1SY+TnkgIf/tdO4WQgiRnrhI0LFqfuORu0540tlDlrC/n8weNHlV3GEH4H
NIAmTGj+xT0A0FWZULXpbmyUXSYhEQ4nbTcX9wlRlX11ixxehPB3Ecj6DiCNhGNH
x8o8OU+8ereiJ2yVcCTggUU=
-----END PRIVATE KEY-----`;

interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string }>;
  extendedProperties?: {
    private?: Record<string, string>;
  };
  recurrence?: string[];
}

/**
 * Generate JWT token for Google API authentication
 *
 * @param subject - Optional user email to impersonate (requires domain-wide delegation)
 *                  When set, the service account will act on behalf of this user
 */
async function generateJWT(subject?: string): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim: Record<string, any> = {
    iss: SERVICE_EMAIL,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Domain-wide delegation: impersonate the specified user
  if (subject) {
    claim.sub = subject;
  }

  // Base64 encode without padding
  const base64url = (str: string) => {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Import private key for signing
  const pemKey = PRIVATE_KEY.replace(/\\n/g, '\n');
  const keyData = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64url(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Get access token from Google OAuth
 *
 * @param subject - Optional user email to impersonate (requires domain-wide delegation)
 */
async function getAccessToken(subject?: string): Promise<string> {
  const jwt = await generateJWT(subject);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

/**
 * Create a new Google Calendar
 */
export async function createCalendar(
  summary: string,
  description: string,
  timeZone: string = 'Asia/Hong_Kong'
): Promise<string> {
  const token = await getAccessToken();

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary, description, timeZone }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to create calendar: ${JSON.stringify(data)}`);
  }

  return data.id;
}

/**
 * Share calendar with user
 *
 * Sends an email notification to the user with a link to add the calendar
 * to their Google Calendar. This is Google's intended flow for calendar sharing.
 */
export async function shareCalendar(
  calendarId: string,
  userEmail: string,
  role: string = 'writer'
): Promise<void> {
  const token = await getAccessToken();

  // sendNotifications=true ensures Google sends an email to the user
  // The email contains an "Add calendar" link to add it to their calendarList
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/acl?sendNotifications=true`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role,
        scope: { type: 'user', value: userEmail },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to share calendar: ${JSON.stringify(error)}`);
  }

  console.log(`✅ Calendar shared with ${userEmail} (role: ${role}). Email notification sent.`);
}

/**
 * Add a calendar to a user's calendarList using domain-wide delegation
 *
 * This requires the service account to have domain-wide delegation enabled
 * in Google Workspace Admin Console with the calendar scope.
 *
 * @param calendarId - The calendar ID to add
 * @param userEmail - The user's email (must be in the same Google Workspace domain)
 */
export async function addCalendarToUserList(
  calendarId: string,
  userEmail: string
): Promise<void> {
  // Get token impersonating the user via domain-wide delegation
  const token = await getAccessToken(userEmail);

  console.log(`[addCalendarToUserList] Adding calendar to ${userEmail}'s list...`);

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: calendarId,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    // 409 = calendar already in list, that's fine
    if (data.error?.code === 409) {
      console.log(`✅ Calendar already in ${userEmail}'s calendar list`);
      return;
    }

    // 403 = domain-wide delegation not set up or wrong domain
    if (data.error?.code === 403) {
      console.warn(`⚠️ Domain-wide delegation not available for ${userEmail}. User will need to add calendar manually.`);
      console.warn('To enable: Google Workspace Admin → Security → API Controls → Domain-wide delegation');
      // Don't throw - this is a soft failure, user can still add manually
      return;
    }

    throw new Error(`Failed to add calendar to user's list: ${JSON.stringify(data)}`);
  }

  console.log(`✅ Calendar added to ${userEmail}'s calendar list`);
}

/**
 * List calendars accessible by service account
 */
export async function listCalendars(): Promise<any[]> {
  const token = await getAccessToken();

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to list calendars: ${JSON.stringify(data)}`);
  }

  return data.items || [];
}

/**
 * List events in a calendar
 */
export async function listEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  singleEvents: boolean = true
): Promise<any[]> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: singleEvents.toString(),
  });

  if (singleEvents) {
    params.append('orderBy', 'startTime');
  }

  console.log('🔍 [listEvents] Attempting to access calendar:', calendarId.substring(0, 20) + '...');
  console.log('🔍 [listEvents] Time range:', { timeMin, timeMax });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ [listEvents] Failed to access calendar');
    console.error('❌ [listEvents] Status:', response.status);
    console.error('❌ [listEvents] Error:', JSON.stringify(data, null, 2));
    console.error('❌ [listEvents] Calendar ID:', calendarId);

    if (response.status === 404) {
      throw new Error(
        `Calendar not accessible. Calendar ID: ${calendarId}. ` +
        `Make sure it's shared with heysheets-backend@heysheets-mvp.iam.gserviceaccount.com ` +
        `with "Make changes to events" permission. Error: ${JSON.stringify(data)}`
      );
    }

    throw new Error(`Failed to list events: ${JSON.stringify(data)}`);
  }

  console.log('✅ [listEvents] Successfully retrieved', data.items?.length || 0, 'events');
  return data.items || [];
}

/**
 * Create a calendar event
 */
export async function createEvent(
  calendarId: string,
  event: CalendarEvent,
  sendUpdates: string = 'all'
): Promise<any> {
  console.log('📅 [createEvent] Creating event on calendar:', calendarId.substring(0, 30) + '...');
  console.log('📅 [createEvent] Event summary:', event.summary);
  console.log('📅 [createEvent] Event times:', { start: event.start.dateTime, end: event.end.dateTime });

  const token = await getAccessToken();

  const params = new URLSearchParams({ sendUpdates });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    console.error('❌ [createEvent] Failed:', JSON.stringify(data));
    throw new Error(`Failed to create event: ${JSON.stringify(data)}`);
  }

  console.log('✅ [createEvent] Event created successfully:', {
    id: data.id,
    htmlLink: data.htmlLink,
    status: data.status,
    created: data.created
  });

  return data;
}

/**
 * Update event extendedProperties
 */
export async function updateEventProperties(
  calendarId: string,
  eventId: string,
  properties: Record<string, string>
): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extendedProperties: {
          private: properties
        }
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to update event: ${JSON.stringify(error)}`);
  }
}

/**
 * Count bookings for a specific service at a specific time
 */
export async function countBookings(
  inviteCalendarId: string,
  serviceId: string,
  dateTime: string
): Promise<number> {
  const token = await getAccessToken();

  // Get events in a 1-minute window around the dateTime
  const startTime = new Date(dateTime);
  const endTime = new Date(startTime.getTime() + 60000);

  const params = new URLSearchParams({
    timeMin: startTime.toISOString(),
    timeMax: endTime.toISOString(),
    singleEvents: 'true',
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(inviteCalendarId)}/events?${params}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to count bookings: ${JSON.stringify(data)}`);
  }

  const events = data.items || [];

  // Count events for this service that aren't cancelled
  const bookings = events.filter((event: any) => {
    return (
      event.extendedProperties?.private?.service_id === serviceId &&
      event.status !== 'cancelled'
    );
  });

  return bookings.length;
}
