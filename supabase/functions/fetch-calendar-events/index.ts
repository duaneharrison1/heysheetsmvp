import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { listEvents } from '../_shared/google-calendar.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { calendarId, timeMin, timeMax, maxResults = 10 } = await req.json();

    if (!calendarId) {
      throw new Error('calendarId is required');
    }

    console.log('Fetching events:', { calendarId, timeMin, timeMax, maxResults });

    // Fetch events from Google Calendar
    const events = await listEvents(calendarId, timeMin, timeMax, true);

    // Filter out cancelled events and sort by start time
    const activeEvents = events
      .filter(e => e.status !== 'cancelled')
      .sort((a, b) => {
        const aTime = new Date(a.start.dateTime || a.start.date).getTime();
        const bTime = new Date(b.start.dateTime || b.start.date).getTime();
        return aTime - bTime;
      })
      .slice(0, maxResults);

    return new Response(
      JSON.stringify({
        success: true,
        events: activeEvents,
        total: activeEvents.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
