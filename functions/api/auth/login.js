// GET /api/auth/login -> redirect to Entra sign-in (Suitsupply tenant only).
// Uses only user-consentable scopes, so no admin consent is needed.
import { authorizeUrl } from '../../_lib/entra.js';
import { signSession } from '../../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const base = (env.APP_BASE_URL || url.origin).replace(/\/+$/, '');
  const redirectUri = `${base}/api/auth/callback`;
  const redirectTarget = url.searchParams.get('redirect') || '/';
  // Stateless CSRF token: a short-lived signed value echoed back as `state`.
  const state = await signSession({ t: 'login', r: redirectTarget }, env.SESSION_SECRET, 600);
  const dest = authorizeUrl(env, { redirectUri, scope: 'openid profile email', state });
  return Response.redirect(dest, 302);
}
