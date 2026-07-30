// GET /api/auth/callback -> exchange the code, set the signed session cookie.
import { exchangeCode, decodeIdToken, claimsToUser } from '../../_lib/entra.js';
import { signSession, verifySession, sessionCookie } from '../../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const base = (env.APP_BASE_URL || url.origin).replace(/\/+$/, '');
  const redirectUri = `${base}/api/auth/callback`;

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (err) return html(`Sign-in failed: ${escapeHtml(err)}`, 400);
  if (!code || !state) return html('Missing authorization code or state.', 400);

  const st = await verifySession(state, env.SESSION_SECRET);
  if (!st || st.t !== 'login') return html('Invalid or expired sign-in request. Please try again.', 400);

  let token;
  try {
    token = await exchangeCode(env, { code, redirectUri, scope: 'openid profile email' });
  } catch (e) {
    return html('Could not complete sign-in. ' + escapeHtml(String(e.message)), 502);
  }
  const user = claimsToUser(decodeIdToken(token.id_token));
  if (!user.email) return html('Sign-in did not return an email address.', 400);

  const cookie = await signSession({ name: user.name, email: user.email }, env.SESSION_SECRET);
  const dest = st.r && st.r.startsWith('/') ? st.r : '/';
  return new Response(null, {
    status: 302,
    headers: { Location: dest, 'Set-Cookie': sessionCookie(cookie) }
  });
}

function html(message, status) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;color:#2D2E2C">
     <h2>Ada Hub</h2><p>${message}</p><p><a href="/api/auth/login">Try again</a></p></body>`,
    { status, headers: { 'Content-Type': 'text/html' } }
  );
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
