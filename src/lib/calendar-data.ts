import { supabase } from '@/integrations/supabase/client';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  status: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
  }>;
  extendedProperties?: {
    private?: Record<string, string>;
  };
  htmlLink: string;
}

/**
 * Fetch upcoming bookings from Customer Bookings calendar
 */
export async function fetchUpcomingBookings(
  calendarId: string,
  limit: number = 10
): Promise<CalendarEvent[]> {
  try {
    if (!calendarId) return [];

    const now = new Date();
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

    const { data, error } = await supabase.functions.invoke('fetch-calendar-events', {
      body: {
        calendarId,
        timeMin: now.toISOString(),
        timeMax: twoWeeksLater.toISOString(),
        maxResults: limit,
      },
    });

    if (error) throw error;

    return data?.events || [];
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
}

/**
 * Fetch available time slots from availability calendar
 */
export async function fetchAvailableSlots(
  calendarId: string,
  limit: number = 5
): Promise<CalendarEvent[]> {
  try {
    if (!calendarId) return [];

    const now = new Date();
    const oneWeekLater = new Date();
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);

    const { data, error } = await supabase.functions.invoke('fetch-calendar-events', {
      body: {
        calendarId,
        timeMin: now.toISOString(),
        timeMax: oneWeekLater.toISOString(),
        maxResults: limit,
      },
    });

    if (error) throw error;

    return data?.events || [];
  } catch (error) {
    console.error('Error fetching slots:', error);
    return [];
  }
}

/**
 * Format date for display
 */
export function formatEventDate(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time for display
 */
export function formatEventTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
