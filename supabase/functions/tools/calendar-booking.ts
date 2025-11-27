/**
 * Calendar booking functions for chat-completion
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createEvent, listEvents, countBookings } from '../_shared/google-calendar.ts';
import { FunctionContext } from '../_shared/types.ts';

/**
 * Extract date (YYYY-MM-DD) from ISO datetime string
 * Preserves the original timezone from the calendar
 * Example: "2025-11-28T09:00:00+08:00" → "2025-11-28"
 */
function extractDateFromISO(isoString: string): string {
  return isoString.split('T')[0];
}

/**
 * Extract time (HH:MM) from ISO datetime string
 * Preserves the original timezone from the calendar
 * Example: "2025-11-28T09:00:00+08:00" → "09:00"
 */
function extractTimeFromISO(isoString: string): string {
  const timePart = isoString.split('T')[1];  // "09:00:00+08:00" or "09:00:00Z"
  return timePart.slice(0, 5);  // "09:00"
}

/**
 * Load sheet tab data (reuse from existing tools)
 */
async function loadSheetTab(
  storeId: string,
  tabName: string,
  authToken: string
): Promise<any[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL not set');
    throw new Error('SUPABASE_URL environment variable not set');
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/google-sheet`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'read',
        storeId,
        tabName,
      }),
    }
  );

  const result = await response.json();
  return result.success ? result.data : [];
}

/**
 * Find actual tab name (fuzzy match)
 */
function findActualTabName(target: string, schema: any): string | null {
  const targetLower = target.toLowerCase();
  const tabNames = Object.keys(schema);

  return tabNames.find(name =>
    name.toLowerCase().includes(targetLower) ||
    targetLower.includes(name.toLowerCase())
  ) || null;
}

/**
 * Generate time slots within an availability window
 * @param startTime - Start time in HH:MM format (e.g., "09:00")
 * @param endTime - End time in HH:MM format (e.g., "18:45")
 * @param durationMinutes - Slot duration in minutes (e.g., 120)
 * @returns Array of time strings (e.g., ["09:00", "11:00", "13:00", "15:00"])
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number
): string[] {
  const slots: string[] = [];

  // Parse times to minutes since midnight
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Generate slots until we can't fit another full duration
  while (currentMinutes + durationMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    currentMinutes += durationMinutes;
  }

  return slots;
}

/**
 * Calculate end time given start time and duration
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const endMinutes = h * 60 + m + durationMinutes;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * Check availability for a service
 */
export async function checkAvailability(
  params: { service_name?: string; date?: string; time?: string },
  context: FunctionContext
): Promise<any> {
  try {
    const { storeId, authToken } = context;
    const { service_name, date, time } = params;

    console.log('[check_availability] Called with:', { service_name, date, time, storeId });

    if (!service_name || !date || !time) {
      return {
        success: false,
        needs_clarification: true,
        message: 'I need the service name, date (YYYY-MM-DD), and time (HH:MM) to check availability.',
      };
    }

    // Get SUPABASE_URL from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      console.error('❌ SUPABASE_URL not set');
      throw new Error('SUPABASE_URL environment variable not set');
    }

    console.log('[check_availability] Creating Supabase client...');

    // Get store with calendar config
    const supabase = createClient(supabaseUrl, authToken);
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('calendar_mappings, invite_calendar_id, sheet_id, detected_schema')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      console.error('[check_availability] Store not found:', storeError);
      return {
        success: false,
        error: 'Store not found',
      };
    }

    if (!store.invite_calendar_id) {
      console.log('[check_availability] Calendar booking not set up');
      return {
        success: false,
        error: 'Calendar booking not set up for this store',
        message: 'Calendar booking is not enabled. Please contact the store owner.',
      };
    }

    // Parse calendar mappings
    const mappings = store.calendar_mappings
      ? (typeof store.calendar_mappings === 'string'
          ? JSON.parse(store.calendar_mappings)
          : store.calendar_mappings)
      : {};

    console.log('[check_availability] Calendar mappings:', mappings);

    // Get services from sheet
    const schema = JSON.parse(store.detected_schema);
    const servicesTab = findActualTabName('services', schema);

    if (!servicesTab) {
      console.error('[check_availability] Services tab not found in schema');
      return {
        success: false,
        error: 'Services not configured',
      };
    }

    const servicesData = await loadSheetTab(storeId, servicesTab, authToken);
    console.log('[check_availability] Found services:', servicesData.length);

    // Find matching service (fuzzy)
    const service = servicesData.find((s: any) =>
      s.serviceName?.toLowerCase().includes(service_name.toLowerCase())
    );

    if (!service) {
      console.log('[check_availability] Service not found:', service_name);
      return {
        success: false,
        error: 'Service not found',
        message: `I couldn't find a service matching "${service_name}". Would you like to see all available services?`,
      };
    }

    const serviceId = service.serviceID || service.serviceName;
    console.log('[check_availability] Found service:', serviceId);

    // Find which calendar this service is linked to
    const calendarId = Object.keys(mappings).find(calId => {
      const value = mappings[calId];
      // New format: {name: "...", serviceIds: [...]}
      if (value?.serviceIds) {
        return value.serviceIds.includes(serviceId);
      }
      // Legacy array format: ["S001", "S002"]
      if (Array.isArray(value)) {
        return value.includes(serviceId);
      }
      // Legacy string format: "S001"
      if (typeof value === 'string') {
        return value === serviceId;
      }
      return false;
    });

    if (!calendarId) {
      console.log('[check_availability] Service not linked to any calendar');
      return {
        success: false,
        error: 'Service not linked to calendar',
        message: `${service.serviceName} is not currently available for booking. Please contact us directly.`,
      };
    }

    console.log('[check_availability] Service linked to calendar:', calendarId);

    // Build dateTime for search
    const dateTimeStr = `${date}T${time}:00+08:00`;
    const requestedTime = new Date(dateTimeStr);

    // Get events on that day
    const dayStart = new Date(requestedTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const events = await listEvents(
      calendarId,
      dayStart.toISOString(),
      dayEnd.toISOString(),
      true // singleEvents - expand recurring
    );

    console.log('[check_availability] Found events:', events.length);

    // Check if requested time falls within any availability window
    const matchingEvent = events.find((event: any) => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);

      // Check if requested time is within this event's time range
      return requestedTime >= eventStart && requestedTime < eventEnd;
    });

    if (!matchingEvent) {
      console.log('[check_availability] Requested time not within any availability window');
      console.log('[check_availability] Requested time:', requestedTime.toISOString());

      // Log event times for debugging
      events.forEach((event: any, i: number) => {
        console.log(`[check_availability] Event ${i + 1}:`, {
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          summary: event.summary
        });
      });

      return {
        success: false,
        available: false,
        message: `${service.serviceName} is not available on ${date} at ${time}. Would you like to see available times?`,
      };
    }

    console.log('[check_availability] Found matching availability window:', matchingEvent.summary);

    // Get capacity from service
    const capacity = parseInt(service.capacity) || 20;

    // Count existing bookings
    const bookedCount = await countBookings(
      store.invite_calendar_id,
      serviceId,
      dateTimeStr
    );

    const availableSpots = capacity - bookedCount;
    console.log('[check_availability] Capacity:', capacity, 'Booked:', bookedCount, 'Available:', availableSpots);

    return {
      success: true,
      available: availableSpots > 0,
      service: service.serviceName,
      date,
      time,
      capacity,
      booked: bookedCount,
      available_spots: availableSpots,
      price: service.price,
      duration: service.duration,
      message: availableSpots > 0
        ? `Yes! ${service.serviceName} is available on ${date} at ${time}. ${availableSpots} spot${availableSpots > 1 ? 's' : ''} remaining. Price: $${service.price}`
        : `Sorry, ${service.serviceName} is fully booked on ${date} at ${time}. Would you like to try another time?`,
    };

  } catch (error) {
    console.error('[check_availability] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg || 'Unknown error checking availability',
    };
  }
}

/**
 * Get available booking slots for a service
 * Shows calendar availability from Google Calendar
 */
export async function getBookingSlots(
  params: {
    service_name: string
    start_date?: string  // YYYY-MM-DD, default: today
    end_date?: string    // YYYY-MM-DD, default: today + 14 days
    // Prefill data extracted from user message
    prefill_date?: string
    prefill_time?: string
    prefill_name?: string
    prefill_email?: string
    prefill_phone?: string
  },
  context: FunctionContext
): Promise<any> {
  try {
    const { storeId, authToken } = context;
    const {
      service_name,
      start_date,
      end_date,
      prefill_date,
      prefill_time,
      prefill_name,
      prefill_email,
      prefill_phone
    } = params;

    console.log('[get_booking_slots] Called with:', { service_name, start_date, end_date, prefill_date, prefill_time });

    if (!service_name) {
      return {
        success: false,
        needs_clarification: true,
        message: 'Which service would you like to book?',
      };
    }

    // Get SUPABASE_URL from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      console.error('❌ SUPABASE_URL not set');
      throw new Error('SUPABASE_URL environment variable not set');
    }

    // Get store with calendar config
    const supabase = createClient(supabaseUrl, authToken);
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('name, calendar_mappings, invite_calendar_id, sheet_id, detected_schema')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      console.error('[get_booking_slots] Store not found:', storeError);
      return {
        success: false,
        error: 'Store not found',
      };
    }

    if (!store.invite_calendar_id) {
      console.log('[get_booking_slots] Calendar booking not set up');
      return {
        success: false,
        error: 'Calendar booking not set up for this store',
        message: 'Calendar booking is not enabled. Please contact the store owner.',
      };
    }

    // Parse calendar mappings
    const mappings = store.calendar_mappings
      ? (typeof store.calendar_mappings === 'string'
          ? JSON.parse(store.calendar_mappings)
          : store.calendar_mappings)
      : {};

    console.log('[get_booking_slots] Calendar mappings:', mappings);

    // Get services from sheet
    const schema = JSON.parse(store.detected_schema);
    const servicesTab = findActualTabName('services', schema);

    if (!servicesTab) {
      console.error('[get_booking_slots] Services tab not found in schema');
      return {
        success: false,
        error: 'Services not configured',
      };
    }

    const servicesData = await loadSheetTab(storeId, servicesTab, authToken);
    console.log('[get_booking_slots] Found services:', servicesData.length);

    // Find matching service (fuzzy)
    const service = servicesData.find((s: any) =>
      s.serviceName?.toLowerCase().includes(service_name.toLowerCase())
    );

    if (!service) {
      console.log('[get_booking_slots] Service not found:', service_name);
      return {
        success: false,
        message: `I couldn't find a service matching "${service_name}". Would you like to see our available services?`,
        components: [{
          type: 'quick_actions',
          props: { actions: ['Show services'] }
        }]
      };
    }

    const serviceId = service.serviceID || service.serviceName;
    console.log('[get_booking_slots] Found service:', serviceId);

    // Find which calendar this service is linked to
    const calendarId = Object.keys(mappings).find(calId => {
      const value = mappings[calId];
      if (value?.serviceIds) {
        return value.serviceIds.includes(serviceId);
      }
      if (Array.isArray(value)) {
        return value.includes(serviceId);
      }
      if (typeof value === 'string') {
        return value === serviceId;
      }
      return false;
    });

    if (!calendarId) {
      console.log('[get_booking_slots] Service not linked to any calendar');
      return {
        success: false,
        message: `Booking is not yet set up for ${service.serviceName}. Please contact us directly.`,
      };
    }

    console.log('[get_booking_slots] Service linked to calendar:', calendarId);

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDateObj = start_date
      ? new Date(start_date + 'T00:00:00+08:00')
      : today;

    const endDateObj = end_date
      ? new Date(end_date + 'T23:59:59+08:00')
      : new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 days

    console.log('[get_booking_slots] Date range:', startDateObj.toISOString(), 'to', endDateObj.toISOString());

    // Query availability calendar for events
    const availabilityEvents = await listEvents(
      calendarId,
      startDateObj.toISOString(),
      endDateObj.toISOString(),
      true // singleEvents - expand recurring
    );

    console.log('[get_booking_slots] Found availability events:', availabilityEvents.length);

    // Get capacity and duration from service
    const capacity = parseInt(service.capacity) || 8;
    const duration = parseInt(service.duration) || 120; // Default 2 hours

    console.log('[get_booking_slots] Service info:', { capacity, duration });

    // Build slots with availability
    const slots: Array<{
      date: string
      time: string
      endTime: string
      spotsLeft: number
    }> = [];

    for (const event of availabilityEvents) {
      // Skip all-day events
      if (!event.start.dateTime || !event.end.dateTime) continue;

      // Extract date/time directly from ISO string - preserves calendar timezone
      const dateStr = extractDateFromISO(event.start.dateTime);
      const availStart = extractTimeFromISO(event.start.dateTime);
      const availEnd = extractTimeFromISO(event.end.dateTime);

      // Skip if event is in the past (compare using the event's actual datetime)
      const eventEnd = new Date(event.end.dateTime);
      if (eventEnd < new Date()) continue;

      console.log(`[get_booking_slots] Availability: ${dateStr} ${availStart}-${availEnd}`);

      // Generate time slots within this availability window
      const timeSlots = generateTimeSlots(availStart, availEnd, duration);

      console.log(`[get_booking_slots] Generated ${timeSlots.length} slots:`, timeSlots);

      // For each generated time slot, check bookings and add to slots
      for (const time of timeSlots) {
        // Count existing bookings for this slot
        const dateTimeStr = `${dateStr}T${time}:00+08:00`;
        const bookedCount = await countBookings(
          store.invite_calendar_id,
          serviceId,
          dateTimeStr
        );

        const spotsLeft = capacity - bookedCount;

        console.log(`[get_booking_slots] Slot ${dateStr} ${time}: ${spotsLeft} spots left (${bookedCount} booked)`);

        // Only add slots with available spots
        if (spotsLeft > 0) {
          slots.push({
            date: dateStr,
            time: time,
            endTime: calculateEndTime(time, duration),
            spotsLeft: spotsLeft
          });
        }
      }
    }

    // Sort by date, then time
    slots.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

    console.log('[get_booking_slots] Total slots found:', slots.length);

    // Find dates with no availability (for disabling in calendar)
    // Use local date formatting to avoid timezone issues
    const allDatesInRange: string[] = [];
    const cursor = new Date(startDateObj);
    while (cursor <= endDateObj) {
      // Format as YYYY-MM-DD using local date parts
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, '0');
      const day = String(cursor.getDate()).padStart(2, '0');
      allDatesInRange.push(`${year}-${month}-${day}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    const datesWithSlots = [...new Set(slots.map(s => s.date))];
    const unavailableDates = allDatesInRange.filter(d => !datesWithSlots.includes(d));

    // Build intelligent message
    let message = `Here are available times for ${service.serviceName}:`;

    if (slots.length === 0) {
      message = `Unfortunately, there are no available times for ${service.serviceName} in the next 2 weeks. Would you like to check a different service?`;
    } else if (prefill_date && !datesWithSlots.includes(prefill_date)) {
      message = `${prefill_date} doesn't have availability for ${service.serviceName}. Here are the dates that do:`;
    } else if (prefill_date && prefill_time) {
      const matchingSlot = slots.find(
        s => s.date === prefill_date && s.time === prefill_time
      );
      if (matchingSlot && matchingSlot.spotsLeft > 0) {
        message = `Great news! ${prefill_time} on ${prefill_date} is available. Just need a few details to confirm:`;
      } else if (matchingSlot && matchingSlot.spotsLeft <= 0) {
        message = `Sorry, ${prefill_time} on ${prefill_date} is fully booked. Here are other available times:`;
      } else {
        // Time doesn't match any class - find closest
        const slotsOnDate = slots.filter(s => s.date === prefill_date);
        if (slotsOnDate.length > 0) {
          message = `There's no class at ${prefill_time}, but here are the times available on ${prefill_date}:`;
        }
      }
    }

    // Return with component
    return {
      success: true,
      message,
      data: {
        service: {
          id: serviceId,
          name: service.serviceName,
          duration: service.duration,
          price: service.price
        },
        slotsCount: slots.length,
        datesAvailable: datesWithSlots.length
      },
      components: [{
        id: `booking-calendar-${storeId}-${Date.now()}`,
        type: 'BookingCalendar',
        props: {
          service: {
            id: serviceId,
            name: service.serviceName,
            duration: service.duration ? `${service.duration} min` : undefined,
            price: service.price
          },
          slots,
          unavailableDates,
          prefill: {
            date: prefill_date,
            time: prefill_time,
            name: prefill_name,
            email: prefill_email,
            phone: prefill_phone
          }
        }
      }],
      componentsVersion: '1'
    };

  } catch (error) {
    console.error('[get_booking_slots] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg || 'Unknown error getting booking slots',
      message: 'Sorry, I had trouble checking availability. Please try again.',
    };
  }
}

/**
 * Create a booking
 */
export async function createBooking(
  params: {
    service_name: string;
    date: string;
    time: string;
    customer_name: string;
    customer_email: string;
    customer_phone?: string;
  },
  context: FunctionContext
): Promise<any> {
  try {
    const { storeId, authToken } = context;
    const { service_name, date, time, customer_name, customer_email, customer_phone } = params;

    console.log('[create_booking] Called with:', { service_name, date, time, customer_name, customer_email });

    // Validate required fields
    if (!service_name || !date || !time || !customer_name || !customer_email) {
      return {
        success: false,
        needs_clarification: true,
        message: 'I need the service name, date, time, your name, and email to complete the booking.',
      };
    }

    // Get SUPABASE_URL from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      console.error('❌ SUPABASE_URL not set');
      throw new Error('SUPABASE_URL environment variable not set');
    }

    // Get store
    const supabase = createClient(supabaseUrl, authToken);
    const { data: store } = await supabase
      .from('stores')
      .select('name, calendar_mappings, invite_calendar_id, sheet_id, detected_schema')
      .eq('id', storeId)
      .single();

    if (!store || !store.invite_calendar_id) {
      console.error('[create_booking] Calendar not set up');
      return {
        success: false,
        error: 'Calendar booking not set up',
      };
    }

    // Parse mappings
    const mappings = store.calendar_mappings
      ? (typeof store.calendar_mappings === 'string'
          ? JSON.parse(store.calendar_mappings)
          : store.calendar_mappings)
      : {};

    // Get service from sheet
    const schema = JSON.parse(store.detected_schema);
    const servicesTab = findActualTabName('services', schema);
    if (!servicesTab) {
      console.error('[create_booking] Services tab not found in schema');
      return {
        success: false,
        error: 'Services not configured',
      };
    }
    const servicesData = await loadSheetTab(storeId, servicesTab, authToken);

    const service = servicesData.find((s: any) =>
      s.serviceName?.toLowerCase().includes(service_name.toLowerCase())
    );

    if (!service) {
      console.error('[create_booking] Service not found');
      return {
        success: false,
        error: 'Service not found',
      };
    }

    const serviceId = service.serviceID || service.serviceName;
    console.log('[create_booking] Found service:', serviceId);

    // Find calendar
    const calendarId = Object.keys(mappings).find(calId => {
      const value = mappings[calId];
      // New format: {name: "...", serviceIds: [...]}
      if (value?.serviceIds) {
        return value.serviceIds.includes(serviceId);
      }
      // Legacy array format: ["S001", "S002"]
      if (Array.isArray(value)) {
        return value.includes(serviceId);
      }
      // Legacy string format: "S001"
      if (typeof value === 'string') {
        return value === serviceId;
      }
      return false;
    });

    if (!calendarId) {
      console.error('[create_booking] Service not linked to calendar');
      return {
        success: false,
        error: 'Service not available for booking',
      };
    }

    // ============================================
    // VALIDATE: Check if availability event exists
    // ============================================
    const dayStart = new Date(`${date}T00:00:00+08:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    console.log('[create_booking] Checking availability events for:', date);

    const availabilityEvents = await listEvents(
      calendarId,  // The availability calendar from calendar_mappings
      dayStart.toISOString(),
      dayEnd.toISOString(),
      true  // singleEvents - expand recurring
    );

    console.log('[create_booking] Found availability events:', availabilityEvents.length);

    // Build the requested datetime
    const requestedTime = new Date(`${date}T${time}:00+08:00`);

    // Find an availability event that contains the requested time
    const matchingEvent = availabilityEvents.find((event: any) => {
      // Skip all-day events (no dateTime)
      if (!event.start.dateTime || !event.end.dateTime) {
        return false;
      }

      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);

      // Check if requested time falls within this event
      return requestedTime >= eventStart && requestedTime < eventEnd;
    });

    if (!matchingEvent) {
      console.log('[create_booking] No availability event found for:', date, time);
      return {
        success: false,
        error: 'no_class_scheduled',
        message: `Sorry, ${service.serviceName} doesn't have any classes scheduled on ${date} at ${time}. This date/time isn't on the calendar yet. Would you like to try a different date?`,
      };
    }

    console.log('[create_booking] Found matching availability event:', matchingEvent.summary);
    // ============================================
    // END: Availability validation
    // ============================================

    // Build dateTime
    const dateTimeStr = `${date}T${time}:00+08:00`;
    const startTime = new Date(dateTimeStr);
    const duration = parseInt(service.duration) || 60;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Check capacity
    const capacity = parseInt(service.capacity) || 20;
    const bookedCount = await countBookings(
      store.invite_calendar_id,
      serviceId,
      dateTimeStr
    );

    if (bookedCount >= capacity) {
      console.log('[create_booking] Fully booked');
      return {
        success: false,
        error: 'fully_booked',
        message: `Sorry, ${service.serviceName} is fully booked on ${date} at ${time}. All ${capacity} spots are taken. Would you like to try another time?`,
      };
    }

    // Generate booking ID
    const bookingId = `bk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create calendar invite
    const eventDescription = `
Booking Confirmation

Service: ${service.serviceName}
Price: $${service.price || 'N/A'}
Duration: ${duration} minutes

Customer Details:
Name: ${customer_name}
Email: ${customer_email}
${customer_phone ? `Phone: ${customer_phone}` : ''}

Thank you for booking with ${store.name}!
If you need to reschedule or cancel, please contact us.
    `.trim();

    console.log('[create_booking] Creating calendar event...');

    const event = await createEvent(
      store.invite_calendar_id,
      {
        summary: `${service.serviceName} - ${customer_name}`,
        description: eventDescription,
        location: service.location || '',
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Asia/Hong_Kong',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Hong_Kong',
        },
        // Note: Service accounts cannot add attendees without Domain-Wide Delegation
        // Customer info is stored in description and extendedProperties instead
        extendedProperties: {
          private: {
            booking_id: bookingId,
            service_id: serviceId,
            customer_name,
            customer_email,
            customer_phone: customer_phone || '',
            booked_at: new Date().toISOString(),
          },
        },
      },
      'none' // Don't send email updates (service account cannot send invites)
    );

    console.log('[create_booking] ✅ Booking created successfully:', bookingId);

    return {
      success: true,
      booking_id: bookingId,
      service: service.serviceName,
      date,
      time,
      duration,
      price: service.price,
      customer_name,
      customer_email,
      available_spots_remaining: capacity - bookedCount - 1,
      message: `Booking confirmed for ${service.serviceName} on ${date} at ${time}! Your confirmation details have been saved. See you there!`,
    };

  } catch (error) {
    console.error('[create_booking] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMsg || 'Unknown error creating booking',
    };
  }
}
