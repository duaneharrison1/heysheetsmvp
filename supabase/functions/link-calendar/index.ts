import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { listCalendars, updateEventProperties, listEvents, createCalendar, shareCalendar, createEvent } from '../_shared/google-calendar.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { storeId, serviceId, calendarId, action, serviceIds, calendarName, ownerEmail } = body;

    if (!storeId) {
      throw new Error('storeId is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ACTION: List available calendars
    if (action === 'list') {
      console.log('=== LIST CALENDARS DEBUG ===');
      console.log('Store ID:', storeId);
      console.log('Listing calendars shared with service account...');

      const calendars = await listCalendars();

      console.log('Total calendars found:', calendars.length);
      console.log('Calendar details:', JSON.stringify(calendars.map(cal => ({
        id: cal.id,
        name: cal.summary,
        accessRole: cal.accessRole,
        primary: cal.primary,
        selected: cal.selected,
      })), null, 2));

      // Filter to calendars service account can write to
      const writableCalendars = calendars.filter(cal =>
        cal.accessRole === 'owner' || cal.accessRole === 'writer'
      );

      console.log('Writable calendars:', writableCalendars.length);
      console.log('Filtered out calendars:', calendars.filter(cal =>
        cal.accessRole !== 'owner' && cal.accessRole !== 'writer'
      ).map(cal => ({
        name: cal.summary,
        accessRole: cal.accessRole,
        reason: 'Not owner/writer'
      })));

      return new Response(
        JSON.stringify({
          success: true,
          calendars: writableCalendars.map(cal => ({
            id: cal.id,
            name: cal.summary,
            description: cal.description,
            timeZone: cal.timeZone,
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Link calendar to service
    if (action === 'link') {
      if (!serviceId || !calendarId) {
        throw new Error('serviceId and calendarId are required for link action');
      }

      console.log(`Linking calendar ${calendarId} to service ${serviceId}`);

      // Get current mappings
      const { data: store } = await supabase
        .from('stores')
        .select('calendar_mappings')
        .eq('id', storeId)
        .single();

      // Parse existing mappings with new metadata structure
      type CalendarMetadata = { name: string; serviceIds: string[] };
      let mappings: Record<string, CalendarMetadata> = {};

      if (store?.calendar_mappings) {
        const raw = typeof store.calendar_mappings === 'string'
          ? JSON.parse(store.calendar_mappings)
          : store.calendar_mappings;

        // Handle legacy formats and convert to new metadata structure
        mappings = {};
        for (const [calId, value] of Object.entries(raw)) {
          if (value && typeof value === 'object' && 'serviceIds' in value) {
            // New format with metadata
            mappings[calId] = value as CalendarMetadata;
          } else if (Array.isArray(value)) {
            // Legacy array format - migrate to new structure
            mappings[calId] = {
              name: 'Availability Schedule', // Default name for legacy data
              serviceIds: value as string[]
            };
          } else {
            // Legacy string format - migrate to new structure
            mappings[calId] = {
              name: 'Availability Schedule', // Default name for legacy data
              serviceIds: [value as string]
            };
          }
        }
      }

      // Add new mapping or update existing
      if (!mappings[calendarId]) {
        // Fetch calendar name from Google Calendar API
        const calendars = await listCalendars();
        const calendar = calendars.find(cal => cal.id === calendarId);
        const calendarName = calendar?.summary || 'Availability Schedule';

        mappings[calendarId] = {
          name: calendarName,
          serviceIds: [serviceId]
        };
      } else {
        // Add service to existing calendar if not already present
        if (!mappings[calendarId].serviceIds.includes(serviceId)) {
          mappings[calendarId].serviceIds.push(serviceId);
        }
      }

      // Save (stringify following existing pattern)
      const { error: updateError } = await supabase
        .from('stores')
        .update({
          calendar_mappings: JSON.stringify(mappings)
        })
        .eq('id', storeId);

      if (updateError) {
        throw new Error(`Failed to save mapping: ${updateError.message}`);
      }

      // Add service_id to existing events in this calendar
      console.log('Adding service_id to existing events...');
      try {
        const now = new Date();
        const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

        const events = await listEvents(
          calendarId,
          now.toISOString(),
          future.toISOString(),
          true
        );

        console.log(`Found ${events.length} events to tag`);

        // Tag each event with service_id
        for (const event of events) {
          if (event.id) {
            await updateEventProperties(calendarId, event.id, {
              service_id: serviceId,
              linked_at: new Date().toISOString()
            });
          }
        }

        console.log('✅ Tagged all events');
      } catch (tagError) {
        console.error('Failed to tag events:', tagError);
        // Continue anyway - events can be tagged later
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Calendar linked to service successfully`,
          serviceId,
          calendarId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Unlink calendar from service
    if (action === 'unlink') {
      if (!calendarId) {
        throw new Error('calendarId is required for unlink action');
      }

      const { data: store } = await supabase
        .from('stores')
        .select('calendar_mappings')
        .eq('id', storeId)
        .single();

      type CalendarMetadata = { name: string; serviceIds: string[] };
      let mappings: Record<string, CalendarMetadata> = {};

      if (store?.calendar_mappings) {
        const raw = typeof store.calendar_mappings === 'string'
          ? JSON.parse(store.calendar_mappings)
          : store.calendar_mappings;

        // Handle legacy formats and migrate to new structure
        mappings = {};
        for (const [calId, value] of Object.entries(raw)) {
          if (value && typeof value === 'object' && 'serviceIds' in value) {
            // New format with metadata
            mappings[calId] = value as CalendarMetadata;
          } else if (Array.isArray(value)) {
            // Legacy array format
            mappings[calId] = {
              name: 'Availability Schedule',
              serviceIds: value as string[]
            };
          } else {
            // Legacy string format
            mappings[calId] = {
              name: 'Availability Schedule',
              serviceIds: [value as string]
            };
          }
        }
      }

      // If serviceId is provided, remove just that service from the calendar
      // Otherwise, remove the entire calendar mapping
      if (serviceId) {
        if (mappings[calendarId]) {
          mappings[calendarId].serviceIds = mappings[calendarId].serviceIds.filter(id => id !== serviceId);
          // If no services left, remove the calendar entry entirely
          if (mappings[calendarId].serviceIds.length === 0) {
            delete mappings[calendarId];
          }
        }
      } else {
        // Remove entire calendar mapping
        delete mappings[calendarId];
      }

      const { error: updateError } = await supabase
        .from('stores')
        .update({
          calendar_mappings: JSON.stringify(mappings)
        })
        .eq('id', storeId);

      if (updateError) {
        throw new Error(`Failed to remove mapping: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Calendar unlinked successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Create new calendar and auto-link to service(s)
    if (action === 'create') {
      if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
        throw new Error('serviceIds array is required for create action');
      }
      if (!calendarName || !calendarName.trim()) {
        throw new Error('calendarName is required for create action');
      }
      if (!ownerEmail) {
        throw new Error('ownerEmail is required for create action');
      }

      console.log('=== CREATE CALENDAR ===');
      console.log('Calendar name:', calendarName);
      console.log('Service IDs:', serviceIds);
      console.log('Owner email:', ownerEmail);

      try {
        // 1. Create the calendar
        const calendarId = await createCalendar(
          calendarName,
          `Availability calendar for ${calendarName}. Add events to this calendar to define when your services are bookable.`,
          'Asia/Hong_Kong'
        );

        console.log('✅ Calendar created:', calendarId);

        // 2. Share with owner (writer access)
        await shareCalendar(calendarId, ownerEmail, 'writer');
        console.log('✅ Calendar shared with:', ownerEmail);

        // 3. Auto-link to selected service(s)
        const { data: store, error: fetchError } = await supabase
          .from('stores')
          .select('calendar_mappings')
          .eq('id', storeId)
          .single();

        if (fetchError) {
          console.error('Error fetching store:', fetchError);
          throw fetchError;
        }

        // Parse existing mappings
        type CalendarMetadata = { name: string; serviceIds: string[] };
        let mappings: Record<string, CalendarMetadata> = {};

        if (store?.calendar_mappings) {
          try {
            const raw = typeof store.calendar_mappings === 'string'
              ? JSON.parse(store.calendar_mappings)
              : store.calendar_mappings;

            // Handle legacy formats and migrate to new structure
            mappings = {};
            for (const [calId, value] of Object.entries(raw)) {
              if (value && typeof value === 'object' && 'serviceIds' in value) {
                // New format with metadata
                mappings[calId] = value as CalendarMetadata;
              } else if (Array.isArray(value)) {
                // Legacy array format
                mappings[calId] = {
                  name: 'Availability Schedule',
                  serviceIds: value as string[]
                };
              } else {
                // Legacy string format
                mappings[calId] = {
                  name: 'Availability Schedule',
                  serviceIds: [value as string]
                };
              }
            }
          } catch (e) {
            console.error('Error parsing calendar_mappings:', e);
            mappings = {};
          }
        }

        // Link calendar to all selected services with the provided name
        mappings[calendarId] = {
          name: calendarName,
          serviceIds: serviceIds
        };

        console.log('Updated mappings:', mappings);

        // Save updated mappings
        const { error: updateError } = await supabase
          .from('stores')
          .update({ calendar_mappings: JSON.stringify(mappings) })
          .eq('id', storeId);

        if (updateError) {
          console.error('Error updating mappings:', updateError);
          throw updateError;
        }

        console.log('✅ Calendar linked to services:', serviceIds);

        return new Response(
          JSON.stringify({
            success: true,
            calendarId,
            message: 'Calendar created and linked successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (createError: any) {
        console.error('Error in create action:', createError);
        return new Response(
          JSON.stringify({
            success: false,
            error: createError.message || 'Failed to create calendar'
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // ACTION: Check for new events in calendar (for polling)
    if (action === 'check-events') {
      const { sinceTime } = body;

      if (!calendarId) {
        return new Response(
          JSON.stringify({ error: 'calendarId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        console.log('=== CHECK EVENTS ===');
        console.log('Calendar ID:', calendarId);
        console.log('Since time:', sinceTime);

        // List events from the calendar
        const now = new Date();
        const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead

        const events = await listEvents(
          calendarId,
          sinceTime || now.toISOString(),
          future.toISOString(),
          true
        );

        console.log(`Found ${events.length} events`);

        return new Response(
          JSON.stringify({
            found: events.length > 0,
            count: events.length,
            events: events.map((e: any) => ({
              id: e.id,
              summary: e.summary,
              start: e.start,
              end: e.end
            }))
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (checkError: any) {
        console.error('Error checking events:', checkError);
        return new Response(
          JSON.stringify({ error: 'Failed to check events', details: checkError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ACTION: Create availability events directly via API
    if (action === 'create-availability') {
      const { blocks } = body;

      if (!calendarId) {
        return new Response(
          JSON.stringify({ error: 'calendarId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
        return new Response(
          JSON.stringify({ error: 'blocks array is required and must not be empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('=== CREATE AVAILABILITY ===');
      console.log('Calendar ID:', calendarId);
      console.log('Blocks count:', blocks.length);
      console.log('Blocks:', JSON.stringify(blocks, null, 2));

      const createdEvents = [];

      for (const block of blocks) {
        try {
          const eventData: any = {
            summary: block.title || 'Available',
            description: 'Availability block created by HeySheets',
            start: {
              dateTime: block.startDateTime,
              timeZone: block.timeZone || 'Asia/Hong_Kong',
            },
            end: {
              dateTime: block.endDateTime,
              timeZone: block.timeZone || 'Asia/Hong_Kong',
            },
          };

          // Add recurrence if provided
          if (block.recurrence) {
            eventData.recurrence = [block.recurrence];
          }

          console.log('Creating event:', JSON.stringify(eventData, null, 2));

          const event = await createEvent(calendarId, eventData, 'none');

          console.log('✅ Event created:', event.id);

          createdEvents.push({
            id: event.id,
            summary: event.summary,
            start: event.start,
            end: event.end,
          });
        } catch (eventError: any) {
          console.error('Error creating event:', eventError);
          return new Response(
            JSON.stringify({
              error: 'Failed to create event',
              details: eventError.message,
              blockIndex: createdEvents.length,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log('✅ All events created:', createdEvents.length);

      return new Response(
        JSON.stringify({
          success: true,
          events: createdEvents,
          count: createdEvents.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action. Use: list, link, unlink, create, check-events, or create-availability');

  } catch (error) {
    console.error('Link calendar error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
