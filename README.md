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
| **Frontend** (`app/index.html`) | The full Ada Hub UI — leaderboard, impact feed, My tickets, Feedback hub, Patterns, Profile, Settings. Self-contained HTML/CSS/JS. Reads identity from `/api/me` and data from `/api/contributions`, with a demo-mode fallback so it always renders. |
| **Backend** (`functions/`) | Cloudflare Pages Functions (ESM, no external deps). Handles Entra ID sign-in, reads the Forms response workbook via Microsoft Graph, and (optionally) live ticket status from Jira. Secrets stay server-side. |
| **Auth + hosting** | Cloudflare Pages (free tier) with Entra ID sign-in locked to the Suitsupply tenant. **$0** — no admin consent required. |

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
| `GET /api/me` | The signed-in Suitsupply user (from the session cookie). |
| `GET /api/contributions` | Normalized contribution records for the dashboard. |
| `GET /api/health` | Which data sources are configured (no secrets). |
| `GET /api/auth/login` · `callback` · `logout` | Entra ID sign-in flow. |
| `GET /api/setup/graph` | One-time, owner-only: connect the workbook via Graph. |

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
(Cloudflare Pages, one Entra app registration, variables, optional Jira,
verification). Summary — all free, no admin consent:

1. Create a **Cloudflare Pages** project pointed at this repo → build output `app`;
   add a **KV namespace** bound as `ADA_KV`.
2. Register one Entra app (single-tenant) with a **delegated `Files.Read`**
   permission (user-consentable — no admin needed).
3. Add the variables from `.dev.vars.example` to the Pages project settings.
4. Sign in once and hit `/api/setup/graph` to connect the workbook, verify at
   `/api/health`, then share the URL.

## Local development

```bash
npm i -g wrangler
cp .dev.vars.example .dev.vars     # fill in secrets
npx wrangler pages dev app         # http://localhost:8788
```

## Related

- Pipeline runbook: *Ada Hub — Forms → Jira → Teams Pipeline (Runbook)* (Confluence).
- Adaptive Cards for Teams (flag form, launcher, leaderboard, summary) live
  alongside the pipeline; point their URL buttons at the deployed site.
