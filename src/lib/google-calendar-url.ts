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

// ============================================
// Smart View Selection Helpers
// ============================================

export interface SmartViewResult {
  mode: 'WEEK' | 'MONTH' | 'AGENDA';
  startDate: Date;
}

/**
 * Determines the best calendar view based on event time visibility
 * If the event hours would be visible in WEEK view at current time, use WEEK
 * Otherwise use MONTH view so user can at least see the event exists
 */
export function getSmartCalendarView(
  eventStartHour: number,      // e.g., 9 for 9am
  eventEndHour: number,        // e.g., 17 for 5pm
  eventStartDate: Date,        // When the event/recurrence starts
): SmartViewResult {

  const now = new Date();
  const currentHour = now.getHours();

  // Check if event time is visible in current hour window
  // Week view typically shows ~12 hour window, we use ±8 hours as safe margin
  const hourDiffToStart = Math.abs(currentHour - eventStartHour);
  const hourDiffToEnd = Math.abs(currentHour - eventEndHour);
  const isTimeVisible = hourDiffToStart <= 8 || hourDiffToEnd <= 8;

  if (isTimeVisible) {
    // WEEK view, starting from event start date
    return {
      mode: 'WEEK',
      startDate: eventStartDate
    };
  } else {
    // MONTH view, starting from first of that month
    const monthStart = new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), 1);
    return {
      mode: 'MONTH',
      startDate: monthStart
    };
  }
}

/**
 * Parse time string to hour number
 * e.g., "09:00" -> 9, "17:30" -> 17
 */
export function parseTimeToHour(timeString: string): number {
  const [hours] = timeString.split(':').map(Number);
  return hours;
}

// ============================================
// Calendar Embed URL
// ============================================

/**
 * Generate Google Calendar embed URL with mode and date parameters
 */
export function getCalendarEmbedUrl(
  calendarId: string,
  startDate?: Date,
  mode: 'WEEK' | 'MONTH' | 'AGENDA' = 'WEEK'
): string {
  const formatDateForUrl = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');

  // Default to today if no date provided
  const start = startDate || new Date();

  // Calculate end date based on mode
  let end: Date;
  if (mode === 'MONTH') {
    // End of month
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  } else {
    // End of week (7 days)
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  }

  const params = new URLSearchParams({
    src: calendarId,
    mode: mode,
    showTitle: '0',
    showNav: '1',
    showPrint: '0',
    showTabs: '0',
    showCalendars: '0',
    ctz: 'Asia/Hong_Kong',
    dates: `${formatDateForUrl(start)}/${formatDateForUrl(end)}`
  });

  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}
