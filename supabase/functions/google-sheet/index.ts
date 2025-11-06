import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { JWT } from 'https://deno.land/x/google_auth_library@v0.1.0/mod.ts';
import { GoogleSpreadsheet } from 'https://esm.sh/google-spreadsheet@4.1.3';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Baked-in credentials (move to Supabase secrets later if desired)
const SERVICE_EMAIL = 'heysheets-backend@heysheets-mvp.iam.gserviceaccount.com';
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCxPluzavXlIBhv
B/0akE5hWxP3CqZjsgfEfZEj5WLLX8wk/4ZX52oxQ7bs+bIF0TXFnOcl7y13tFT8
BwnYfq+Z0l+VU77egV/1OUwqvdR4qn2sV0vRxyBVqRNAc+BhGJiBsHVhmWa+xtQa
lWTiEq0GWCR8waouOD7h3A1FJDGgv8IMLHTEaIUhFUtWhG4fVN1KPE7oikfLFQSd
A8HUxMftqBMyhhw415m+J3FphKUQ117TUTfmrg+JLu6IYek2wTyXMjqVqkVplomq
yTc7nXZ0lCVpFlYik8DhA7Bm6Neuq//twM8etDcAS9PZPFXe0/MTbKjLcOixXPtI
YCJM1R1bAgMBAAECggEABfMp8OPuTTq+lzuVa4bcmrgL+4cH/uDDEf2FGcdhgaI9
oCBTyi+iiPTU9y+Koldbjr6to8BbrmEHWU6DLhlSm79MJh8hkSaWqgy6WdT1hPd0
MIzdprUgiL+cPdWl+pxwwinCRvx3ToAuLpZFRLGLzWK4FtgJdnO86KgSaffFErhO
ykl7gHFPc7KPPZHS0hQQhBu2DQUXWKkcuGzXQ4ttjHRB3YtUdl0bIfwiZjEfaLjk
qmXdYUQs8gkPywwFRfuXsXZHz52HmXtpSWNA4Ze0lA3QSxSia+s2oDbWTz2tO1dR
+CuE0mFkn4SPoUNlAluQmXoq2MNBq2URxCnE8nbSQQKBgQDw9JopBHL5npvgZyl/
rgm8i9K1y5vcaM/cHKbonWuGgwJ+bXR8EJBLgKIcanJx4FxPw/8awsPRbQb9VQ7w
GArM5y4f6S6Zl3Rypp6WWVutaQ2F9+3wLubV3qzDFYvkuFBVur+8jGOT6Oa41LNN
UhqearrAK3CBD3ZOILFHfKRNrwKBgQC8T2TwS/drRql7rSMIDdDgfbAYj/+ZQpDd
2YxcbfWFYv1IOcJDzN3wUwRbPfaNRds/FYrs1Ymi2zlqq+YE/RliERD9ISf7ECda
agnIWVhXCWK+DtbE1xetK5hDL2Lx6bn/5vZAbjeeVLJ4XJ6lNDiFaRI4V5yDt3Vv
klN/F26iFQKBgQCKFVLHEMKm5Esl5Vi1z9HKmEJvZjhyrin4VP8drSDym99w/l7T
vlZCvnuoVyQwuEeOep6WAmlfeeCYiwcddlmyJQWcye+nm1DjZzLYrGrKTLqwPG3B
x88HXy2YOp/Jugpnpra8YaOrHrwhzdrXA6c3g6hz+jDl9StyCHAvrHEoBwKBgBM/
nla9vSW3DF36/ai2GNLJpjVsirj0x/AVa7aK+tzOmItIdCYQC+Oj6L8W31vjdxzE
q/W3giEmfYD83z9FS9HtYqotOHP+W7dvPV7AWzpSWEiLJcLrJZ1q5l5/uoJ13LBe
wG8nlQHXMIMDHKhQZTKl4dnmgrYoC5YDBAvqrkFdAoGAcWlMGnmZ3rhRZzRMfr4S
74LMDx1SY+TnkgIf/tdO4WQgiRnrhI0LFqfuORu0540tlDlrC/n8weNHlV3GEH4H
NIAmTGj+xT0A0FWZULXpbmyUXSYhEQ4nbTcX9wlRlX11ixxehPB3Ecj6DiCNhGNH
x8o8OU+8ereiJ2yVcCTggUU=
-----END PRIVATE KEY-----`;

// Simple cache
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getServiceAuth() {
  return new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );
}

function decodeJWT(token: string): { sub: string } {
  const parts = token.split('.');
  const payload = parts[1];
  const padded = payload + '='.repeat(4 - (payload.length % 4));
  return JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(padded), c => c.charCodeAt(0))
  ));
}

function extractSheetId(input: string): string {
  if (input.length === 44 && !input.includes('/')) return input;
  const match = input.match(/\/d\/([a-zA-Z0-9-_]{44})/);
  return match ? match[1] : input;
}

async function verifyAccess(req: Request, storeId: string): Promise<{ userId: string; sheetId: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const token = authHeader.replace('Bearer ', '');
  const decoded = decodeJWT(token);
  const userId = decoded.sub;

  const supabase = getSupabase();

  // Verify ownership
  const { data: userStore } = await supabase
    .from('user_stores')
    .select('id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .single();

  if (!userStore) throw new Error('Access denied');

  // Get sheet ID
  const { data: store } = await supabase
    .from('stores')
    .select('sheet_id')
    .eq('id', storeId)
    .single();

  if (!store?.sheet_id) throw new Error('No sheet connected');

  return { userId, sheetId: store.sheet_id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { operation, storeId, tabName, columns, data, sheetId: newSheetId } = body;

    // DETECT operation (no store yet, user providing sheet URL)
    if (operation === 'detect') {
      if (!newSheetId || !storeId) {
        return new Response(
          JSON.stringify({ error: 'Missing sheetId or storeId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user owns store
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = decodeJWT(token);
      const userId = decoded.sub;

      const supabase = getSupabase();
      const { data: userStore } = await supabase
        .from('user_stores')
        .select('id')
        .eq('user_id', userId)
        .eq('store_id', storeId)
        .single();

      if (!userStore) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Access sheet
      const sheetId = extractSheetId(newSheetId);
      const auth = getServiceAuth();
      const doc = new GoogleSpreadsheet(sheetId, auth);

      try {
        await doc.loadInfo();
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: `Cannot access sheet. Please share with: ${SERVICE_EMAIL}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Detect tabs
      const knownTabs = ['Hours', 'Products', 'Services', 'Bookings', 'Orders'];
      const detectedTabs: string[] = [];

      for (const sheet of doc.sheetsByIndex) {
        const matchedTab = knownTabs.find(
          known => known.toLowerCase() === sheet.title.toLowerCase()
        );
        if (matchedTab) detectedTabs.push(matchedTab);
      }

      const systemPrompt = `You are a helpful assistant for a store. Available data: ${detectedTabs.join(', ')}`;

      // Save to database
      await supabase
        .from('stores')
        .update({
          sheet_id: sheetId,
          system_prompt: systemPrompt,
          detected_tabs: JSON.stringify(detectedTabs),
        })
        .eq('id', storeId);

      return new Response(
        JSON.stringify({
          success: true,
          sheetId,
          tabs: detectedTabs,
          systemPrompt,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All other operations need verified access
    if (!storeId) {
      return new Response(
        JSON.stringify({ error: 'Missing storeId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, sheetId } = await verifyAccess(req, storeId);
    const auth = getServiceAuth();
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    // READ operation
    if (operation === 'read') {
      if (!tabName) {
        return new Response(
          JSON.stringify({ error: 'Missing tabName' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check cache (skip for bookings)
      if (tabName.toLowerCase() !== 'bookings') {
        const cacheKey = `${sheetId}:${tabName}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() < cached.expiry) {
          return new Response(
            JSON.stringify({ success: true, data: cached.data }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Find sheet
      const sheet = doc.sheetsByIndex.find(
        s => s.title.toLowerCase() === tabName.toLowerCase()
      );

      if (!sheet) {
        return new Response(
          JSON.stringify({ error: `Tab "${tabName}" not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rows = await sheet.getRows();

      // Convert to JSON
      const result = rows.map(row => {
        const obj: any = {};

        if (columns && columns.length > 0) {
          // Return only specified columns
          for (const col of columns) {
            obj[col] = row.get(col) || '';
          }
        } else {
          // Return all columns
          for (const header of sheet.headerValues) {
            obj[header] = row.get(header) || '';
          }
        }

        return obj;
      });

      // Cache result
      if (tabName.toLowerCase() !== 'bookings') {
        const cacheKey = `${sheetId}:${tabName}`;
        cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });
      }

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // APPEND operation (write new row)
    if (operation === 'append' || operation === 'write') {
      if (!tabName || !data) {
        return new Response(
          JSON.stringify({ error: 'Missing tabName or data' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sheet = doc.sheetsByIndex.find(
        s => s.title.toLowerCase() === tabName.toLowerCase()
      );

      if (!sheet) {
        return new Response(
          JSON.stringify({ error: `Tab "${tabName}" not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Append row
      await sheet.addRow(data);

      // Clear cache
      const cacheKey = `${sheetId}:${tabName}`;
      cache.delete(cacheKey);

      return new Response(
        JSON.stringify({ success: true, message: 'Row added' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE operation (modify existing rows)
    if (operation === 'update') {
      if (!tabName || !data || !data.rowIndex) {
        return new Response(
          JSON.stringify({ error: 'Missing tabName, data, or rowIndex' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sheet = doc.sheetsByIndex.find(
        s => s.title.toLowerCase() === tabName.toLowerCase()
      );

      if (!sheet) {
        return new Response(
          JSON.stringify({ error: `Tab "${tabName}" not found` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rows = await sheet.getRows();
      const row = rows[data.rowIndex];

      if (!row) {
        return new Response(
          JSON.stringify({ error: 'Row not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update row
      for (const [key, value] of Object.entries(data)) {
        if (key !== 'rowIndex') {
          row.set(key, value);
        }
      }
      await row.save();

      // Clear cache
      const cacheKey = `${sheetId}:${tabName}`;
      cache.delete(cacheKey);

      return new Response(
        JSON.stringify({ success: true, message: 'Row updated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
