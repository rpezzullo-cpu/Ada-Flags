// GET /api/contributions -> normalized contribution records for the dashboard.
// Requires a signed-in session. Cached in-isolate (60s) and in KV (5 min) to
// stay well within Cloudflare's free write limits.

import { getSession } from '../_lib/session.js';
import { loadRecords } from '../_lib/source.js';

const KV_CACHE_KEY = 'contrib_cache';
const MEM_TTL_MS = 60 * 1000;
const KV_TTL_S = 300;

let mem = { at: 0, payload: null };

export async function onRequestGet(context) {
  const { request, env } = context;

  const session = await getSession(request, env);
  if (!session && env.ALLOW_ANONYMOUS !== 'true') {
    return json({ error: 'Not authenticated' }, 401);
  }

  const now = Date.now();
  if (mem.payload && now - mem.at < MEM_TTL_MS) {
    return json(mem.payload, 200, mem.payload.source);
  }

  // Cross-isolate cache.
  if (env.ADA_KV) {
    const cached = await env.ADA_KV.get(KV_CACHE_KEY, { type: 'json' });
    if (cached) {
      mem = { at: now, payload: cached };
      return json(cached, 200, cached.source);
    }
  }

  try {
    const { source, records } = await loadRecords(env);
    if (records === null) {
      // No source configured — let the frontend fall back to demo mode.
      return json({ error: 'No data source configured', source: 'none' }, 501);
    }
    const payload = { source, count: records.length, records };
    mem = { at: now, payload };
    if (env.ADA_KV) {
      context.waitUntil(env.ADA_KV.put(KV_CACHE_KEY, JSON.stringify(payload), { expirationTtl: KV_TTL_S }));
    }
    return json(payload, 200, source);
  } catch (err) {
    return json({ error: 'Failed to load data source', detail: String(err && err.message) }, 502);
  }
}

function json(body, status = 200, source) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (source) headers['X-Data-Source'] = source;
  return new Response(JSON.stringify(body), { status, headers });
}
