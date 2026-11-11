const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('jogador pode escolher WebP, manter o arquivo original ou voltar ao link', async () => {
  const image = new Blob([Buffer.alloc(500 * 1024)], { type: 'image/png' });
  const webp = new Blob([Buffer.alloc(80 * 1024)], { type: 'image/webp' });
  const elements = {
    'compose-image': { value: '', required: true },
    'compose-file': { files: [image], value: 'imagem.png' },
    'compose-original-option': { classList: { add() {}, remove() {} } },
    'compose-original': { checked: false },
    'compose-upload-status': { textContent: '' }
  };
  const posts = [];
  const uploads = [];
  const context = vm.createContext({
    crypto, URL, AbortSignal, DOMException,
    document: {
      getElementById: id => elements[id],
      createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: callback => callback(webp) })
    },
    createImageBitmap: async () => ({ width: 1200, height: 800, close() {} }),
    auth: { currentUser: { getIdToken: async () => 'token-de-teste' } },
    isUserAdmin: () => false,
    showToast: () => {},
    state: {},
    fetch: async (_, { body }) => {
      uploads.push(body);
      return Response.json({ url: 'https://rede-x.pages.dev/media/teste' });
    },
    createPost: async options => { posts.push(options); return true; }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/features/compose.js'), 'utf8'), context);
  const submit = () => context.submitCompose({ preventDefault() {} });
  await context.prepareComposeImage();
  assert.equal(elements['compose-image'].required, false);
  assert.match(elements['compose-upload-status'].textContent, /500 KB → 80 KB/);
  await submit();
  elements['compose-original'].checked = true;
  await context.prepareComposeImage();
  await submit();
  elements['compose-image'].value = 'https://i.imgur.com/teste.jpg';
  context.previewComposeImage();
  await submit();
  assert.deepEqual(uploads, [webp, image]);
  assert.deepEqual(posts.map(post => post.image), [
    'https://rede-x.pages.dev/media/teste', 'https://rede-x.pages.dev/media/teste', 'https://i.imgur.com/teste.jpg'
  ]);
});

test('upload exige um token do Rede X e permite repetir um envio sem gravar outra imagem', async t => {
  const { onRequestGet, onRequestPost } = await import('../functions/api/post-image.js');
  const { onRequestGet: getImage } = await import('../functions/media/[id].js');
  const origin = 'https://rede-x.pages.dev';
  const id = crypto.randomUUID();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fO0AAAAASUVORK5CYII=', 'base64');
  const rsa = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const pair = await crypto.subtle.generateKey({ ...rsa, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ keys: [{ ...jwk, kid: 'test-key' }] }, {
    headers: { 'Cache-Control': 'max-age=60' }
  }));
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = async (aud, uid = 'player') => {
    const now = Math.floor(Date.now() / 1000);
    const input = `${encode({ alg: 'RS256', kid: 'test-key' })}.${encode({ aud, iss: `https://securetoken.google.com/${aud}`, sub: uid, exp: now + 60, iat: now, auth_time: now })}`;
    const signature = await crypto.subtle.sign(rsa, pair.privateKey, new TextEncoder().encode(input));
    return `${input}.${Buffer.from(signature).toString('base64url')}`;
  };

  const objects = new Map();
  let writes = 0;
  const bucket = {
    head: async key => objects.get(key),
    get: async key => objects.get(key),
    async put(key, value, options) {
      const current = objects.get(key);
      if (options.onlyIf instanceof Headers && options.onlyIf.get('If-None-Match') === '*' && current) return null;
      if (options.onlyIf.etagMatches && options.onlyIf.etagMatches !== current?.etag) return null;
      const object = { ...options, etag: String(++writes), body: value, size: value.length, json: async () => JSON.parse(value) };
      objects.set(key, object);
      return object;
    }
  };
  const env = { POST_IMAGES: bucket };
  const upload = (jwt, body = png, uploadId = id) => onRequestPost({ env, request: new Request(`${origin}/api/post-image`, {
    method: 'POST', body, headers: { Origin: origin, 'X-Upload-Id': uploadId, 'Content-Type': 'image/png', Authorization: `Bearer ${jwt}` }
  }) });

  assert.deepEqual(await onRequestGet({ env: {} }).json(), { available: false });
  assert.equal((await upload('invalid')).status, 401);
  assert.equal((await upload(await token('outro-projeto'))).status, 401);
  const jwt = await token('rede-x');
  assert.equal((await upload(jwt, '<html>arquivo inválido</html>')).status, 422);
  assert.equal((await upload(jwt, Buffer.alloc(8 * 1024 * 1024 + 1))).status, 422);
  assert.equal(objects.size, 0);
  assert.deepEqual(await (await upload(jwt)).json(), { url: `${origin}/media/${id}` });
  assert.deepEqual(await (await upload(jwt)).json(), { url: `${origin}/media/${id}` });
  assert.equal((await upload(await token('rede-x', 'outro-player'))).status, 409);
  assert.equal(writes, 2);

  globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
  t.after(() => { delete globalThis.caches; });
  const image = await getImage({ env, params: { id }, request: new Request(`${origin}/media/${id}`), waitUntil() {} });
  assert.equal(image.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  assert.equal((await getImage({ env, params: { id: '../internal/upload-quota.json' } })).status, 404);
});
