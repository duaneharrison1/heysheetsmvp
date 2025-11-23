import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createCalendar, shareCalendar } from '../_shared/google-calendar.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeId, ownerEmail } = await req.json();

    if (!storeId || !ownerEmail) {
      throw new Error('storeId and ownerEmail are required');
    }

    console.log(`Setting up calendars for store: ${storeId}`);

    // Get store
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, invite_calendar_id')
      .eq('id', storeId)
      .single();

    if (storeError || !store) {
      throw new Error(`Store not found: ${storeError?.message}`);
    }

    // Check if already setup
    if (store.invite_calendar_id) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Calendar booking already set up',
          inviteCalendarId: store.invite_calendar_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Customer Invites calendar
    console.log('Creating Customer Invites calendar...');
    const inviteCalendarId = await createCalendar(
      `${store.name} - Customer Bookings`,
      'Automatic customer booking confirmations and invites',
      'Asia/Hong_Kong'
    );

    console.log(`✅ Created Invite Calendar: ${inviteCalendarId}`);

    // Share with owner (writer access for emergency rescheduling)
    console.log(`Sharing with owner: ${ownerEmail}`);
    await shareCalendar(inviteCalendarId, ownerEmail, 'writer');

    console.log('✅ Shared with owner');

    // Save to database (following existing pattern: stringify JSONB)
    const { error: updateError } = await supabase
      .from('stores')
      .update({
        invite_calendar_id: inviteCalendarId,
      })
      .eq('id', storeId);

    if (updateError) {
      throw new Error(`Failed to save calendar ID: ${updateError.message}`);
    }

    console.log('✅ Saved to database');

    return new Response(
      JSON.stringify({
        success: true,
        inviteCalendarId,
        message: 'Calendar booking enabled! You can now link your service calendars.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Setup calendars error:', errMsg, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
