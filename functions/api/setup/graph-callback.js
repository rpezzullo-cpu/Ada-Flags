// GET /api/setup/graph-callback -> store the owner's Graph refresh token in KV.
import { exchangeCode } from '../../_lib/entra.js';
import { getSession, verifySession } from '../../_lib/session.js';
import { KV_REFRESH_KEY } from '../../_lib/graph.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const session = await getSession(request, env);
  const owner = (env.OWNER_EMAIL || env.JIRA_EMAIL || '').toLowerCase();
  if (!session || (owner && session.email !== owner)) {
    return page('Not authorized to connect the workbook.', 403);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (err) return page('Consent failed: ' + escapeHtml(err), 400);
  if (!code || !state) return page('Missing code or state.', 400);

  const st = await verifySession(state, env.SESSION_SECRET);
  if (!st || st.t !== 'graph') return page('Invalid or expired setup request. Start again at /api/setup/graph.', 400);

  const base = (env.APP_BASE_URL || url.origin).replace(/\/+$/, '');
  const redirectUri = `${base}/api/setup/graph-callback`;
  let token;
  try {
    token = await exchangeCode(env, {
      code,
      redirectUri,
      scope: 'openid profile offline_access https://graph.microsoft.com/Files.Read'
    });
  } catch (e) {
    return page('Token exchange failed: ' + escapeHtml(String(e.message)), 502);
  }
  if (!token.refresh_token) return page('No refresh token returned. Retry and approve the consent prompt.', 502);
  if (!env.ADA_KV) return page('KV binding ADA_KV is missing — add it in the Pages project settings.', 500);

  await env.ADA_KV.put(KV_REFRESH_KEY, token.refresh_token);
  return page('✅ Workbook connected. The dashboard can now read live Forms data. You can close this tab.', 200);
}

function page(message, status) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;color:#2D2E2C">
     <h2>Ada Hub — workbook setup</h2><p>${message}</p><p><a href="/">Back to the dashboard</a></p></body>`,
    { status, headers: { 'Content-Type': 'text/html' } }
  );
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
