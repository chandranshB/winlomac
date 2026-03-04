/**
 * Cloudflare Worker for serving racing game assets from R2
 * Bucket: racing-game
 * Maps directory: maps/
 */

export interface Env {
  RACING_GAME_BUCKET: R2Bucket;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: CORS_HEADERS,
      });
    }

    // Only allow GET and HEAD requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { 
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    // Extract path (remove leading slash)
    const path = url.pathname.slice(1);

    if (!path) {
      return new Response('Not Found', { 
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    try {
      // Fetch from R2
      const object = await env.RACING_GAME_BUCKET.get(path);

      if (!object) {
        return new Response('Not Found', { 
          status: 404,
          headers: CORS_HEADERS,
        });
      }

      // Set appropriate headers
      const headers = new Headers(CORS_HEADERS);
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'public, max-age=31536000, immutable');

      // Return HEAD response without body
      if (request.method === 'HEAD') {
        return new Response(null, { headers });
      }

      // Return full response
      return new Response(object.body, { headers });
    } catch (error) {
      console.error('R2 fetch error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};
