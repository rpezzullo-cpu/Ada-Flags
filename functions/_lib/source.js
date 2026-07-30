// Resolve and load the effective data source(s) for the dashboard.

import { loadExcelRecords, graphConfigured } from './graph.js';
import { loadJiraRecords, jiraConfigured } from './jira.js';

function resolveSource(env) {
  const explicit = (env.DATA_SOURCE || '').toLowerCase().trim();
  if (explicit) return explicit;
  if (graphConfigured(env)) return 'excel';
  if (jiraConfigured(env)) return 'jira';
  return 'none';
}

// Best-effort: attach Jira live status onto Excel records. There is no shared
// key between the workbook and Jira, so match on submitter email + same
// calendar day and take the most recent Jira issue. Unmatched rows keep an
// empty Status (the frontend derives one from age).
function mergeStatus(excel, jira) {
  const byKey = new Map();
  for (const j of jira) {
    if (!j.SubmitterEmail || !j.SubmittedAt) continue;
    const key = j.SubmitterEmail + '|' + j.SubmittedAt.slice(0, 10);
    const prev = byKey.get(key);
    if (!prev || new Date(j.SubmittedAt) > new Date(prev.SubmittedAt)) byKey.set(key, j);
  }
  return excel.map((r) => {
    if (!r.SubmitterEmail || !r.SubmittedAt) return r;
    const j = byKey.get(r.SubmitterEmail + '|' + r.SubmittedAt.slice(0, 10));
    return j ? { ...r, Status: j.Status } : r;
  });
}

async function loadRecords(env) {
  const source = resolveSource(env);
  if (source === 'excel') return { source, records: await loadExcelRecords(env) };
  if (source === 'jira') return { source, records: await loadJiraRecords(env) };
  if (source === 'both') {
    const [excel, jira] = await Promise.all([
      loadExcelRecords(env).catch(() => []),
      loadJiraRecords(env).catch(() => [])
    ]);
    if (excel.length) return { source, records: mergeStatus(excel, jira) };
    return { source, records: jira };
  }
  return { source: 'none', records: null };
}

export { loadRecords, resolveSource, mergeStatus, graphConfigured, jiraConfigured };
