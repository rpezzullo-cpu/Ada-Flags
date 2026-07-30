'use strict';

const { resolveSource, graphConfigured, jiraConfigured } = require('../shared/source');

// GET /api/health -> config diagnostics. Reports which sources are wired up.
// Never returns secret values — only whether each setting is present.
module.exports = async function (context, req) {
  context.res = {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: {
      ok: true,
      resolvedSource: resolveSource(),
      excel: {
        configured: graphConfigured(),
        tenant: !!process.env.TENANT_ID,
        clientId: !!process.env.GRAPH_CLIENT_ID,
        clientSecret: !!process.env.GRAPH_CLIENT_SECRET,
        workbook: !!(process.env.EXCEL_SHARE_URL || (process.env.EXCEL_DRIVE_ID && process.env.EXCEL_ITEM_ID)),
        worksheet: process.env.EXCEL_WORKSHEET || '(first sheet)'
      },
      jira: {
        configured: jiraConfigured(),
        baseUrl: process.env.JIRA_BASE_URL || null,
        project: process.env.JIRA_PROJECT || 'AH'
      }
    }
  };
};
