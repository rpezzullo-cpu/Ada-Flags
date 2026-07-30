'use strict';

const { recordsFromValues } = require('./normalize');

/**
 * Read the Microsoft Forms response workbook via Microsoft Graph using an
 * app-only (client-credentials) token. Secrets live in Azure app settings and
 * never reach the browser.
 *
 * Required app settings:
 *   TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
 * Locate the workbook with EITHER:
 *   EXCEL_SHARE_URL   (paste the file's share link — simplest), OR
 *   EXCEL_DRIVE_ID + EXCEL_ITEM_ID
 * Optional:
 *   EXCEL_WORKSHEET   (worksheet name; defaults to the first sheet)
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';

async function getToken() {
  const tenant = process.env.TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const secret = process.env.GRAPH_CLIENT_SECRET;
  if (!tenant || !clientId || !secret) {
    throw new Error('Graph not configured (TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET)');
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error('Token request failed: ' + res.status + ' ' + (await res.text()));
  const json = await res.json();
  return json.access_token;
}

/** Encode a sharing URL into a Graph shares token (u! + base64url). */
function shareToken(url) {
  const b64 = Buffer.from(url, 'utf8').toString('base64');
  return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

/** Resolve the workbook item's Graph path segment from configured settings. */
function workbookBase() {
  const shareUrl = process.env.EXCEL_SHARE_URL;
  if (shareUrl) return `${GRAPH}/shares/${shareToken(shareUrl)}/driveItem`;
  const driveId = process.env.EXCEL_DRIVE_ID;
  const itemId = process.env.EXCEL_ITEM_ID;
  if (driveId && itemId) return `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
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

async function loadExcelRecords() {
  const token = await getToken();
  const base = workbookBase();
  let sheet = process.env.EXCEL_WORKSHEET;
  if (!sheet) sheet = await firstWorksheetName(base, token);
  const url =
    `${base}/workbook/worksheets/${encodeURIComponent(sheet)}/usedRange(valuesOnly=true)?$select=values`;
  const range = await graphGet(url, token);
  const values = (range && range.values) || [];
  return recordsFromValues(values);
}

module.exports = { loadExcelRecords, shareToken };
