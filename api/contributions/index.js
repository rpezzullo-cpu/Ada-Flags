'use strict';

const { getClientPrincipal } = require('../shared/principal');
const { loadRecords } = require('../shared/source');

// Simple in-memory cache so we don't hit Graph/Jira on every page load.
let cache = { at: 0, source: null, records: null };
const TTL_MS = 60 * 1000;

// GET /api/contributions -> normalized contribution records for the dashboard.
module.exports = async function (context, req) {
  // Require a signed-in user (defense in depth; routes are also protected by
  // staticwebapp.config.json). Allow through when running locally without SWA.
  const principal = getClientPrincipal(req);
  const local = !!(process.env.AzureWebJobsScriptRoot || process.env.FUNCTIONS_WORKER_RUNTIME) && !req.headers['x-ms-client-principal'];
  if (!principal && !local && process.env.ALLOW_ANONYMOUS !== 'true') {
    context.res = { status: 401, body: { error: 'Not authenticated' } };
    return;
  }

  try {
    const now = Date.now();
    if (!cache.records || now - cache.at > TTL_MS) {
      const { source, records } = await loadRecords();
      if (records === null) {
        // No data source configured — let the frontend fall back to demo mode.
        context.res = {
          status: 501,
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'No data source configured', source: 'none' }
        };
        return;
      }
      cache = { at: now, source, records };
    }
    context.res = {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Data-Source': cache.source
      },
      body: { source: cache.source, count: cache.records.length, records: cache.records }
    };
  } catch (err) {
    context.log.error('contributions failed:', err && err.message);
    context.res = {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Failed to load data source', detail: String(err && err.message) }
    };
  }
};
