// Read the Microsoft Forms response workbook via Microsoft Graph, acting as the
// owner (Ray) using a stored delegated refresh token. Because the file is Ray's
// own OneDrive file, only the user-consentable `Files.Read` scope is needed —
// no admin consent, no app-only permissions.
//
// The refresh token is captured once via /api/setup/graph and stored in KV
// (binding: ADA_KV, key: graph_refresh_token). env supplies:
//   TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET,
//   EXCEL_SHARE_URL  (or EXCEL_DRIVE_ID + EXCEL_ITEM_ID), [EXCEL_WORKSHEET]

import { recordsFromValues } from './normalize.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const KV_REFRESH_KEY = 'graph_refresh_token';
const GRAPH_SCOPE = 'https://graph.microsoft.com/Files.Read offline_access openid profile';

function graphConfigured(env) {
  return !!(
    env.TENANT_ID &&
    env.ENTRA_CLIENT_ID &&
    env.ENTRA_CLIENT_SECRET &&
    (env.EXCEL_SHARE_URL || (env.EXCEL_DRIVE_ID && env.EXCEL_ITEM_ID))
  );
}

// Exchange (and rotate) the stored refresh token for a Graph access token.
async function getDelegatedGraphToken(env) {
  if (!env.ADA_KV) throw new Error('KV binding ADA_KV missing');
  const refresh = await env.ADA_KV.get(KV_REFRESH_KEY);
  if (!refresh) throw new Error('Graph not connected — run /api/setup/graph once as the owner');
  const body = new URLSearchParams({
    client_id: env.ENTRA_CLIENT_ID,
    client_secret: env.ENTRA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refresh,
    scope: GRAPH_SCOPE
  });
  const res = await fetch(`https://login.microsoftonline.com/${env.TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error('Graph token refresh failed: ' + res.status + ' ' + (await res.text()));
  const json = await res.json();
  // Persist the rotated refresh token so the connection stays alive.
  if (json.refresh_token && json.refresh_token !== refresh) {
    await env.ADA_KV.put(KV_REFRESH_KEY, json.refresh_token);
  }
  return json.access_token;
}

// Encode a sharing URL into a Graph shares token (u! + base64url).
function shareToken(url) {
  const b64 = btoa(unescape(encodeURIComponent(url)));
  return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

function workbookBase(env) {
  if (env.EXCEL_SHARE_URL) return `${GRAPH}/shares/${shareToken(env.EXCEL_SHARE_URL)}/driveItem`;
  if (env.EXCEL_DRIVE_ID && env.EXCEL_ITEM_ID) {
    return `${GRAPH}/drives/${encodeURIComponent(env.EXCEL_DRIVE_ID)}/items/${encodeURIComponent(env.EXCEL_ITEM_ID)}`;
  }
  throw new Error('Workbook not configured (EXCEL_SHARE_URL or EXCEL_DRIVE_ID + EXCEL_ITEM_ID)');
}

async function graphGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Graph GET ' + res.status + ' ' + url + ' :: ' + (await res.text()));
  return res.json();
}

async function firstWorksheetName(base, token) {
  const data = await graphGet(`${base}/workbook/worksheets?$select=name`, token);
  const sheets = (data && data.value) || [];
  if (!sheets.length) throw new Error('Workbook has no worksheets');
  return sheets[0].name;
}

async function loadExcelRecords(env) {
  const token = await getDelegatedGraphToken(env);
  const base = workbookBase(env);
  let sheet = env.EXCEL_WORKSHEET;
  if (!sheet) sheet = await firstWorksheetName(base, token);
  const url = `${base}/workbook/worksheets/${encodeURIComponent(sheet)}/usedRange(valuesOnly=true)?$select=values`;
  const range = await graphGet(url, token);
  const values = (range && range.values) || [];
  return recordsFromValues(values);
}

export { loadExcelRecords, graphConfigured, shareToken, KV_REFRESH_KEY, GRAPH_SCOPE };
