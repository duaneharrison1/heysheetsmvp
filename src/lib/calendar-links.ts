/**
 * Calendar linking utilities
 */

/**
 * Get embed link for viewing ONLY specific calendar
 * Opens in clean view with no other calendars visible
 */
export function getCalendarEmbedLink(
  calendarId: string,
  options: {
    mode?: 'AGENDA' | 'WEEK' | 'MONTH' | 'DAY';
    timezone?: string;
  } = {}
): string {
  const {
    mode = 'AGENDA',
    timezone = 'Asia/Hong_Kong',
  } = options;

  const params = new URLSearchParams({
    src: calendarId,
    ctz: timezone,
    mode,
    showTitle: '1',
    showPrint: '0',
    showCalendars: '0',
    showTz: '0',
    showNav: '1',
  });

  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

/**
 * Get direct link for editing calendar
 * Opens full Google Calendar with editing capabilities
 */
export function getCalendarEditLink(calendarId: string): string {
  return `https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(calendarId)}`;
}

/**
 * Get link to open calendar in regular view (not embed)
 * User can add/edit events in this view
 */
export function getCalendarViewLink(calendarId: string): string {
  return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId)}`;
}

/**
 * Get link to a specific event
 */
export function getEventLink(calendarId: string, eventId: string): string {
  return `https://calendar.google.com/calendar/u/0/r/eventedit/${eventId}?cid=${encodeURIComponent(calendarId)}`;
}

/**
 * Get calendar settings link
 */
export function getCalendarSettingsLink(calendarId: string): string {
  return `https://calendar.google.com/calendar/u/0/r/settings/calendar/${encodeURIComponent(calendarId)}`;
}
