const firebaseProject = 'rede-x';
const keyUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const rsa = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
let keys = new Map();
let keysExpireAt = 0;

export const uploadIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const maxImageBytes = 8 * 1024 * 1024;
export const imageKey = id => `images/${id}`;

function decodePart(part) {
  return Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function refreshKeys() {
  const response = await fetch(keyUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Firebase signing keys unavailable');
  const jwks = await response.json();
  const entries = await Promise.all(jwks.keys.map(async jwk => [jwk.kid,
    await crypto.subtle.importKey('jwk', jwk, rsa, false, ['verify'])]));
  keys = new Map(entries);
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/\bmax-age=(\d+)/i)?.[1] || 0);
  const age = Number(response.headers.get('Age') || 0);
  keysExpireAt = Date.now() + Math.max(0, maxAge - age) * 1000;
}

export async function authenticatedUser(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.length > 8192 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) return null;
  const [header, payload, signature] = auth.slice(7).split('.');
  const decoder = new TextDecoder();
  let claims, metadata, bytes;
  try {
    metadata = JSON.parse(decoder.decode(decodePart(header)));
    claims = JSON.parse(decoder.decode(decodePart(payload)));
    bytes = decodePart(signature);
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (metadata?.alg !== 'RS256' || typeof metadata.kid !== 'string'
    || claims?.aud !== firebaseProject || claims.iss !== `https://securetoken.google.com/${firebaseProject}`
    || !Number.isInteger(claims.exp) || claims.exp <= now
    || !Number.isInteger(claims.iat) || claims.iat > now
    || !Number.isInteger(claims.auth_time) || claims.auth_time > now
    || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128
    || claims.firebase?.sign_in_provider === 'anonymous') return null;

  if (Date.now() >= keysExpireAt) await refreshKeys();
  const key = keys.get(metadata.kid);
  if (!key) return null;
  const valid = await crypto.subtle.verify(rsa, key, bytes, new TextEncoder().encode(`${header}.${payload}`));
  return valid ? claims.sub : null;
}

export async function readImage(request, type) {
  if (!request.body || Number(request.headers.get('Content-Length')) > maxImageBytes) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxImageBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  if (length < 16) return null;
  const image = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    image.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const beginsWith = (signature, start = 0) => signature.every((byte, index) => image[start + index] === byte);
  const matches = {
    'image/jpeg': beginsWith([255, 216, 255]),
    'image/png': beginsWith([137, 80, 78, 71, 13, 10, 26, 10]),
    'image/webp': beginsWith([82, 73, 70, 70]) && beginsWith([87, 69, 66, 80], 8)
  };
  return matches[type] ? image : null;
}

// Conditional writes serialize reservations across isolates. A failed upload
// retains its reservation so a retry with the same ID never uses quota twice.
export async function reserveImageSpace(bucket, id, uid, size) {
  const path = 'internal/upload-quota.json';
  const day = new Date().toISOString().slice(0, 10);
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await bucket.get(path);
    const quota = current ? await current.json() : { bytes: 0, day, uploads: {} };
    if (quota.day !== day) {
      quota.day = day;
      quota.uploads = {};
    }
    const reservation = Object.hasOwn(quota.uploads, id) && quota.uploads[id];
    if (reservation) return reservation.uid === uid && reservation.size === size ? 'ok' : 'conflict';
    const today = Object.values(quota.uploads);
    if (quota.bytes + size > 8_000_000_000) return 'capacity';
    if (today.length >= 300 || today.filter(upload => upload.uid === uid).length >= 20) return 'daily';
    quota.bytes += size;
    quota.uploads[id] = { uid, size };
    const onlyIf = current ? { etagMatches: current.etag } : new Headers({ 'If-None-Match': '*' });
    if (await bucket.put(path, JSON.stringify(quota), { onlyIf })) return 'ok';
  }
  return 'busy';
}
