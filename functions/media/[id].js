import { imageKey, imageTypes, reserveImageOperations, uploadIdPattern } from '../_post-image.js';

export async function onRequestGet({ request, env, params, waitUntil }) {
  if (!env.POST_IMAGES || !uploadIdPattern.test(params.id)) return new Response(null, { status: 404 });
  const cacheKey = new Request(new URL(`/media/${params.id}`, request.url));
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;
  try {
    if (!env.POST_IMAGE_USAGE || !await reserveImageOperations(env.POST_IMAGE_USAGE, 0, 1)) {
      return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  } catch {
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
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
