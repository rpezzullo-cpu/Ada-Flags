// GET /api/health -> config diagnostics (no secrets). Confirms which data
// sources are wired and whether the one-time Graph connection is done.
import { resolveSource, graphConfigured, jiraConfigured } from '../_lib/source.js';
import { KV_REFRESH_KEY } from '../_lib/graph.js';

export async function onRequestGet(context) {
  const { env } = context;
  let graphConnected = false;
  if (env.ADA_KV) {
    try {
      graphConnected = !!(await env.ADA_KV.get(KV_REFRESH_KEY));
    } catch (e) {
      /* ignore */
    }
  }
  const body = {
    ok: true,
    resolvedSource: resolveSource(env),
    auth: {
      tenant: !!env.TENANT_ID,
      clientId: !!env.ENTRA_CLIENT_ID,
      clientSecret: !!env.ENTRA_CLIENT_SECRET,
      sessionSecret: !!env.SESSION_SECRET
    },
    excel: {
      configured: graphConfigured(env),
      workbook: !!(env.EXCEL_SHARE_URL || (env.EXCEL_DRIVE_ID && env.EXCEL_ITEM_ID)),
      worksheet: env.EXCEL_WORKSHEET || '(first sheet)',
      graphConnected
    },
    jira: {
      configured: jiraConfigured(env),
      baseUrl: env.JIRA_BASE_URL || null,
      project: env.JIRA_PROJECT || 'AH'
    },
    kv: !!env.ADA_KV
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
