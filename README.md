# Ada Hub — CS Contribution Platform

A hosted, single-sign-on dashboard for the Suitsupply Customer Service team. It
turns the **Ada flag pipeline** (Microsoft Form → Power Automate → Jira `AH` +
Teams) into a live leaderboard, ticket tracker, patterns view, and per-person
profile — so flagging an Ada case feels rewarding and the team can see its
collective impact.

Every CS agent opens one URL, signs in once with their `name@suitsupply.com`
account, and gets their own dedicated view. Nobody outside the tenant can get in.

## How it fits together

| Layer | What it is |
| --- | --- |
| **Frontend** (`app/index.html`) | The full Ada Hub UI — leaderboard, impact feed, My tickets, Feedback hub, Patterns, Profile, Settings. Self-contained HTML/CSS/JS. Reads identity from `/.auth/me` and data from `/api/contributions`, with a demo-mode fallback so it always renders. |
| **Backend** (`api/`) | Azure Functions (Node 18, no external deps). Reads the Forms response workbook via Microsoft Graph and, optionally, live ticket status from Jira. Secrets stay server-side. |
| **Auth + hosting** | Azure Static Web Apps (Standard) with Entra ID, locked to the Suitsupply tenant. |

## Data sources

- **Excel — "Ada Flags form.xlsx"** (the Microsoft Forms response sheet):
  the rich source. Carries submitter, timestamp, use case, case number, order,
  and description — everything the leaderboard, patterns, and profiles need.
  Zero change to your existing flow.
- **Jira `AH`** (optional): live ticket **status**. Jira holds submitter email +
  description + status but not use case / case number, so it's used to enrich
  status rather than as the primary source.

Choose with the `DATA_SOURCE` app setting: `excel` (default), `jira`, or `both`.

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/me` | The signed-in Suitsupply user (from the SWA auth header). |
| `GET /api/contributions` | Normalized contribution records for the dashboard. |
| `GET /api/health` | Which data sources are configured (no secrets). |

Record shape:

```json
{
  "SubmittedBy": "Jesse Harbers",
  "SubmitterEmail": "jharbers@suitsupply.com",
  "SubmittedAt": "2026-07-30T09:01:00.000Z",
  "UseCase": "WISMO",
  "CaseNumber": "C-000123",
  "OrderNumber": "SS-98765",
  "CustomerEmail": "cust@x.com",
  "IssueDescription": "Ada gave the wrong ETA",
  "Store": "Customer Service HQ",
  "Status": "Acted On"
}
```

## Deploy

See **[docs/SETUP.md](docs/SETUP.md)** for the full click-by-click guide
(Azure Static Web App, one Entra app registration for login + Graph, app
settings, optional Jira, verification). Summary:

1. Create an Azure **Static Web App (Standard)** pointed at this repo → `app` / `api`.
2. Register one Entra app (single-tenant), add a Graph `Files.Read.All`
   application permission with admin consent.
3. Add the app settings from `api/local.settings.json.example` to the Static
   Web App configuration.
4. Verify at `/api/health`, then share the URL.

## Local development

```bash
npm i -g @azure/static-web-apps-cli azure-functions-core-tools@4
cp api/local.settings.json.example api/local.settings.json   # fill in secrets
swa start app --api-location api                              # http://localhost:4280
```

## Related

- Pipeline runbook: *Ada Hub — Forms → Jira → Teams Pipeline (Runbook)* (Confluence).
- Adaptive Cards for Teams (flag form, launcher, leaderboard, summary) live
  alongside the pipeline; point their URL buttons at the deployed site.
