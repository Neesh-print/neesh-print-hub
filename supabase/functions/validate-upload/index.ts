import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'image/gif',
];

// Magic bytes for file type validation
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header, need to check for WEBP at offset 8
};

function validateMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  const patterns = MAGIC_BYTES[mimeType];
  if (!patterns) return false;
  
  for (const pattern of patterns) {
    let matches = true;
    for (let i = 0; i < pattern.length; i++) {
      if (bytes[i] !== pattern[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      // Special case for WebP: check for WEBP signature at offset 8
      if (mimeType === 'image/webp') {
        const webpSignature = [0x57, 0x45, 0x42, 0x50]; // WEBP
        for (let i = 0; i < 4; i++) {
          if (bytes[8 + i] !== webpSignature[i]) {
            return false;
          }
        }
      }
      return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string;
    const folder = formData.get('folder') as string || 'uploads';

    if (!file || !bucket) {
      return new Response(
        JSON.stringify({ error: 'Missing file or bucket parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate bucket name (prevent path traversal)
    const allowedBuckets = ['magazine-assets', 'applications', 'product-images'];
    if (!allowedBuckets.includes(bucket)) {
      return new Response(
        JSON.stringify({ error: 'Invalid bucket' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate MIME type from Content-Type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read file bytes and validate magic bytes (prevents MIME type spoofing)
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    if (!validateMagicBytes(bytes, file.type)) {
      console.log('Magic bytes validation failed for file type:', file.type);
      return new Response(
        JSON.stringify({ error: 'File content does not match declared type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate safe file path
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 100);
    const path = `${user.id}/${folder}/${timestamp}-${safeName}`;

    // Use service role client for upload
    const supabaseServiceRole = createClient(
      supabaseUrl, 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Upload file
    const { data, error: uploadError } = await supabaseServiceRole.storage
      .from(bucket)
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get URL based on bucket type
    let url: string;
    if (bucket === 'applications') {
      // Private bucket - generate signed URL
      const { data: signedData, error: signedError } = await supabaseServiceRole.storage
        .from(bucket)
        .createSignedUrl(path, 3600); // 1 hour expiry
      
      if (signedError) {
        console.error('Signed URL error:', signedError);
        // Fallback to path reference
        url = `${bucket}/${path}`;
      } else {
        url = signedData.signedUrl;
      }
    } else {
      // Public bucket - get public URL
      const { data: publicUrl } = supabaseServiceRole.storage
        .from(bucket)
        .getPublicUrl(path);
      url = publicUrl.publicUrl;
    }

    console.log('File uploaded successfully:', path);

    return new Response(
      JSON.stringify({ 
        success: true, 
        url,
        path: data.path,
        bucket 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});