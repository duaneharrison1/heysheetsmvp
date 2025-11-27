/**
 * Calendar booking functions for chat-completion
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createEvent, listEvents, countBookings } from '../_shared/google-calendar.ts';
import { FunctionContext } from '../_shared/types.ts';

/**
 * Get HKT (UTC+8) day boundaries for a given date string
 * Returns start and end of day in HKT timezone as ISO strings
 */
function getHKTDayBoundaries(dateStr: string): { dayStart: string; dayEnd: string } {
  // Parse date as HKT midnight: YYYY-MM-DDT00:00:00+08:00
  const dayStartHKT = new Date(`${dateStr}T00:00:00+08:00`);
  const dayEndHKT = new Date(`${dateStr}T23:59:59+08:00`);

  return {
    dayStart: dayStartHKT.toISOString(),
    dayEnd: dayEndHKT.toISOString(),
  };
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
      // Handle new format: {name: "...", serviceIds: [...]}
      if (value?.serviceIds) {
        return value.serviceIds.includes(serviceId);
      }
      // Handle legacy array format: ["S001", "S002"]
      if (Array.isArray(value)) {
        return value.includes(serviceId);
      }
      // Handle legacy string format: "S001"
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

    // Get events on that day (use HKT timezone for day boundaries)
    const { dayStart, dayEnd } = getHKTDayBoundaries(date);

    const events = await listEvents(
      calendarId,
      dayStart,
      dayEnd,
      true // singleEvents - expand recurring
    );

    console.log('[check_availability] Found events:', events.length);
    console.log('[check_availability] Day boundaries (HKT):', { dayStart, dayEnd });

    // Check if requested time falls within any availability window
    // Only match events with specific times (dateTime), not all-day events (date)
    const matchingEvent = events.find((event: any) => {
      // Skip all-day events - they don't have specific time slots
      if (!event.start.dateTime) {
        console.log('[check_availability] Skipping all-day event:', event.summary);
        return false;
      }

      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);

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

    // Extract event times
    const eventStart = new Date(matchingEvent.start.dateTime);
    const eventEnd = new Date(matchingEvent.end.dateTime);
    const eventDurationHours = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);

    // Only provide classStartTime for short events (actual class slots)
    // Long events (> 4 hours) are availability windows - use requested time instead
    let classStartTime: Date;
    let classEndTime: Date;

    if (eventDurationHours <= 4) {
      // Short event = class slot, snap to its start time
      classStartTime = eventStart;
      classEndTime = eventEnd;
      console.log('[check_availability] Class slot detected (', eventDurationHours, 'h), will snap to:', classStartTime.toISOString());
    } else {
      // Long event = availability window, use requested time
      classStartTime = requestedTime;
      classEndTime = new Date(requestedTime.getTime() + (parseInt(service.duration) || 60) * 60000);
      console.log('[check_availability] Availability window detected (', eventDurationHours, 'h), using requested time:', classStartTime.toISOString());
    }
    console.log('[check_availability] Class start time:', classStartTime.toISOString());

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
      // Include class start/end times for time snapping in createBooking
      classStartTime: classStartTime.toISOString(),
      classEndTime: classEndTime.toISOString(),
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
    class_start_time?: string; // Optional: pre-computed class start time from availability check
  },
  context: FunctionContext
): Promise<any> {
  try {
    const { storeId, authToken } = context;
    const { service_name, date, time, customer_name, customer_email, customer_phone, class_start_time } = params;

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
      console.error('[create_booking] Calendar not set up. Store:', store?.name, 'invite_calendar_id:', store?.invite_calendar_id);
      return {
        success: false,
        error: 'Calendar booking not set up',
      };
    }

    console.log('[create_booking] Store config:', {
      storeName: store.name,
      inviteCalendarId: store.invite_calendar_id,
      hasCalendarMappings: !!store.calendar_mappings
    });

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

    // Find calendar (handle multiple data formats)
    const calendarId = Object.keys(mappings).find(calId => {
      const value = mappings[calId];
      // Handle new format: {name: "...", serviceIds: [...]}
      if (value?.serviceIds) {
        return value.serviceIds.includes(serviceId);
      }
      // Handle legacy array format: ["S001", "S002"]
      if (Array.isArray(value)) {
        return value.includes(serviceId);
      }
      // Handle legacy string format: "S001"
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

    // Build requested dateTime
    const requestedDateTimeStr = `${date}T${time}:00+08:00`;
    const requestedTime = new Date(requestedDateTimeStr);
    const duration = parseInt(service.duration) || 60;

    // Time snapping: Find the actual class start time from availability calendar
    let startTime: Date;

    if (class_start_time) {
      // Use pre-computed class start time from availability check
      startTime = new Date(class_start_time);
      console.log('[create_booking] Using provided class start time:', startTime.toISOString());
    } else {
      // Look up the availability event to snap to its start time
      // Use HKT timezone for day boundaries
      const { dayStart, dayEnd } = getHKTDayBoundaries(date);

      const events = await listEvents(
        calendarId,
        dayStart,
        dayEnd,
        true // singleEvents - expand recurring
      );

      console.log('[create_booking] Found', events.length, 'events on', date);

      // Find event that contains the requested time
      // Only match events with specific times (dateTime), not all-day events
      const matchingEvent = events.find((event: any) => {
        // Skip all-day events - they don't have specific time slots
        if (!event.start.dateTime) {
          console.log('[create_booking] Skipping all-day event:', event.summary);
          return false;
        }

        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        const isMatch = requestedTime >= eventStart && requestedTime < eventEnd;

        console.log('[create_booking] Checking event:', {
          summary: event.summary,
          eventStart: eventStart.toISOString(),
          eventEnd: eventEnd.toISOString(),
          requestedTime: requestedTime.toISOString(),
          isMatch
        });

        return isMatch;
      });

      if (matchingEvent) {
        const eventStart = new Date(matchingEvent.start.dateTime);
        const eventEnd = new Date(matchingEvent.end.dateTime);
        const eventDurationHours = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60);

        // Only snap to class start time for short events (actual class slots)
        // Long events (> 4 hours) are availability windows, not fixed class times
        if (eventDurationHours <= 4) {
          startTime = eventStart;
          console.log('[create_booking] Snapped to class start time:', startTime.toISOString(), `(${eventDurationHours}h event)`);
        } else {
          // Long availability window - use the requested time
          startTime = requestedTime;
          console.log('[create_booking] Availability window detected (', eventDurationHours, 'hours), using requested time:', startTime.toISOString());
        }
      } else {
        // No matching event found - use requested time (fallback for non-class bookings)
        startTime = requestedTime;
        console.log('[create_booking] No matching event, using requested time:', startTime.toISOString());
      }
    }

    // Calculate end time using service duration from Sheet
    const endTime = new Date(startTime.getTime() + duration * 60000);
    console.log('[create_booking] Booking times - Start:', startTime.toISOString(), 'End:', endTime.toISOString(), 'Duration:', duration, 'min');

    // Use snapped start time for capacity check
    const dateTimeStr = startTime.toISOString();

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
        error: 'Fully booked',
        message: `Sorry, ${service.serviceName} is fully booked on ${date} at ${time}.`,
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

    console.log('[create_booking] Creating calendar event on calendar:', store.invite_calendar_id);
    console.log('[create_booking] Event times:', {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      duration: duration + ' min'
    });

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
        // Add customer as attendee - this makes the event appear in their calendar
        // and sends them an email invitation
        attendees: [{ email: customer_email }],
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
      'all' // Send email invites to attendees
    );

    // Log the created event details for debugging
    console.log('[create_booking] ✅ Booking created successfully:', {
      bookingId,
      calendarEventId: event?.id,
      calendarId: store.invite_calendar_id,
      eventLink: event?.htmlLink,
      summary: event?.summary,
      start: event?.start?.dateTime,
      end: event?.end?.dateTime
    });

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
