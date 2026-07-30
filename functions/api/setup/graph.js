// GET /api/setup/graph -> one-time, OWNER ONLY. Consents Files.Read on the
// owner's own OneDrive (user-consentable, no admin) so the backend can read the
// Forms response workbook on everyone's behalf.
import { authorizeUrl } from '../../_lib/entra.js';
import { getSession, signSession } from '../../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const session = await getSession(request, env);
  if (!session) {
    return Response.redirect(new URL('/api/auth/login?redirect=/api/setup/graph', url.origin).toString(), 302);
  }
  const owner = (env.OWNER_EMAIL || env.JIRA_EMAIL || '').toLowerCase();
  if (owner && session.email !== owner) {
    return new Response('Only the data owner (' + owner + ') can connect the workbook.', { status: 403 });
  }
  const base = (env.APP_BASE_URL || url.origin).replace(/\/+$/, '');
  const redirectUri = `${base}/api/setup/graph-callback`;
  const state = await signSession({ t: 'graph' }, env.SESSION_SECRET, 600);
  const dest = authorizeUrl(env, {
    redirectUri,
    scope: 'openid profile offline_access https://graph.microsoft.com/Files.Read',
    state,
    prompt: 'consent'
  });
  return Response.redirect(dest, 302);
}
