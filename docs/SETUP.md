# Ada Hub — Setup Guide (GitHub Pages + Power Automate, $0, no admin)

This is the zero-cost, zero-admin path: the dashboard is hosted on **GitHub
Pages** (free for this public repo), and the live data comes from a small
**Power Automate flow** you build in ~10 minutes — the same tool the Ada flag
pipeline already runs on, using the Premium licence you already have.

```
CS agent ─► https://rpezzullo-cpu.github.io/Ada-Flags/   (GitHub Pages, free)
                 │  first visit: enters name + suitsupply email,
                 │  pastes the team data link (pinned in Teams) — once
                 ▼
   Power Automate flow "Ada Hub - Data Feed"  (HTTP trigger, your licence)
                 └── reads "Ada Flags form.xlsx" → returns sanitized JSON
```

Your Form → Power Automate → Jira + Teams pipeline is untouched; the feed flow
only **reads** the responses workbook.

**What this trades away vs. paid hosting:** there is no cryptographic corporate
sign-in. Each person identifies themselves once on their device (name + email),
and the data link acts as the key — shared only inside Teams, never published
in the repo. Leaderboard-grade data only; customer PII is stripped by the flow
(Step 2). The full SSO design is kept in [docs/CLOUDFLARE.md](CLOUDFLARE.md) as
an upgrade path if the constraints ever change.

---

## Step 1 — Turn on GitHub Pages (one click)

1. Go to the repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**. Done.
3. The deploy workflow (`.github/workflows/pages.yml`) publishes `app/` on every
   push. After the next push (or **Actions → Deploy Ada Hub to GitHub Pages →
   Run workflow**), the site is live at:

   **`https://rpezzullo-cpu.github.io/Ada-Flags/`**

Open it — it runs in demo mode until Step 2's data link exists.

> The workflow also tries to enable Pages automatically on its first run, so
> steps 1–2 may already be done for you — check Settings → Pages.

---

## Step 2 — Build the data feed flow (~10 min, Power Automate)

Create a new flow named **"Ada Hub - Data Feed"**:

1. **Trigger:** *When an HTTP request is received* (Premium — covered by the
   licence you already use for the Jira connector).
   - Method: **GET** (under advanced options).
   - Who can trigger the flow: *Anyone* (the URL itself contains the secret
     signature — treat it like a password).
2. **Action:** *Excel Online (Business) → List rows present in a table*.
   - Location/Library/File: your **Ada Flags form.xlsx**.
   - Table: the form-responses table (usually `Table1` on the first sheet).
   - **Advanced options → DateTime Format: ISO 8601** ← important, this makes
     dates parse correctly in the dashboard.
3. **Action:** *Select* (Data Operations) — maps and **sanitizes** the columns.
   From: `value` (dynamic content from List rows). Map (adjust left side to your
   exact column names):

   | Key (type exactly) | Value (dynamic content from the row) |
   | --- | --- |
   | `SubmittedBy` | Name |
   | `SubmitterEmail` | Email |
   | `SubmittedAt` | Completion time |
   | `UseCase` | Use case |
   | `CaseNumber` | Case number (C-number) |
   | `OrderNumber` | Order number |
   | `IssueDescription` | What happened? What should have happened? |
   | `Store` | Where do you work? |

   **Deliberately leave out** customer email / phone / Salesforce ID — the
   dashboard doesn't need them, so the feed shouldn't carry them.
4. **Action:** *Response* (also Premium, same licence).
   - Status code: `200`
   - Headers: `Content-Type` = `application/json`, and
     `Access-Control-Allow-Origin` = `*` (this is what lets the GitHub page read it).
   - Body: **Output** of the Select step.
5. **Save**, then copy the **HTTP GET URL** the trigger now shows. That URL is
   your **team data link**.

**Test it:** paste the URL in a browser tab — you should see JSON rows.

---

## Step 3 — Share the link with the team (once)

1. Open the dashboard → the welcome dialog asks for name, email, and the team
   data link → paste the flow URL. (Later: Settings → Data source.)
2. Post + **pin** a message in the *Self-Service Troubleshooting* channel:

   > 📊 **Ada Hub dashboard:** https://rpezzullo-cpu.github.io/Ada-Flags/
   > First time: enter your name + Suitsupply email, and paste this team data
   > link when asked: `<flow URL>`

3. Optionally add the dashboard as a **Teams tab** (Website tab type) in the
   channel, and point the "View full leaderboard" button of
   `weekly_leaderboard_card.json` at the site.

Each person does this once per device; everything else is automatic.

---

## How the pieces behave

- **Live data:** the page fetches the flow URL on every load (Power Automate
  free-tier HTTP limits are far above CS-team traffic).
- **Per-person view:** profile/impact/tickets match rows by the email entered at
  first run against the form's submitter email.
- **Status:** estimated from ticket age (New → In Review → Acted On → Closed).
  Live Jira status needs a server and is part of the Cloudflare upgrade path.
- **Demo mode:** without a data link the page shows sample data — safe for the
  public internet; no real data is ever in the repo or the page itself.

## Microsoft sign-in (verified identity + locked admin console)

Out of the box, identity is self-declared. To upgrade to real Suitsupply
sign-in (recommended before wide rollout — it locks the admin console to
verified accounts and removes the manual name/email step):

1. [portal.azure.com](https://portal.azure.com) → Microsoft Entra ID →
   **App registrations → New registration**. Name `Ada Hub`, account type
   **Single tenant**.
2. **Authentication → Add a platform → Single-page application** →
   Redirect URI `https://rpezzullo-cpu.github.io/Ada-Flags/`.
3. Copy the **Application (client) ID** into `app/config.js`
   (`ENTRA_CLIENT_ID`) — edit the file directly on GitHub if you like — and
   commit. The site redeploys itself.

That's the whole thing: no client secret, no admin consent, no cost. The
client ID is public by design.

## End-to-end test checklist (run after any pipeline change)

1. Open the dashboard → **Flag a case** → submit a test flag via the form.
2. Within ~1 min: thank-you message appears in the right Teams channel.
3. A new AH ticket exists in Jira carrying your email.
4. Refresh the dashboard → the flag appears (header count +1).
5. Move the AH ticket to **Done** → threaded reply appears under the thank-you.
6. With feed v2: the ticket shows **Acted On** + its AH link on My impact.
7. Delete the test row from the workbook + the test AH ticket.

## Troubleshooting

- **Still in demo mode after pasting the link** — open the link in a browser
  tab: if you see JSON, check for a stray space when pasting; if you see an
  error, re-check Step 2 (the Response action must return the Select output).
- **Dates look wrong / everything shows "today"** — set **DateTime Format =
  ISO 8601** on the List rows action (Step 2.2).
- **Names show as emails** — the form's Name column wasn't mapped in the Select
  step; map `SubmittedBy` to the responder-name column.
- **CORS error in the browser console** — the `Access-Control-Allow-Origin: *`
  header is missing on the Response action.
- **Rotating the link** — if the URL ever leaks, open the flow → trigger →
  regenerate the URL, and update the pinned message. Old links stop working.

## Security posture (plain terms)

- The page is public but contains **no data and no secrets** — just the UI.
- The data link is the key: it lives in Teams (tenant-only) and in each user's
  browser storage, never in the repo. It returns leaderboard-grade data with
  customer PII stripped at the source.
- Identity is self-declared (no SSO) — fine for gamification and personal
  views; not an authorization boundary. If that ever needs to harden, the
  Cloudflare + Entra design in [docs/CLOUDFLARE.md](CLOUDFLARE.md) adds true
  corporate sign-in at ~$0 (it needs an Entra app registration).
