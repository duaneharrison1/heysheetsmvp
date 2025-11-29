/**
 * Google Calendar URL utilities for availability setup
 */

export interface AvailabilityBlock {
  id: string;
  title: string;           // e.g., "Available" or "Morning"
  days: string[];          // ['MO', 'TU', 'WE', 'TH', 'FR']
  startTime: string;       // '09:00' (24-hour format)
  endTime: string;         // '17:00'
  isRecurring: boolean;
  specificDate?: Date;     // For one-time availability
  endDate?: Date;          // Optional recurrence end date
}

/**
 * Generate RRULE string for recurring events
 * @param days - Array of day codes: 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'
 * @param endDate - Optional end date for recurrence
 * @returns RRULE string like "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
 */
export function generateRRule(days: string[], endDate?: Date): string {
  let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')}`;

  if (endDate) {
    // Format: UNTIL=20251231T235959Z
    const year = endDate.getFullYear();
    const month = String(endDate.getMonth() + 1).padStart(2, '0');
    const day = String(endDate.getDate()).padStart(2, '0');
    rrule += `;UNTIL=${year}${month}${day}T235959Z`;
  }

  return rrule;
}

/**
 * Get the next occurrence of a weekday
 * @param dayCode - Day code like 'MO', 'TU', etc.
 * @returns Date of next occurrence
 */
function getNextOccurrence(dayCode: string): Date {
  const dayMap: Record<string, number> = {
    'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
  };

  const today = new Date();
  const targetDay = dayMap[dayCode];
  const currentDay = today.getDay();

  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) daysUntil += 7;

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
}

/**
 * Format date and times for Google Calendar URL
 * @param date - The date
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @returns Formatted string like "20251201T090000/20251201T170000"
 */
function formatDateTimeRange(date: Date, startTime: string, endTime: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const startStr = startTime.replace(':', '') + '00';
  const endStr = endTime.replace(':', '') + '00';

  return `${dateStr}T${startStr}/${dateStr}T${endStr}`;
}

/**
 * Generate Google Calendar event creation URL with pre-filled data
 * @param block - Availability block configuration
 * @param calendarId - Google Calendar ID (email format)
 * @param timezone - Timezone string (default: Asia/Hong_Kong)
 * @returns Full URL for event creation
 */
export function generateEventCreateUrl(
  block: AvailabilityBlock,
  calendarId?: string,
  timezone: string = 'Asia/Hong_Kong'
): string {
  const baseUrl = 'https://calendar.google.com/calendar/r/eventedit';
  const params = new URLSearchParams();

  // Event title
  params.set('text', block.title);

  // Timezone
  params.set('ctz', timezone);

  // Calendar ID (pre-select calendar)
  if (calendarId) {
    params.set('src', calendarId);
  }

  // Dates
  let startDate: Date;
  if (block.isRecurring && block.days.length > 0) {
    // For recurring, use next occurrence of first selected day
    startDate = getNextOccurrence(block.days[0]);
  } else if (block.specificDate) {
    startDate = block.specificDate;
  } else {
    startDate = new Date();
  }

  const dateStr = formatDateTimeRange(startDate, block.startTime, block.endTime);
  params.set('dates', dateStr);

  // Recurrence
  if (block.isRecurring && block.days.length > 0) {
    const rrule = generateRRule(block.days, block.endDate);
    params.set('recur', rrule);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate Google Calendar week view URL
 * @param date - Date to show (defaults to today)
 * @returns URL like "https://calendar.google.com/calendar/u/0/r/week/2025/12/01"
 */
export function getCalendarWeekViewUrl(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `https://calendar.google.com/calendar/u/0/r/week/${year}/${month}/${day}`;
}

/**
 * Open dual windows: full calendar view + sized event creation popup
 * The <a> tag should handle the calendar view (href + target="_blank")
 * This function handles the sized popup for event creation
 *
 * @param eventCreateUrl - URL for event creation form
 */
export function openEventPopup(eventCreateUrl: string): void {
  const width = 650;
  const height = 700;
  const left = 50;  // Position on left side
  const top = Math.round((window.screen.height - height) / 2);  // Vertically centered

  window.open(
    eventCreateUrl,
    'google_calendar_event',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );
}

/**
 * Generate time options for select dropdown
 * @returns Array of { value: string, label: string } for 30-min intervals
 */
export function generateTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];

  for (let i = 0; i < 48; i++) {
    const hours = Math.floor(i / 2);
    const minutes = (i % 2) * 30;
    const value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Format for display (12-hour with AM/PM)
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const label = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;

    options.push({ value, label });
  }

  return options;
}

/**
 * Format days array for display
 * @param days - Array of day codes
 * @returns Formatted string like "Mon, Tue, Wed, Thu, Fri"
 */
export function formatDaysForDisplay(days: string[]): string {
  const dayLabels: Record<string, string> = {
    'MO': 'Mon', 'TU': 'Tue', 'WE': 'Wed', 'TH': 'Thu',
    'FR': 'Fri', 'SA': 'Sat', 'SU': 'Sun'
  };

  // Sort days in week order
  const dayOrder = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const sortedDays = [...days].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

  return sortedDays.map(d => dayLabels[d]).join(', ');
}

/**
 * Format time for display
 * @param time24 - Time in 24-hour format (HH:MM)
 * @returns Time in 12-hour format with AM/PM
 */
export function formatTimeForDisplay(time24: string): string {
  const [hoursStr, minutes] = time24.split(':');
  const hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes} ${period}`;
}
