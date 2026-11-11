import { authenticatedUser, imageKey, imageRelease, managedImageId, reserveImageOperations } from './_post-image.js';

const firebaseDatabase = 'https://rede-x-default-rtdb.firebaseio.com';
const firebaseKey = /^[A-Za-z0-9_-]{1,128}$/;
const referenceRoots = ['posts', 'mediaLibrary', 'stories', 'highlights', 'users', 'npcProfiles'];

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function database(path, token, updates) {
  const url = new URL(`/${path}.json`, firebaseDatabase);
  url.searchParams.set('auth', token);
  const response = await fetch(url, {
    method: updates ? 'PATCH' : 'GET',
    headers: updates ? { 'Content-Type': 'application/json' } : undefined,
    body: updates ? JSON.stringify(updates) : undefined,
    signal: AbortSignal.timeout(7000),
    redirect: 'error'
  });
  if (!response.ok) throw new Error('Database request failed');
  return response;
}

async function containsImage(path, token, id) {
  const response = await database(path, token);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let suffix = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      const text = suffix + decoder.decode(value, { stream: true });
      // The UUID is enough to keep the file, including links with a query string.
      if (text.includes(id)) return true;
      suffix = text.slice(1 - id.length);
    }
  } finally {
    await reader.cancel();
  }
}

function findJob(db, path) {
  return db.prepare('SELECT actor, image_id, result FROM post_image_delete_jobs WHERE path = ?').bind(path).first();
}

async function finishJob(db, path, result) {
  await db.prepare('UPDATE post_image_delete_jobs SET result = ? WHERE path = ?').bind(result, path).run();
  return json({ result });
}

export async function onRequestDelete({ request, env, waitUntil }) {
  const bucket = env.POST_IMAGES;
  const db = env.POST_IMAGE_USAGE;
  const origin = new URL(request.url).origin;
  if (!bucket || !db) return json({ error: 'A limpeza de imagens está indisponível.' }, 503);
  if (request.headers.get('Origin') !== origin) return json({ error: 'Origem inválida.' }, 403);

  const target = request.headers.get('X-Delete-From');
  const targetId = request.headers.get('X-Delete-Id') || '';
  if (!['posts', 'mediaLibrary'].includes(target) || !firebaseKey.test(targetId)) {
    return json({ error: 'Item inválido.' }, 400);
  }

  const path = `${target}/${targetId}`;
  let removedFromSite = false;
  try {
    const uid = await authenticatedUser(request);
    if (!uid || !firebaseKey.test(uid)) return json({ error: 'Entre na sua conta para apagar a imagem.' }, 401);
    const token = request.headers.get('Authorization').slice(7);
    let job = await findJob(db, path);
    if (job && job.actor !== uid) return json({ error: 'Este item já está sendo removido.' }, 409);
    if (job?.result) return json({ result: job.result });

    const item = await (await database(path, token)).json();
    if (item) {
      const isPost = target === 'posts';
      const owner = isPost && item.uid === uid;
      const admin = !owner && await (await database(`users/${uid}/isAdmin`, token)).json() === true;
      if (!owner && !admin) return json({ error: 'Sem permissão para apagar este item.' }, 403);
      const id = managedImageId(isPost ? item.image : item.url, origin);
      if (!id || (job && job.image_id !== id)) return json({ error: 'A imagem do item mudou. Atualize a página.' }, 409);

      if (!job) {
        await db.prepare('INSERT OR IGNORE INTO post_image_delete_jobs (path, actor, image_id) VALUES (?, ?, ?)')
          .bind(path, uid, id).run();
        job = await findJob(db, path);
        if (job.actor !== uid || job.image_id !== id) return json({ error: 'Este item já está sendo removido.' }, 409);
      }
      const updates = { [path]: null };
      if (isPost) {
        const author = item.uid || ('npc_' + String(item.handle || '').toLowerCase().replace(/[^a-z0-9_]/g, ''));
        if (firebaseKey.test(author)) updates[`postsByAuthor/${author}/${targetId}`] = null;
        if (admin || await (await database(`users/${uid}/isAdmin`, token)).json() === true) {
          const library = await (await database('mediaLibrary', token)).json();
          for (const [key, saved] of Object.entries(library || {})) {
            if (firebaseKey.test(key) && saved?.sourcePostId === targetId && managedImageId(saved.url, origin) === id) {
              updates[`mediaLibrary/${key}`] = null;
            }
          }
        }
      }
      await database('', token, updates);
    } else if (!job) {
      return json({ error: 'Item não encontrado.' }, 404);
    }
    removedFromSite = true;
    const id = job.image_id;
    let release = await imageRelease(db, id);
    if (release?.released) return await finishJob(db, path, 'released');

    const references = await Promise.all(referenceRoots.map(root => containsImage(root, token, id)));
    if (references.some(Boolean)) return await finishJob(db, path, 'retained');

    if (!release) {
      if (!await reserveImageOperations(db, 0, 1)) return json({ result: 'pending' });
      const object = await bucket.head(imageKey(id));
      if (!object?.customMetadata?.owner) return await finishJob(db, path, 'absent');
      if (object.customMetadata.owner !== uid && await (await database(`users/${uid}/isAdmin`, token)).json() !== true) {
        return await finishJob(db, path, 'retained');
      }
      await db.prepare('INSERT OR IGNORE INTO post_image_releases (id, bytes) VALUES (?, ?)').bind(id, object.size).run();
      release = await imageRelease(db, id);
    }
    if (!release.released) {
      await bucket.delete(imageKey(id));
      await db.prepare('UPDATE post_image_releases SET released = 1 WHERE id = ? AND released = 0').bind(id).run();
    }
    if (typeof caches !== 'undefined' && typeof waitUntil === 'function') {
      waitUntil(caches.default.delete(new Request(`${origin}/media/${id}`)).catch(() => {}));
    }
    return await finishJob(db, path, 'released');
  } catch (error) {
    console.error('Post image cleanup failed', error.name);
    return removedFromSite ? json({ result: 'pending' }) : json({ error: 'Não foi possível apagar. Tente novamente.' }, 503);
  }
}
