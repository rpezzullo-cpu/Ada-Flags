'use strict';

/**
 * Turn a Microsoft Forms response worksheet (header row + value rows) into the
 * record shape the Ada Hub frontend expects:
 *   { SubmittedBy, SubmitterEmail, SubmittedAt, UseCase, CaseNumber,
 *     OrderNumber, CustomerEmail, IssueDescription, Status }
 *
 * Form/export column headers are long, occasionally reworded, and sometimes
 * localized, so we match columns by keyword rather than hardcoding exact
 * strings. Specific targets (customer email, use case) are claimed before
 * generic ones (email) so a single "Email" column lands on the submitter.
 */

const norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase();

// Ordered so that more specific matchers run first and consume their column.
const TARGETS = [
  {
    key: 'SubmittedAt',
    match: (h) => /completion time|submission time|end time|timestamp|submitted at|start time/.test(h)
  },
  { key: 'CustomerEmail', match: (h) => h.includes('email') && h.includes('customer') },
  { key: 'CustomerPhone', match: (h) => h.includes('phone') },
  { key: 'CustomerSFID', match: (h) => h.includes('salesforce') && (h.includes('id') || h.includes('sfid')) },
  { key: 'SalesforceLink', match: (h) => h.includes('salesforce') && (h.includes('link') || h.includes('url') || h.includes('case')) },
  { key: 'UseCase', match: (h) => h.includes('use case') || h.includes('usecase') || h.includes('category') || h.includes('type of case') },
  { key: 'CaseNumber', match: (h) => (h.includes('case') && (h.includes('number') || h.includes('c-number') || h.includes('c number') || h.includes('no'))) && !h.includes('use case') },
  { key: 'OrderNumber', match: (h) => h.includes('order') },
  { key: 'IssueDescription', match: (h) => h.includes('what happened') || h.includes('describe') || h.includes('description') || h.includes('detail') || h.includes('issue') || h.includes('what should') },
  { key: 'Store', match: (h) => h.includes('where do you work') || h.includes('store') || h.includes('team') || h.includes('location') },
  { key: 'SubmittedBy', match: (h) => h === 'name' || h.includes('submitter name') || h.includes('your name') || h.includes('full name') || h === 'respondent' },
  // Generic email — claimed only after CustomerEmail; this is the responder.
  { key: 'SubmitterEmail', match: (h) => h.includes('email') || h.includes('upn') }
];

function buildColumnMap(headers) {
  const cols = headers.map(norm);
  const map = {};
  const used = new Set();
  for (const target of TARGETS) {
    for (let i = 0; i < cols.length; i++) {
      if (used.has(i)) continue;
      if (map[target.key] !== undefined) continue;
      if (target.match(cols[i])) {
        map[target.key] = i;
        used.add(i);
        break;
      }
    }
  }
  return map;
}

function toIso(v) {
  if (v == null || v === '') return null;
  // Excel serial date number -> JS date.
  if (typeof v === 'number' && isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d) ? null : d.toISOString();
  }
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

function nameFromEmail(email) {
  const local = (email || '').split('@')[0] || '';
  const spaced = local.replace(/[._-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
    .trim();
}

/**
 * @param {Array<Array>} values  first row = headers, rest = data rows
 * @returns {Array<Object>} normalized records
 */
function recordsFromValues(values) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = values[0];
  const map = buildColumnMap(headers);
  const at = (row, key) => (map[key] !== undefined ? row[map[key]] : '');
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row || row.every((c) => c == null || c === '')) continue;
    const submittedAt = toIso(at(row, 'SubmittedAt'));
    if (!submittedAt) continue; // skip rows without a usable timestamp
    const email = norm(at(row, 'SubmitterEmail'));
    let by = String(at(row, 'SubmittedBy') || '').trim();
    if (!by) by = nameFromEmail(email) || 'Unknown';
    out.push({
      SubmittedBy: by,
      SubmitterEmail: email,
      SubmittedAt: submittedAt,
      UseCase: String(at(row, 'UseCase') || 'Other').trim() || 'Other',
      CaseNumber: String(at(row, 'CaseNumber') || '').trim(),
      OrderNumber: String(at(row, 'OrderNumber') || '').trim(),
      CustomerEmail: String(at(row, 'CustomerEmail') || '').trim(),
      IssueDescription: String(at(row, 'IssueDescription') || '').trim(),
      Store: String(at(row, 'Store') || '').trim(),
      Status: ''
    });
  }
  return out;
}

module.exports = { recordsFromValues, buildColumnMap, nameFromEmail, toIso };
