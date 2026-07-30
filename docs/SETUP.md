# Ada Hub — Setup & Hosting Guide (Cloudflare, free)

This stands up the Ada Hub dashboard on **Cloudflare Pages** — **$0**, no admin
required — so the whole CS team opens one URL, signs in once with their
`name@suitsupply.com` account, and gets a live, per-person dashboard.

**Why it's free and self-serve**

- Cloudflare Pages + Functions free tier: 100K function requests/day, unlimited
  static traffic, 1 GB KV. Far above what a CS dashboard needs.
- Corporate login uses an **Entra ID app registration** (free) with only
  **user-consentable** scopes (`openid profile email`) — no admin consent.
- Data is read **server-side using your own tokens**: your Jira API token, and a
  one-time Graph consent on **your own** OneDrive file (`Files.Read`, which is
  [confirmed to need no admin consent](https://learn.microsoft.com/en-us/graph/permissions-overview)).

```
CS agent ─► sign in (Entra, Suitsupply only) ─► Ada Hub page (their own view)
                                                     │
                                   Cloudflare Functions (secrets stay here)
                                                     ├── Jira AH   (live status)
                                                     └── Excel     (Forms responses)
```

Your existing Form → Power Automate → Jira + Teams pipeline is untouched; this
only **reads** what it produces.

---

## Prerequisites

- A free Cloudflare account.
- Ability to create **one Entra app registration** in the Suitsupply tenant.
  Microsoft's default allows any user to do this. If your tenant disabled it,
  that single "create app registration" click is the *only* thing an admin must
  do — **no permission consent is ever required**.
- This GitHub repo: `rpezzullo-cpu/Ada-Flags`.

---

## Step 1 — Deploy to Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** →
   **Create** → **Pages** → **Connect to Git** → pick `rpezzullo-cpu/Ada-Flags`.
2. Build settings:
   - **Production branch:** `claude/cs-feedback-dashboard-vg98x6` (or `main` once merged).
   - **Framework preset:** None.
   - **Build command:** *(leave empty)*.
   - **Build output directory:** `app`
3. **Save and Deploy.** You get a URL like `https://ada-hub.pages.dev`. Note it —
   that's your `APP_BASE_URL`. (Opening it now redirects to a sign-in that isn't
   wired yet — finish Steps 2–4.)

### Create the KV namespace (cache + token store)

4. **Workers & Pages → KV → Create a namespace**, name it `ADA_KV`.
5. Your Pages project → **Settings → Functions → KV namespace bindings** →
   **Add** → Variable name **`ADA_KV`** → select the namespace → **Save**.

---

## Step 2 — One Entra app registration (login + workbook read)

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** →
   **App registrations** → **New registration**.
   - **Name:** `Ada Hub`.
   - **Supported account types:** *Single tenant* (this is what locks sign-in to
     `@suitsupply.com`).
   - **Redirect URI:** platform **Web** → `https://<your-pages-url>/api/auth/callback`
   - **Register.**
2. **Authentication → Add a platform / Add URI:** also add
   `https://<your-pages-url>/api/setup/graph-callback`. Save.
3. **Overview:** copy **Application (client) ID** and **Directory (tenant) ID**.
4. **Certificates & secrets → New client secret** → copy the **Value** now.
5. **API permissions → Add → Microsoft Graph → Delegated → `Files.Read`** →
   Add. (Delegated `Files.Read` is user-consentable — you do **not** need to
   click "Grant admin consent".)

That's it — no application permissions, no admin consent.

---

## Step 3 — Add the settings to Cloudflare

Pages project → **Settings → Variables and Secrets** → add these (mark the
secrets as *Encrypted*), then redeploy:

| Name | Value |
| --- | --- |
| `TENANT_ID` | `fbe43f29-18b2-46ca-a741-bcc4672ba19c` |
| `ENTRA_CLIENT_ID` | Application (client) ID from Step 2 |
| `ENTRA_CLIENT_SECRET` | client secret **Value** from Step 2 |
| `SESSION_SECRET` | a long random string you invent (cookie signing key) |
| `APP_BASE_URL` | `https://<your-pages-url>` |
| `OWNER_EMAIL` | `rpezzullo@suitsupply.com` |
| `DATA_SOURCE` | `both` |
| `EXCEL_SHARE_URL` | share link to **Ada Flags form.xlsx** (Share → Copy link) |
| `JIRA_BASE_URL` | `https://suitsupply.atlassian.net` |
| `JIRA_EMAIL` | your Atlassian email |
| `JIRA_API_TOKEN` | from <https://id.atlassian.com/manage-profile/security/api-tokens> |
| `JIRA_PROJECT` | `AH` |

(Full list with descriptions is in `.dev.vars.example`.)

---

## Step 4 — Connect the workbook (one time, you only)

1. Sign in to the site once (`https://<your-pages-url>`) with your Suitsupply
   account.
2. Visit `https://<your-pages-url>/api/setup/graph`. Approve the one-time consent
   ("read your files"). You'll see **"Workbook connected."** This stores your
   Graph refresh token in KV so the backend can read the Forms responses on the
   team's behalf. Nobody else can run this (it's locked to `OWNER_EMAIL`).

> If you skip this, everything still works from **Jira** (live status +
> leaderboard); you just won't get the richer Excel fields (use case, case
> number) until it's done.

---

## Step 5 — Verify

1. `https://<your-pages-url>/api/health` → expect `resolvedSource: "both"`,
   `auth` all `true`, and `excel.graphConnected: true` after Step 4. (No secrets
   are shown.)
2. Open the site: you're sent to Microsoft sign-in, land back on the page, see
   your name in the bottom-left chip, and the header reads **"Live data · N"**.
3. A colleague opens the same URL, signs in with their own account, sees their
   own profile. A non-Suitsupply account is refused (single-tenant).

---

## Step 6 — Share it

- Send `https://<your-pages-url>` to the CS team (or add a **Custom domain** in
  Cloudflare Pages, e.g. `ada-hub.suitsupply.com`).
- Pin it as a **Teams tab** in the Self-Service Troubleshooting channel.
- Point the "View full leaderboard" button in `weekly_leaderboard_card.json` and
  the launcher card at the URL.

---

## Troubleshooting

- **Redirect/"reply URL mismatch" at sign-in** — the redirect URIs in Step 2
  must exactly match `https://<your-pages-url>/api/auth/callback` and
  `/api/setup/graph-callback`.
- **`/api/health` shows `configured: false`** — a variable is missing/misspelled
  (Step 3), or you didn't redeploy after adding them.
- **Excel empty / `graphConnected: false`** — run Step 4 as `OWNER_EMAIL`. If it
  fails, re-approve the consent prompt (the refresh token needs `offline_access`).
- **`/api/contributions` 502** — Jira token wrong, or the `EXCEL_SHARE_URL`
  doesn't point at the live workbook.
- **Wrong worksheet** — set `EXCEL_WORKSHEET` to the exact tab name (default is
  the first sheet).

---

## Local development

```bash
npm i -g wrangler
cp .dev.vars.example .dev.vars     # fill in secrets
npx wrangler pages dev app         # http://localhost:8788
```

Set `ALLOW_ANONYMOUS="true"` in `.dev.vars` to load data without signing in
while developing. For KV locally, wrangler creates a local namespace
automatically; the Graph setup route needs a real refresh token, so Excel data
is easiest to verify once deployed.
