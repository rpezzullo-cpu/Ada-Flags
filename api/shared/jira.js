'use strict';

const { nameFromEmail } = require('./normalize');

/**
 * Read the Ada Hub (AH) backlog from Jira Cloud with an API token (basic auth).
 * Jira carries the submitter email + description + status; it does NOT carry
 * use case / case number / order (those live only in the Forms workbook), so
 * Jira is best used for live ticket STATUS, with Excel as the rich source.
 *
 * Required app settings:
 *   JIRA_BASE_URL   (e.g. https://suitsupply.atlassian.net)
 *   JIRA_EMAIL      (the token owner's Atlassian email)
 *   JIRA_API_TOKEN  (id.atlassian.com -> Security -> API tokens)
 * Optional:
 *   JIRA_PROJECT    (defaults to "AH")
 *   JIRA_FIELD_SUBMITTER (defaults to customfield_17255)
 *   JIRA_FIELD_STORE     (defaults to customfield_17252)
 */

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

// Map a Jira status to the dashboard's status vocabulary.
function mapStatus(statusName, categoryKey) {
  const n = (statusName || '').toLowerCase();
  if (categoryKey === 'done' || n === 'done' || n === 'closed' || n === 'resolved') return 'Acted On';
  if (n.includes('progress') || n.includes('review')) return 'In Review';
  return 'New';
}

async function loadJiraRecords() {
  const base = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!base || !email || !token) throw new Error('Jira not configured (JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN)');
  const project = process.env.JIRA_PROJECT || 'AH';
  const fSubmitter = process.env.JIRA_FIELD_SUBMITTER || 'customfield_17255';
  const fStore = process.env.JIRA_FIELD_STORE || 'customfield_17252';
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  const out = [];
  let nextPageToken = null;
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
      const email2 = (f[fSubmitter] || '').toLowerCase();
      out.push({
        Key: it.key,
        SubmittedBy: email2 ? nameFromEmail(email2) : (f.reporter && f.reporter.displayName) || 'Unknown',
        SubmitterEmail: email2,
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
  } while (nextPageToken);
  return out;
}

module.exports = { loadJiraRecords, mapStatus };
