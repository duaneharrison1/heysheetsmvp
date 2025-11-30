import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Max-Age': '86400',
};

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );
}

function decodeJWT(token: string) {
  const parts = token.split('.');
  const payload = parts[1] || '';
  const padLen = (4 - (payload.length % 4)) % 4;
  const padded = payload + '='.repeat(padLen);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
}

async function verifyAdmin(authHeader: string | null): Promise<string> {
  if (!authHeader) throw new Error('Missing authorization');
  const token = authHeader.replace('Bearer ', '');
  const decoded = decodeJWT(token);
  const userId = decoded.sub;

  const supabase = getSupabase();
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching profile in verifyAdmin:', profileError);
  }

  // Allow if user is super_admin
  if (profile?.role === 'super_admin') return userId;

  // Otherwise allow if the user owns at least one store
  const { data: storesOwned, error: storesError } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (storesError) {
    console.error('Error checking store ownership in verifyAdmin:', storesError);
  }

  if (storesOwned && storesOwned.length > 0) {
    return userId;
  }

  throw new Error('Unauthorized: Admin or store owner access required');
}

function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop() || 'png';
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
  return `${baseName}-${timestamp}-${randomStr}.${ext}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const userId = await verifyAdmin(authHeader);
    const supabase = getSupabase();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const operation = pathParts[pathParts.length - 1] || 'list';

    // LIST - Get all images
    if (req.method === 'GET' && operation === 'upload-image') {
      const { data: images, error } = await supabase
        .from('admin_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data: images }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Upload or add from URL
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';

      // Handle multipart file upload
      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
          return new Response(JSON.stringify({ error: 'No file provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const fileName = generateUniqueFileName(file.name);
        const filePath = `uploads/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('admin-images')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('admin-images')
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Save metadata to database
        const { data: imageRecord, error: dbError } = await supabase
          .from('admin_images')
          .insert({
            name: file.name.replace(/\.[^/.]+$/, ''),
            url: publicUrl,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: userId,
          })
          .select()
          .single();

        if (dbError) {
          // Clean up the uploaded file
          await supabase.storage.from('admin-images').remove([filePath]);
          throw dbError;
        }

        return new Response(JSON.stringify({ success: true, data: imageRecord }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle JSON body (URL upload)
      const body = await req.json();
      
      if (body.operation === 'url') {
        const { imageUrl, name } = body;
        
        if (!imageUrl) {
          return new Response(JSON.stringify({ error: 'No image URL provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fetch the image from URL
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch image from URL');
        }

        const imageBlob = await imageResponse.blob();
        const mimeType = imageResponse.headers.get('content-type') || 'image/png';
        const ext = mimeType.split('/')[1] || 'png';
        const originalName = name || `image-from-url.${ext}`;
        const fileName = generateUniqueFileName(originalName);
        const filePath = `uploads/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('admin-images')
          .upload(filePath, imageBlob, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('admin-images')
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Save metadata to database
        const { data: imageRecord, error: dbError } = await supabase
          .from('admin_images')
          .insert({
            name: name || 'Image from URL',
            url: publicUrl,
            file_path: filePath,
            file_size: imageBlob.size,
            mime_type: mimeType,
            uploaded_by: userId,
          })
          .select()
          .single();

        if (dbError) {
          await supabase.storage.from('admin-images').remove([filePath]);
          throw dbError;
        }

        return new Response(JSON.stringify({ success: true, data: imageRecord }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle rename operation
      if (body.operation === 'rename') {
        const { id, name } = body;
        
        if (!id || !name) {
          return new Response(JSON.stringify({ error: 'Missing id or name' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await supabase
          .from('admin_images')
          .update({ name, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // DELETE - Remove image
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { id } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing image id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get image record first
      const { data: image, error: fetchError } = await supabase
        .from('admin_images')
        .select('file_path')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Delete from storage
      if (image?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('admin-images')
          .remove([image.file_path]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('admin_images')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[upload-image] Error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: err?.message?.includes('Unauthorized') ? 403 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

console.log('[upload-image] Function loaded');
