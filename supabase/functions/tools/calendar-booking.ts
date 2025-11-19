/**
 * Calendar booking functions for chat-completion
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createEvent, listEvents, countBookings } from '../_shared/google-calendar.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ToolContext {
  storeId: string;
  serviceRoleKey: string;
}

/**
 * Load sheet tab data (reuse from existing tools)
 */
async function loadSheetTab(
  storeId: string,
  tabName: string,
  serviceRoleKey: string
): Promise<any[]> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/google-sheet`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
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
  context: ToolContext
): Promise<any> {
  try {
    const { storeId, serviceRoleKey } = context;
    const { service_name, date, time } = params;

    if (!service_name || !date || !time) {
      return {
        success: false,
        needs_clarification: true,
        message: 'I need the service name, date (YYYY-MM-DD), and time (HH:MM) to check availability.',
      };
    }

    // Get store with calendar config
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('calendar_mappings, invite_calendar_id, sheet_id, detected_schema')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      return {
        success: false,
        error: 'Store not found',
      };
    }

    if (!store.invite_calendar_id) {
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

    // Get services from sheet
    const schema = JSON.parse(store.detected_schema);
    const servicesTab = findActualTabName('services', schema);

    if (!servicesTab) {
      return {
        success: false,
        error: 'Services not configured',
      };
    }

    const servicesData = await loadSheetTab(storeId, servicesTab, serviceRoleKey);

    // Find matching service (fuzzy)
    const service = servicesData.find((s: any) =>
      s.serviceName?.toLowerCase().includes(service_name.toLowerCase())
    );

    if (!service) {
      return {
        success: false,
        error: 'Service not found',
        message: `I couldn't find a service matching "${service_name}". Would you like to see all available services?`,
      };
    }

    const serviceId = service.serviceID || service.serviceName;

    // Find which calendar this service is linked to
    const calendarId = Object.keys(mappings).find(
      calId => mappings[calId] === serviceId
    );

    if (!calendarId) {
      return {
        success: false,
        error: 'Service not linked to calendar',
        message: `${service.serviceName} is not currently available for booking. Please contact us directly.`,
      };
    }

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

    // Find event at requested time
    const matchingEvent = events.find((event: any) => {
      const eventTime = new Date(event.start.dateTime);
      return Math.abs(eventTime.getTime() - requestedTime.getTime()) < 60000; // Within 1 minute
    });

    if (!matchingEvent) {
      return {
        success: false,
        available: false,
        message: `${service.serviceName} is not scheduled for ${date} at ${time}. Would you like to see available times?`,
      };
    }

    // Get capacity from service
    const capacity = parseInt(service.capacity) || 20;

    // Count existing bookings
    const bookedCount = await countBookings(
      store.invite_calendar_id,
      serviceId,
      dateTimeStr
    );

    const availableSpots = capacity - bookedCount;

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
    console.error('Check availability error:', error);
    return {
      success: false,
      error: error.message,
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
  context: ToolContext
): Promise<any> {
  try {
    const { storeId, serviceRoleKey } = context;
    const { service_name, date, time, customer_name, customer_email, customer_phone } = params;

    // Validate required fields
    if (!service_name || !date || !time || !customer_name || !customer_email) {
      return {
        success: false,
        needs_clarification: true,
        message: 'I need the service name, date, time, your name, and email to complete the booking.',
      };
    }

    // Get store
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: store } = await supabase
      .from('stores')
      .select('name, calendar_mappings, invite_calendar_id, sheet_id, detected_schema')
      .eq('id', storeId)
      .single();

    if (!store || !store.invite_calendar_id) {
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
    const servicesData = await loadSheetTab(storeId, servicesTab, serviceRoleKey);

    const service = servicesData.find((s: any) =>
      s.serviceName?.toLowerCase().includes(service_name.toLowerCase())
    );

    if (!service) {
      return {
        success: false,
        error: 'Service not found',
      };
    }

    const serviceId = service.serviceID || service.serviceName;

    // Find calendar
    const calendarId = Object.keys(mappings).find(
      calId => mappings[calId] === serviceId
    );

    if (!calendarId) {
      return {
        success: false,
        error: 'Service not available for booking',
      };
    }

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
      'all' // Send email to customer
    );

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
      message: `Booking confirmed! You'll receive a calendar invite at ${customer_email} with all the details. See you on ${date} at ${time}!`,
    };

  } catch (error) {
    console.error('Create booking error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
