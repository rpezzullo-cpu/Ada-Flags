// Signed session cookie using WebCrypto HMAC-SHA256 (available in Workers).
// Cookie value = base64url(JSON payload) + "." + base64url(HMAC).

const COOKIE_NAME = 'ada_session';
const DEFAULT_TTL_SECONDS = 8 * 60 * 60; // 8 hours

const enc = new TextEncoder();

function b64urlFromBytes(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlFromString(str) {
  return b64urlFromBytes(enc.encode(str));
}
function bytesFromB64url(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function stringFromB64url(b64) {
  return new TextDecoder().decode(bytesFromB64url(b64));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signSession(payload, secret, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const p = b64urlFromString(JSON.stringify(body));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(p)));
  return p + '.' + b64urlFromBytes(sig);
}

async function verifySession(token, secret) {
  if (!token || token.indexOf('.') < 0) return null;
  const [p, sig] = token.split('.');
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify('HMAC', key, bytesFromB64url(sig), enc.encode(p));
    if (!ok) return null;
    const payload = JSON.parse(stringFromB64url(p));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  header.split(/;\s*/).forEach((pair) => {
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i).trim()] = decodeURIComponent(pair.slice(i + 1));
  });
  return out;
}

function sessionCookie(value, maxAgeSeconds = DEFAULT_TTL_SECONDS) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  return attrs.join('; ');
}
function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function getSession(request, env) {
  if (!env.SESSION_SECRET) return null;
  const token = parseCookies(request)[COOKIE_NAME];
  return verifySession(token, env.SESSION_SECRET);
}

export { COOKIE_NAME, signSession, verifySession, parseCookies, sessionCookie, clearCookie, getSession };
