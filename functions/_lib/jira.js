// Read the Ada Hub (AH) backlog from Jira Cloud with an API token (basic auth).
// Jira carries the submitter email + description + status but NOT use case /
// case number / order (those live only in the Forms workbook), so Jira is used
// mainly for live ticket STATUS, with Excel as the rich source.
//
// env: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, [JIRA_PROJECT=AH],
//      [JIRA_FIELD_SUBMITTER=customfield_17255], [JIRA_FIELD_STORE=customfield_17252]

import { nameFromEmail } from './normalize.js';

// Flatten Atlassian Document Format (or plain string) description to text.
function adfToText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');
  let s = '';
  if (node.text) s += node.text;
  if (node.content) s += adfToText(node.content);
  if (node.type === 'paragraph' || node.type === 'heading') s += '\n';
  return s;
}

function mapStatus(statusName, categoryKey) {
  const n = (statusName || '').toLowerCase();
  if (categoryKey === 'done' || n === 'done' || n === 'closed' || n === 'resolved') return 'Acted On';
  if (n.includes('progress') || n.includes('review')) return 'In Review';
  return 'New';
}

function jiraConfigured(env) {
  return !!(env.JIRA_BASE_URL && env.JIRA_EMAIL && env.JIRA_API_TOKEN);
}

async function loadJiraRecords(env) {
  const base = (env.JIRA_BASE_URL || '').replace(/\/+$/, '');
  if (!jiraConfigured(env)) throw new Error('Jira not configured');
  const project = env.JIRA_PROJECT || 'AH';
  const fSubmitter = env.JIRA_FIELD_SUBMITTER || 'customfield_17255';
  const fStore = env.JIRA_FIELD_STORE || 'customfield_17252';
  const auth = btoa(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`);

  const out = [];
  let nextPageToken = null;
  let guard = 0;
  do {
    const payload = {
      jql: `project = ${project} ORDER BY created DESC`,
      fields: ['summary', 'description', 'status', 'created', fSubmitter, fStore],
      maxResults: 100
    };
    if (nextPageToken) payload.nextPageToken = nextPageToken;
    const res = await fetch(`${base}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Jira search ' + res.status + ' :: ' + (await res.text()));
    const data = await res.json();
    const issues = data.issues || [];
    for (const it of issues) {
      const f = it.fields || {};
      const email = (f[fSubmitter] || '').toLowerCase();
      out.push({
        Key: it.key,
        SubmittedBy: email ? nameFromEmail(email) : (f.reporter && f.reporter.displayName) || 'Unknown',
        SubmitterEmail: email,
        SubmittedAt: f.created || null,
        UseCase: 'Other',
        CaseNumber: it.key,
        OrderNumber: '',
        CustomerEmail: '',
        IssueDescription: adfToText(f.description).trim(),
        Store: f[fStore] || '',
        Status: mapStatus(f.status && f.status.name, f.status && f.status.statusCategory && f.status.statusCategory.key)
      });
    }
    nextPageToken = data.nextPageToken || null;
  } while (nextPageToken && ++guard < 50);
  return out;
}

export { loadJiraRecords, jiraConfigured, mapStatus };
