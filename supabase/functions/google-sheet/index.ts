import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: unresolved npm specifiers in this editor environment
import { JWT } from 'npm:google-auth-library@9.0.0';
// @ts-ignore: unresolved npm specifiers in this editor environment
import { GoogleSpreadsheet } from 'npm:google-spreadsheet@5.0.2';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getMemoryCacheData, setMemoryCacheData } from './memoryCache.ts';
import { getDatabaseCacheData, setDatabaseCacheData } from './databaseCache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id'
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

// Logging helper with request ID
function log(requestId: string | null, message: string, data?: any) {
  const prefix = requestId ? `[REQUEST_ID:${requestId}]` : '[google-sheet]';
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}
function getServiceAuth() {
  return new JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
}
function getSupabase() {
  return createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '' // ← Uses SERVICE_ROLE_KEY to bypass RLS
  );
}
function decodeJWT(token: string) {
  const parts = token.split('.');
  const payload = parts[1] || '';
  const padLen = (4 - (payload.length % 4)) % 4;
  const padded = payload + '='.repeat(padLen);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
}
function extractSheetId(input: string) {
  if (typeof input !== 'string') return null;
  if (input.length === 44 && !input.includes('/')) return input;
  const match = input.match(/\/d\/([a-zA-Z0-9-_]{44})/);
  return match ? match[1] : input;
}
// Helper to get sheet ID for a store (PUBLIC - NO AUTH REQUIRED)
async function getStoreSheetId(storeId: string) {
  const supabase = getSupabase(); // Uses SERVICE_ROLE_KEY
  const { data: store, error } = await supabase.from('stores').select('sheet_id').eq('id', storeId).single();
  if (error || !store) {
    console.error('[google-sheet] Store not found:', storeId, error?.message);
    return null;
  }
  return store.sheet_id;
}

// Check if token is the service role key (for internal service-to-service calls)
function isServiceRoleKey(token: string): boolean {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  return token === serviceRoleKey;
}

// Get sheet ID for service role access (bypasses user ownership check)
async function getSheetIdForServiceRole(storeId: string): Promise<string> {
  const supabase = getSupabase();
  const { data: store, error } = await supabase
    .from('stores')
    .select('sheet_id')
    .eq('id', storeId)
    .single();

  if (error || !store) throw new Error('Store not found');
  if (!store?.sheet_id) throw new Error('No sheet connected');
  return store.sheet_id;
}

// Legacy function for write operations that still require auth
async function verifyAccess(req: Request, storeId: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  const token = authHeader.replace('Bearer ', '');

  // Allow service role access (for internal edge function calls)
  if (isServiceRoleKey(token)) {
    const sheetId = await getSheetIdForServiceRole(storeId);
    return {
      userId: 'service-role',
      sheetId
    };
  }

  const decoded = decodeJWT(token);
  const userId = decoded.sub;
  const supabase = getSupabase();
  // Verify ownership and get sheet ID
  const { data: store, error } = await supabase.from('stores').select('sheet_id, user_id').eq('id', storeId).eq('user_id', userId).single();
  if (error || !store) throw new Error('Access denied');
  if (!store?.sheet_id) throw new Error('No sheet connected');
  return {
    userId,
    sheetId: store.sheet_id
  };
}
serve(async (req)=>{
  // Extract correlation ID from header
  const requestId = req.headers.get('X-Request-ID') || null;

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
     const body = await req.json();
     const { operation, storeId, tabName, columns, data, sheetId: newSheetId, cacheType = 'database' } = body;
     log(requestId, '📋 Operation:', { operation, storeId, tabName, cacheType });
    // ========================================
    // READ OPERATION - FULLY PUBLIC
    // ========================================
    if (operation === 'read') {
      if (!storeId || !tabName) {
        return new Response(JSON.stringify({
          error: 'Missing storeId or tabName'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Get sheet ID (NO AUTH CHECK - uses SERVICE_ROLE_KEY)
      const sheetId = await getStoreSheetId(storeId);
      if (!sheetId) {
        return new Response(JSON.stringify({
          error: 'Store not found or no sheet connected'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Check cache based on cacheType parameter
      let cachedData = null;
      if (cacheType === 'memory') {
        const cacheKey = `${sheetId}:${tabName}`;
        cachedData = getMemoryCacheData(cacheKey);
      } else if (cacheType === 'database') {
        cachedData = await getDatabaseCacheData(storeId, tabName);
      }

      if (cachedData) {
        log(requestId, '💾 Cache hit (${cacheType}): ${tabName}');
        return new Response(JSON.stringify({
          success: true,
          data: cachedData
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Access Google Sheet
      const auth = getServiceAuth();
      const doc = new GoogleSpreadsheet(sheetId, auth);
      try {
        await doc.loadInfo();
      } catch (error) {
        log(requestId, '❌ Failed to load sheet:', error);
        return new Response(JSON.stringify({
          error: 'Cannot access Google Sheet'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Find sheet
      const sheet = doc.sheetsByIndex.find((s: any) => s.title.toLowerCase() === tabName.toLowerCase());
      if (!sheet) {
        return new Response(JSON.stringify({
          error: `Tab "${tabName}" not found`
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const rows: any[] = await sheet.getRows();
      // Convert to JSON
      const result = rows.map((row: any) => {
        const obj: Record<string, any> = {};
        if (columns && columns.length > 0) {
          // Return only specified columns
          for (const col of columns) {
            obj[col] = row.get(col) || '';
          }
        } else {
          // Return all columns
          for (const header of sheet.headerValues as string[]) {
            obj[header] = row.get(header) || '';
          }
        }
        return obj;
      });
      // Save to cache based on cacheType parameter
      if (cacheType === 'memory') {
        const cacheKey = `${sheetId}:${tabName}`;
        setMemoryCacheData(cacheKey, result);
      } else if (cacheType === 'database') {
        await setDatabaseCacheData(storeId, tabName, result);
      }

      log(requestId, '✅ Read success:', `${result.length} rows from ${tabName}`);
      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ========================================
    // WRITE OPERATIONS - REQUIRE AUTH
    // ========================================
    // DETECT operation (requires auth)
    if (operation === 'detect') {
      if (!newSheetId || !storeId) {
        return new Response(JSON.stringify({
          error: 'Missing sheetId or storeId'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Verify user owns store
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({
          error: 'Missing authorization'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const token = authHeader.replace('Bearer ', '');
      const decoded = decodeJWT(token);
      const userId = decoded.sub;
      const supabase = getSupabase();
      const { data: store, error: storeError } = await supabase.from('stores').select('id').eq('id', storeId).eq('user_id', userId).single();
      if (storeError || !store) {
        return new Response(JSON.stringify({
          error: 'Access denied'
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Access sheet
      const sheetId = extractSheetId(newSheetId);
      const auth = getServiceAuth();
      const doc = new GoogleSpreadsheet(sheetId, auth);
      try {
        await doc.loadInfo();
      } catch (error) {
        return new Response(JSON.stringify({
          error: `Cannot access sheet. Please share with: ${SERVICE_EMAIL}`
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Detect ALL tabs (not just known ones) and collect schema
      const detectedTabs = [];
      const detectedSchema: Record<string, {
        columns: string[];
        sample_rows: any[];
      }> = {};

      for (const sheet of doc.sheetsByIndex) {
        const tabName = (sheet as any).title;

        // Add tab name to list
        detectedTabs.push(tabName);

        try {
          // Load header row to get column names
          await (sheet as any).loadHeaderRow();
          const headers: string[] = (sheet as any).headerValues || [];

          // Get first 3 rows as sample data
          const rows: any[] = await (sheet as any).getRows({ limit: 3 });
          const sampleRows = rows.map((row: any) => {
            const rowData: Record<string, any> = {};
            headers.forEach((header: string) => {
              rowData[header] = row.get(header) || '';
            });
            return rowData;
          });

          // Store schema for this tab
          detectedSchema[tabName] = {
            columns: headers,
            sample_rows: sampleRows,
          };
        } catch (error) {
          log(requestId, `❌ Error loading schema for tab "${tabName}":`, error);
          // Store minimal schema if error occurs
          detectedSchema[tabName] = {
            columns: [],
            sample_rows: [],
          };
        }
      }

      const systemPrompt = `You are a helpful assistant for a store. Available data: ${detectedTabs.join(', ')}`;

      // Save to database with enhanced schema
      await supabase.from('stores').update({
        sheet_id: sheetId,
        system_prompt: systemPrompt,
        detected_tabs: JSON.stringify(detectedTabs),
        detected_schema: JSON.stringify(detectedSchema)
      }).eq('id', storeId);
      return new Response(JSON.stringify({
        success: true,
        sheetId,
        tabs: detectedTabs,
        systemPrompt
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // All other write operations need verified access
    if (!storeId) {
      return new Response(JSON.stringify({
        error: 'Missing storeId'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { userId, sheetId } = await verifyAccess(req, storeId);
    const auth = getServiceAuth();
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    // APPEND operation (write new row)
    if (operation === 'append' || operation === 'write') {
      if (!tabName || !data) {
        return new Response(JSON.stringify({
          error: 'Missing tabName or data'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const sheet = doc.sheetsByIndex.find((s: any) => s.title.toLowerCase() === tabName.toLowerCase());
      if (!sheet) {
        return new Response(JSON.stringify({
          error: `Tab "${tabName}" not found`
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Append row
      await sheet.addRow(data);
      // Clear cache
      const cacheKey = `${sheetId}:${tabName}`;
      cache.delete(cacheKey);
      return new Response(JSON.stringify({
        success: true,
        message: 'Row added'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // UPDATE operation (modify existing rows)
    if (operation === 'update') {
      if (!tabName || !data || !data.rowIndex) {
        return new Response(JSON.stringify({
          error: 'Missing tabName, data, or rowIndex'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const sheet = doc.sheetsByIndex.find((s: any) => s.title.toLowerCase() === tabName.toLowerCase());
      if (!sheet) {
        return new Response(JSON.stringify({
          error: `Tab "${tabName}" not found`
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      const rows: any[] = await sheet.getRows();
      const row: any = rows[data.rowIndex];
      if (!row) {
        return new Response(JSON.stringify({
          error: 'Row not found'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Update row
      for (const [key, value] of Object.entries(data)) {
        if (key !== 'rowIndex') {
          (row as any).set(key, value);
        }
      }
      await row.save();
      // Clear cache
      const cacheKey = `${sheetId}:${tabName}`;
      cache.delete(cacheKey);
      return new Response(JSON.stringify({
        success: true,
        message: 'Row updated'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      error: 'Invalid operation'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (err: unknown) {
    const eAny = err as any;
    log(requestId, '❌ Error:', eAny);
    return new Response(JSON.stringify({
      error: eAny?.message || 'Internal error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
console.log('[google-sheet] Function loaded - VERSION 2');
