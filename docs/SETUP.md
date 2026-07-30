# Ada Hub — Setup & Hosting Guide

This guide takes you from an empty Azure account to a live, Suitsupply-only
dashboard the whole CS team can open with their `name@suitsupply.com` login. No
coding required — every step is in a web portal.

**What you're standing up**

```
 CS agent  ──►  /.auth (Entra ID sign-in, once)  ──►  Ada Hub page (per person)
                                                          │
                                                          ▼
                                          /api  (Azure Functions, secrets stay here)
                                                          │
                        ┌─────────────────────────────────┴───────────────────┐
                        ▼                                                       ▼
        "Ada Flags form.xlsx"  (Microsoft Forms responses,           Jira AH backlog
         read via Microsoft Graph — leaderboard, patterns,           (optional, live
         tickets, profiles)                                           ticket status)
```

The pipeline you already built (Form → Power Automate → Jira + Teams) is
untouched. This only **reads** the data it produces.

---

## Cost (read first)

- **Azure Static Web Apps — Standard plan: ~€9 / month, flat** (not per user).
  The free plan cannot use a custom corporate (Entra ID) login, so Standard is
  required for "everyone signs in with their Suitsupply account."
- Azure Functions usage at this volume is effectively €0 (well within the free grant).
- Microsoft Graph and Jira reads are free.

---

## Prerequisites

- An Azure subscription you can create resources in (or an admin who can).
- Rights to create **one App Registration** in the Suitsupply Entra tenant
  (`fbe43f29-18b2-46ca-a741-bcc4672ba19c`), or an IT admin who can grant
  admin consent for one Graph permission.
- This GitHub repo: `rpezzullo-cpu/Ada-Flags`.

---

## Step 1 — Create the Static Web App (links the repo, deploys the code)

1. Go to the [Azure Portal](https://portal.azure.com) → **Create a resource** →
   search **Static Web App** → **Create**.
2. Fill in:
   - **Subscription / Resource group:** your choice (e.g. new group `ada-hub`).
   - **Name:** `ada-hub`.
   - **Plan type:** **Standard** (needed for corporate login).
   - **Region:** West Europe.
   - **Source:** GitHub → authorize → **Org** `rpezzullo-cpu`, **Repo** `Ada-Flags`,
     **Branch** `claude/cs-feedback-dashboard-vg98x6` (or `main` once merged).
   - **Build presets:** Custom.
     - **App location:** `app`
     - **Api location:** `api`
     - **Output location:** *(leave blank)*
3. **Create.** Azure commits a deploy workflow and builds. A repo already ships
   one at `.github/workflows/azure-static-web-apps.yml` — if Azure adds a second
   workflow file, delete Azure's and keep this one (or vice-versa; just keep one).
   Azure also creates the repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN`
   automatically.
4. When the GitHub Action finishes, your site is live at
   `https://<something>.azurestaticapps.net`. Open it — you'll get a login prompt
   (not fully wired yet) and the page will run in **demo mode**. That's expected
   until Steps 2–4.

> Tip: note your live URL — you'll need it for the redirect URI in Step 2.

---

## Step 2 — One App Registration (does double duty: login + Graph read)

You only need **one** app registration for both the corporate sign-in and
reading the Excel workbook.

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**.
   - **Name:** `Ada Hub`.
   - **Supported account types:** *Accounts in this organizational directory only
     (Suitsupply only — Single tenant).* ← this is what locks it to `@suitsupply.com`.
   - **Redirect URI:** platform **Web** →
     `https://<your-swa-url>/.auth/login/aad/callback`
   - **Register.**
2. On the **Overview** page, copy **Application (client) ID** and
   **Directory (tenant) ID**.
3. **Certificates & secrets** → **New client secret** → copy the **Value**
   immediately (shown once).
4. **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Application permissions** → add **`Files.Read.All`**
   (add **`Sites.Read.All`** too if you later move the workbook to a team site) →
   **Add permissions** → **Grant admin consent** (you or an IT admin — one click).
5. **Authentication** → under **Implicit grant**, tick **ID tokens** → **Save**.

---

## Step 3 — Tell the app its secrets (Static Web App configuration)

Azure Portal → your Static Web App → **Settings → Environment variables**
(a.k.a. *Configuration → Application settings*). Add these, then **Save**:

| Name | Value |
| --- | --- |
| `AAD_CLIENT_ID` | the Application (client) ID from Step 2 |
| `AAD_CLIENT_SECRET` | the client secret **Value** from Step 2 |
| `TENANT_ID` | `fbe43f29-18b2-46ca-a741-bcc4672ba19c` |
| `GRAPH_CLIENT_ID` | same Application (client) ID |
| `GRAPH_CLIENT_SECRET` | same client secret Value |
| `EXCEL_SHARE_URL` | the share link to **Ada Flags form.xlsx** (see note) |
| `DATA_SOURCE` | `excel` |

**`EXCEL_SHARE_URL`:** open the workbook in the browser → **Share → Copy link**,
and paste the whole URL. (The value in `api/local.settings.json.example` is the
one you gave; confirm it still points at the live response sheet.)

> The corporate login (`AAD_*`) is already referenced by
> `app/staticwebapp.config.json`, which pins the issuer to the Suitsupply tenant.
> No code change needed.

---

## Step 4 — (Optional) Live ticket status from Jira

Only needed if you want the **status** column (New / In Review / Acted On) to
reflect the real Jira board instead of being estimated from ticket age.

1. Create an Atlassian API token at
   <https://id.atlassian.com/manage-profile/security/api-tokens>.
2. Add these Static Web App settings:

   | Name | Value |
   | --- | --- |
   | `JIRA_BASE_URL` | `https://suitsupply.atlassian.net` |
   | `JIRA_EMAIL` | your Atlassian account email |
   | `JIRA_API_TOKEN` | the token from step 1 |
   | `JIRA_PROJECT` | `AH` |
   | `DATA_SOURCE` | `both` |

`both` = rich data from Excel + live status from Jira (matched by submitter +
day, best-effort). Use `jira` to read Jira only.

---

## Step 5 — Verify

1. Open `https://<your-swa-url>/api/health` — confirms which sources are wired
   up (no secrets shown). You want `resolvedSource: "excel"` (or `"both"`) and
   `configured: true`.
2. Open the site root. You should be sent to a Microsoft sign-in, land back on
   the page, see your name in the bottom-left chip, and the header should read
   **"Live data · N total contributions"** instead of *Demo mode*.
3. Have a colleague open the same URL — they sign in with their own Suitsupply
   account and see their own profile.

---

## Step 6 — Share it with the CS team

- Send the `https://<your-swa-url>` link (or set a custom domain under
  **Custom domains**, e.g. `ada-hub.suitsupply.com`).
- Anyone with a Suitsupply account can open it; nobody else can (single-tenant).
- Add the URL to the "View full leaderboard" button in
  `weekly_leaderboard_card.json` and the launcher card, and pin it as a Teams
  tab in the Self-Service Troubleshooting channel.

---

## Troubleshooting

- **Stuck on demo mode / `/api/health` shows `configured: false`** — an app
  setting is missing or misspelled. Re-check Step 3.
- **`/api/contributions` returns 502** — Graph or Jira rejected the request.
  Usual causes: admin consent not granted (Step 2.4), wrong `EXCEL_SHARE_URL`,
  or the workbook isn't accessible to the app. `Files.Read.All` (application)
  can read any user's OneDrive once consented.
- **Login loops or "reply URL mismatch"** — the redirect URI in Step 2 must
  exactly match `https://<your-swa-url>/.auth/login/aad/callback`.
- **Wrong worksheet picked** — set `EXCEL_WORKSHEET` to the exact tab name
  (default is the first sheet).
- **Names look like emails on the leaderboard** — the workbook's `Name` column
  is empty for those rows; the app derives a name from the email as a fallback.

---

## Local development (optional, for a developer)

```bash
# one-time
npm i -g @azure/static-web-apps-cli azure-functions-core-tools@4

cp api/local.settings.json.example api/local.settings.json   # fill in secrets
swa start app --api-location api
# open http://localhost:4280
```

`ALLOW_ANONYMOUS=true` in `local.settings.json` lets the API return data without
the SWA auth header while developing.
