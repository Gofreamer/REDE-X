import { imageKey, imageTypes, uploadIdPattern } from '../_post-image.js';

export async function onRequestGet({ request, env, params, waitUntil }) {
  if (!env.POST_IMAGES || !uploadIdPattern.test(params.id)) return new Response(null, { status: 404 });
  const cacheKey = new Request(new URL(`/media/${params.id}`, request.url));
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;
  const image = await env.POST_IMAGES.get(imageKey(params.id));
  const type = image?.httpMetadata?.contentType;
  if (!image || !imageTypes.includes(type)) return new Response(null, { status: 404 });
  const response = new Response(image.body, { headers: {
    'Content-Type': type,
    'Content-Length': String(image.size),
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Robots-Tag': 'noindex'
  } });
  waitUntil(caches.default.put(cacheKey, response.clone()).catch(() => {}));
  return response;
}
