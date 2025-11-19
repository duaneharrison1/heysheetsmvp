import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { listCalendars, updateEventProperties, listEvents, subscribeToCalendar, createCalendar, shareCalendar } from '../_shared/google-calendar.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, serviceId, calendarId, action, serviceName, ownerEmail } = await req.json();

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

    // ACTION: Create availability calendar for a service
    if (action === 'create') {
      if (!serviceId || !serviceName || !ownerEmail) {
        throw new Error('serviceId, serviceName, and ownerEmail are required for create action');
      }

      console.log(`Creating availability calendar for service: ${serviceName}`);

      // Get store name for calendar title
      const { data: store } = await supabase
        .from('stores')
        .select('name')
        .eq('id', storeId)
        .single();

      const storeName = store?.name || 'Store';

      // Create calendar owned by service account
      const newCalendarId = await createCalendar(
        `${serviceName} - Availability`,
        `Availability schedule for ${serviceName} at ${storeName}. Add events to this calendar to mark when the service is available for booking.`,
        'Asia/Hong_Kong'
      );

      console.log(`✅ Created availability calendar: ${newCalendarId}`);

      // Share with owner so they can manage availability
      await shareCalendar(newCalendarId, ownerEmail, 'writer');
      console.log(`✅ Shared with owner: ${ownerEmail}`);

      // Auto-link to the service
      const { data: storeData } = await supabase
        .from('stores')
        .select('calendar_mappings')
        .eq('id', storeId)
        .single();

      const mappings = storeData?.calendar_mappings
        ? JSON.parse(storeData.calendar_mappings)
        : {};

      mappings[newCalendarId] = serviceId;

      const { error: updateError } = await supabase
        .from('stores')
        .update({
          calendar_mappings: JSON.stringify(mappings),
        })
        .eq('id', storeId);

      if (updateError) {
        throw new Error(`Failed to link calendar: ${updateError.message}`);
      }

      console.log(`✅ Auto-linked calendar to service ${serviceId}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Availability calendar created and linked to ${serviceName}!`,
          calendarId: newCalendarId,
          serviceId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Subscribe to a shared calendar
    if (action === 'subscribe') {
      if (!calendarId) {
        throw new Error('calendarId is required for subscribe action');
      }

      console.log(`Subscribing service account to calendar: ${calendarId}`);

      try {
        await subscribeToCalendar(calendarId);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Calendar subscribed successfully. Refresh the calendar list to see it.',
            calendarId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: any) {
        console.error('Subscribe error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            hint: 'Make sure the calendar is shared with heysheets-backend@heysheets-mvp.iam.gserviceaccount.com with "Make changes to events" permission'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
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

      // Parse existing mappings (following existing pattern)
      let mappings: Record<string, string> = {};
      if (store?.calendar_mappings) {
        mappings = typeof store.calendar_mappings === 'string'
          ? JSON.parse(store.calendar_mappings)
          : store.calendar_mappings;
      }

      // Add new mapping
      mappings[calendarId] = serviceId;

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

      let mappings: Record<string, string> = {};
      if (store?.calendar_mappings) {
        mappings = typeof store.calendar_mappings === 'string'
          ? JSON.parse(store.calendar_mappings)
          : store.calendar_mappings;
      }

      // Remove mapping
      delete mappings[calendarId];

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

    throw new Error('Invalid action. Use: list, create, subscribe, link, or unlink');

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
