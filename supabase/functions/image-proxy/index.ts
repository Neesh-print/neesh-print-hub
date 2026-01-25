const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const allowedHosts = new Set([
  'cdn.shopify.com',
  'cdn.shopifycdn.net',
  'cdn.shopifycdn.com',
]);

const buildCandidateUrls = (rawUrl: string): string[] => {
  const u = new URL(rawUrl);
  const candidates = [u.toString()];

  // Shopify URLs often append ?v=... cache busters; if those 404 from edge,
  // retry without the query string.
  if (u.search) {
    candidates.push(`${u.origin}${u.pathname}`);
  }

  // Ensure uniqueness and stable order
  return Array.from(new Set(candidates));
};

const fetchImageWithFallbacks = async (imageUrl: string): Promise<Response> => {
  const candidates = buildCandidateUrls(imageUrl);

  const headerSets: HeadersInit[] = [
    {
      // Minimal browser-like headers
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    {
      // Some Shopify setups behave differently with a Referer present
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://cdn.shopify.com/',
      'Origin': 'https://cdn.shopify.com',
    },
  ];

  let lastResponse: Response | null = null;

  for (const candidate of candidates) {
    for (const headers of headerSets) {
      const res = await fetch(candidate, {
        headers,
        redirect: 'follow',
      });

      if (res.ok) return res;

      lastResponse = res;

      // Log a small snippet of the body for debugging (Shopify sometimes returns
      // an HTML page even with a 404/403).
      try {
        const text = await res.clone().text();
        console.error(
          `Shopify fetch failed: status=${res.status} url=${candidate} body=${text.slice(0, 200)}`
        );
      } catch (e) {
        console.error(`Shopify fetch failed: status=${res.status} url=${candidate} (body unreadable)`, e);
      }
    }
  }

  // If we got a response, return it; otherwise synthesize a 502.
  return (
    lastResponse ??
    new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  );
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate it's a Shopify CDN URL for security
    const parsedUrl = new URL(imageUrl);

    if (!allowedHosts.has(parsedUrl.hostname)) {
      return new Response(JSON.stringify({ error: 'URL not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Proxying image: ${imageUrl}`);

    // Fetch the image from Shopify with fallback retries (some Shopify CDNs
    // return 404/403 depending on headers and query-string cache busters).
    const response = await fetchImageWithFallbacks(imageUrl);

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const imageData = await response.arrayBuffer();

    console.log(`Successfully proxied image, size: ${imageData.byteLength} bytes`);

    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
