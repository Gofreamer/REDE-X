import { authenticatedUser, imageKey, imageRelease, imageTypes, readImage, reserveImageOperations, reserveImageSpace, uploadIdPattern } from '../_post-image.js';
export { onRequestDelete } from '../_remove-post-image.js';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function onRequestGet({ env }) {
  return json({ available: Boolean(env.POST_IMAGES && env.POST_IMAGE_USAGE) });
}

export async function onRequestPost({ request, env }) {
  const bucket = env.POST_IMAGES;
  if (!bucket || !env.POST_IMAGE_USAGE) return json({ error: 'O envio de imagens ainda não está disponível.' }, 503);
  const origin = new URL(request.url).origin;
  if (request.headers.get('Origin') !== origin) return json({ error: 'Origem inválida.' }, 403);
  const id = request.headers.get('X-Upload-Id') || '';
  const type = request.headers.get('Content-Type');
  if (!uploadIdPattern.test(id) || !imageTypes.includes(type)) {
    return json({ error: 'Escolha uma imagem JPG, PNG ou WebP.' }, 400);
  }

  try {
    const uid = await authenticatedUser(request);
    if (!uid) return json({ error: 'Entre na sua conta para enviar uma imagem.' }, 401);
    if (await imageRelease(env.POST_IMAGE_USAGE, id)) {
      return json({ error: 'Essa imagem foi removida. Selecione o arquivo de novo.' }, 409);
    }
    // Up to three quota checks/updates, two image checks and one image write.
    if (!await reserveImageOperations(env.POST_IMAGE_USAGE, 4, 5)) {
      return json({ error: 'Limite mensal de imagens atingido. Você pode publicar com link.' }, 429);
    }
    const key = imageKey(id);
    const url = `${origin}/media/${id}`;
    const existing = await bucket.head(key);
    if (existing) return existing.customMetadata?.owner === uid
      ? json({ url }) : json({ error: 'Selecione a imagem de novo.' }, 409);

    const image = await readImage(request, type);
    if (!image) return json({ error: 'Envie uma imagem JPG, PNG ou WebP de até 8 MB.' }, 422);
    const credit = await env.POST_IMAGE_USAGE.prepare('SELECT bytes FROM post_image_space WHERE id = 1').first();
    const reservation = await reserveImageSpace(bucket, id, uid, image.byteLength, credit?.bytes || 0);
    if (reservation === 'daily') return json({ error: 'Limite diário de envios atingido. Você pode publicar com link.' }, 429);
    if (reservation === 'capacity') return json({ error: 'Armazenamento de imagens cheio. Você pode publicar com link.' }, 507);
    if (reservation === 'conflict') return json({ error: 'Selecione a imagem de novo.' }, 409);
    if (reservation === 'busy') return json({ error: 'O envio está ocupado. Tente publicar novamente.' }, 503);

    if (await imageRelease(env.POST_IMAGE_USAGE, id)) {
      return json({ error: 'Essa imagem foi removida. Selecione o arquivo de novo.' }, 409);
    }
    const stored = await bucket.put(key, image, {
      onlyIf: new Headers({ 'If-None-Match': '*' }),
      httpMetadata: { contentType: type },
      customMetadata: { owner: uid }
    });
    if (!stored && (await bucket.head(key))?.customMetadata?.owner !== uid) {
      return json({ error: 'Selecione a imagem de novo.' }, 409);
    }
    return json({ url });
  } catch (error) {
    console.error('Post image upload failed', error.name);
    return json({ error: 'Não foi possível enviar a imagem. Tente novamente ou cole um link.' }, 503);
  }
}
