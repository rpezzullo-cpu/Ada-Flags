'use strict';

const { loadExcelRecords } = require('./graph');
const { loadJiraRecords } = require('./jira');

function graphConfigured() {
  return !!(
    process.env.TENANT_ID &&
    process.env.GRAPH_CLIENT_ID &&
    process.env.GRAPH_CLIENT_SECRET &&
    (process.env.EXCEL_SHARE_URL || (process.env.EXCEL_DRIVE_ID && process.env.EXCEL_ITEM_ID))
  );
}
function jiraConfigured() {
  return !!(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
}

/** Resolve the effective source: explicit DATA_SOURCE, else auto-detect. */
function resolveSource() {
  const explicit = (process.env.DATA_SOURCE || '').toLowerCase().trim();
  if (explicit) return explicit;
  if (graphConfigured()) return 'excel';
  if (jiraConfigured()) return 'jira';
  return 'none';
}

/**
 * Best-effort: attach Jira live status onto Excel records. There is no shared
 * key between the workbook and Jira, so we match on submitter email + same
 * calendar day and take the most recent Jira issue. Unmatched rows keep an
 * empty Status (the frontend then derives one from age).
 */
function mergeStatus(excel, jira) {
  const byKey = new Map();
  for (const j of jira) {
    if (!j.SubmitterEmail || !j.SubmittedAt) continue;
    const day = j.SubmittedAt.slice(0, 10);
    const key = j.SubmitterEmail + '|' + day;
    const prev = byKey.get(key);
    if (!prev || new Date(j.SubmittedAt) > new Date(prev.SubmittedAt)) byKey.set(key, j);
  }
  return excel.map((r) => {
    if (!r.SubmitterEmail || !r.SubmittedAt) return r;
    const j = byKey.get(r.SubmitterEmail + '|' + r.SubmittedAt.slice(0, 10));
    return j ? { ...r, Status: j.Status } : r;
  });
}

/** Load records for the resolved source. Returns { source, records }. */
async function loadRecords() {
  const source = resolveSource();
  if (source === 'excel') return { source, records: await loadExcelRecords() };
  if (source === 'jira') return { source, records: await loadJiraRecords() };
  if (source === 'both') {
    const [excel, jira] = await Promise.all([
      loadExcelRecords().catch(() => []),
      loadJiraRecords().catch(() => [])
    ]);
    if (excel.length) return { source, records: mergeStatus(excel, jira) };
    return { source, records: jira };
  }
  return { source: 'none', records: null };
}

module.exports = { loadRecords, resolveSource, graphConfigured, jiraConfigured };
