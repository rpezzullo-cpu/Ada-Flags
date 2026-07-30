# Ada Hub — CS Contribution Platform

A hosted dashboard for the Suitsupply Customer Service team. It turns the
**Ada flag pipeline** (Microsoft Form → Power Automate → Jira `AH` + Teams) into
a live leaderboard, ticket tracker, patterns view, and per-person profile — so
flagging an Ada case feels rewarding and the team can see its collective impact.

Every CS agent opens one URL, identifies themselves once, and gets their own
dedicated view.

**Live site:** `https://rpezzullo-cpu.github.io/Ada-Flags/`

## How it fits together ($0 stack)

| Layer | What it is |
| --- | --- |
| **Frontend** (`app/index.html`) | The full Ada Hub UI — leaderboard, impact feed, My tickets, Feedback hub, Patterns, Profile, Settings. Self-contained HTML/CSS/JS with a demo-mode fallback so it always renders. |
| **Hosting** | **GitHub Pages** (free for this public repo), deployed by `.github/workflows/pages.yml` on every push. |
| **Data feed** | A **Power Automate flow** ("Ada Hub - Data Feed") with an HTTP trigger that reads the *Ada Flags form.xlsx* responses and returns sanitized JSON (customer PII stripped at the source). Uses the Premium licence the pipeline already has. |
| **Identity** | First-run prompt: name + `@suitsupply.com` email, stored on the device. The team data link (shared only inside Teams, never in this repo) unlocks live data. |

The page itself contains **no data and no secrets** — safe to host publicly.

## Getting started

**[docs/SETUP.md](docs/SETUP.md)** — the full guide (~15 min total):

1. Repo **Settings → Pages → Source: GitHub Actions** (one click).
2. Build the "Ada Hub - Data Feed" flow in Power Automate (HTTP trigger →
   List rows from the workbook → Select (sanitize) → Response with CORS).
3. Pin the site URL + data link in the Self-Service Troubleshooting channel;
   optionally add the site as a Teams tab.

## Data record shape

```json
{
  "SubmittedBy": "Jesse Harbers",
  "SubmitterEmail": "jharbers@suitsupply.com",
  "SubmittedAt": "2026-07-30T09:01:00.000Z",
  "UseCase": "WISMO",
  "CaseNumber": "C-000123",
  "OrderNumber": "SS-98765",
  "IssueDescription": "Ada gave the wrong ETA",
  "Store": "Customer Service HQ"
}
```

The frontend accepts this from any source (team data link, a hosted `/api`, or
SharePoint REST) and estimates ticket status from age when no live status is
provided.

## Upgrade path: true corporate SSO

`functions/` contains a complete **Cloudflare Pages + Entra ID** backend
(tenant-locked sign-in, server-side secrets, live Jira status). It isn't used by
the GitHub Pages deployment, but it's ready if the team later wants verified
`@suitsupply.com` sign-in — see **[docs/CLOUDFLARE.md](docs/CLOUDFLARE.md)**.
Still ~$0; it needs one Entra app registration.

## Local preview

```bash
python3 -m http.server 8788 -d app     # or any static server
# open http://localhost:8788 — runs in demo mode
```

## Related

- Pipeline runbook: *Ada Hub — Forms → Jira → Teams Pipeline (Runbook)* (Confluence).
- Adaptive Cards for Teams (flag form, launcher, leaderboard, summary) live
  alongside the pipeline; point their URL buttons at the live site.
