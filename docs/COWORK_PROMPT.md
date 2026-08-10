# Cowork prompt — Ada Hub data feed + cleanup

Copy everything below the line into a Cowork / Claude-in-Chrome session
(the same kind used to build "Ada Hub - Case Intake v2" and "Ada Hub - Case
Completed"). Priorities: **A + E** make the dashboard live with real statuses and **H** puts
the Salesforce case number on every Jira card; **B, C, F, G** are recommended;
**D** optional. Salesforce API work is postponed — skip anything needing it.

---

You are working on the **Ada Hub** project for Suitsupply CS (owner: Ray
Pezzullo, rpezzullo@suitsupply.com). The Ada Hub dashboard is live at
**https://rpezzullo-cpu.github.io/Ada-Flags/** (GitHub repo:
https://github.com/rpezzullo-cpu/Ada-Flags — see `docs/SETUP.md` for full
context). It currently runs in demo mode; your job is to build the data feed
that makes it live, then do some data cleanup.

Use the browser to drive https://make.powerautomate.com in the environment
`Default-fbe43f29-18b2-46ca-a741-bcc4672ba19c`. Lessons from the previous flow
builds in this environment (documented in the Confluence runbook "Ada Hub —
Forms → Jira → Teams Pipeline (Runbook)"):

- Open existing flows ONLY from the flows list or via `/flows/<id>/details` —
  never via a `/flows/new?...` URL (that silently creates a duplicate).
- Prefer the Classic Designer: append `?v3=false&v3survey=true` to the flow URL.
- A field is a live expression only if it starts with exactly one `@` — after
  saving, always Peek Code and verify single-`@`, never trust the pill.
- For searchable dropdowns, type a non-matching string (e.g. "zzzznomatch")
  first to surface the "Enter custom value" option safely.

## Phase A — build the "Ada Hub - Data Feed" flow (required)

Create a new instant/automated flow named **Ada Hub - Data Feed**:

1. **Trigger:** *When an HTTP request is received* (Premium — the licence used
   for the Jira connector covers it).
   - Advanced options → **Method: GET**.
   - "Who can trigger the flow": **Anyone** (the URL's SAS signature is the secret).
2. **Action:** *Excel Online (Business) → List rows present in a table*.
   - File: **Ada Flags form.xlsx** in Ray's OneDrive:
     https://suitsupply-my.sharepoint.com/:x:/r/personal/rpezzullo_suitsupply_com/_layouts/15/Doc.aspx?sourcedoc=%7B5826C24E-2D65-4A6A-A0C3-BF84059402D9%7D&file=Ada%20Flags%20form.xlsx
   - Table: the form-responses table (usually `Table1`, first worksheet).
   - **Advanced options → DateTime Format: ISO 8601** (critical — the dashboard
     parses dates).
   - Row count: raise pagination/threshold to 5000 if offered.
3. **Action:** *Select* (Data Operations). From: `value` of List rows. Map
   (left side = type exactly; right side = the matching dynamic column — check
   the real column names in the workbook first):
   | Key | Value (column) |
   | --- | --- |
   | `SubmittedBy` | Name |
   | `SubmitterEmail` | Email |
   | `SubmittedAt` | Completion time |
   | `UseCase` | Use case *(skip if the form has no such column)* |
   | `CaseNumber` | Case number / Salesforce Case Number |
   | `OrderNumber` | Order number *(skip if absent)* |
   | `IssueDescription` | Issue Description (the shared description question) |
   | `Store` | Where do you work? |

   **Do NOT map** customer email / phone / Salesforce ID columns — the feed
   must not carry customer PII.
4. **Action:** *Response*.
   - Status code `200`.
   - Headers: `Content-Type` = `application/json`,
     `Access-Control-Allow-Origin` = `*`.
   - Body: the **Output** of the Select step.
5. Save. Peek Code to confirm the Body is a single-`@` expression. Copy the
   **HTTP GET URL** from the trigger.

**Verify:** open the URL in a browser tab → a JSON array of submissions.
Then open https://rpezzullo-cpu.github.io/Ada-Flags/ → Settings → Data source →
paste the URL into **Team data link** → Save. The header must switch to
**"Live data · N contributions"**. Report the flow URL back to Ray at the end.

## Phase B — clean test rows at the source (recommended)

In **Ada Flags form.xlsx** (link above), delete the obvious test rows from the
response table (descriptions like "TESTING", "testing URL", "Test", "Testing
copy/tagging", "Just another test", "Testing new flow." — all submitted by
RPezzullo/JHarbers/GVilla on 2026-07-30 while wiring the pipeline). Delete
table rows only — do not touch headers or the table itself; the connected Form
keeps appending new rows normally. Optionally also delete Jira test issues
**AH-1 … AH-7** in https://suitsupply.atlassian.net/jira/software/projects/AH
(they are all test flags, every one currently Done).

## Phase C — merge the historical batch into the live workbook (optional, later)

The pre-launch submissions live in **Virtual Assistant - Report an Issue 3.xlsx**:
https://suitsupply-my.sharepoint.com/:x:/r/personal/rpezzullo_suitsupply_com/_layouts/15/Doc.aspx?sourcedoc=%7B91767A59-062C-4D62-8AA5-AFAF35D5DDF0%7D&file=Virtual%20Assistant%20-%20Report%20an%20Issue%203.xlsx

Rows **9–37** are the real batch (row 9 = Savanah Hägg, 18 Jun 2026 — the first
real submission; rows 1–8 and 38 are tests). Append those 29 rows to the live
**Ada Flags form.xlsx** response table, mapping: Email→Email, Name→Name,
Completion time→Completion time, "Where do you work?"→same, Issue
Description1→Issue Description, Salesforce Case Number→the case-number column.
The dashboard already contains this batch bundled as `app/data/history.json`
(with an admin-side merge toggle), and it dedupes by submitter+day+description
— so appending to the workbook will NOT double-count.

## Phase D — Jira/Teams behaviour for manual rows (optional)

Manual workbook rows do not trigger "Ada Hub - Case Intake v2" (it fires only
on real form submissions) — that is expected and correct. If Ray wants Jira
tickets for the historical batch: bulk-create Task issues in project **AH**
(issue type id 17398) with `customfield_17255` = submitter email and
Description = issue description, leaving `customfield_17253/17254/17256`
(origin channel/team/message) empty. Note: **"Ada Hub - Case Completed"**
(flow `200bc692-7da1-42ee-a9f3-886dd7e52917`) posts a threaded reply using
those origin fields — for tickets with empty origin fields the action will
fail. If backfilled tickets are created, harden Flow 2 first: add a Condition
"Origin Message ID is not empty" around the Teams reply so manual tickets just
skip the Teams step (or post to the Self-Service Troubleshooting channel as a
standalone message instead: Team ID `12fadb7e-2e4c-4bd0-b928-31630e31cad1`,
Channel ID `19:acV8nrFb2DGW8j9N23CFFZAcoItGQVXeTmokmlyEPps1@thread.tacv2`).

## Phase E — feed v2: live Jira status (recommended)

The dashboard understands an extended feed payload and joins Jira status onto
each ticket automatically (match: submitter email + same day). Upgrade the
Phase A flow:

1. After "List rows present in a table", add **Jira — Search issues (JQL)**
   (or the Jira connector's issue-search action): JQL `project = AH ORDER BY created DESC`,
   max results 100+.
2. Add a second **Select** over the Jira results mapping:
   | Key | Value |
   | --- | --- |
   | `email` | `customfield_17255` (Submitter Email) |
   | `created` | created date |
   | `status` | status name |
   | `key` | issue key |
3. Change the **Response** body from the bare Select output to:
   `{ "records": <output of Select 1>, "jira": <output of Select 2> }`
   (Compose the object with dynamic content; Peek Code to confirm both are
   single-`@` expressions.)

The dashboard accepts BOTH shapes (bare array or `{records, jira}`), so this
can be done any time without breaking anything. Once live, "My impact" shows
each ticket's real Jira status and a link to its AH issue.

## Phase F — richer thank-you message in Teams (form-fields only; no Salesforce)

Decisions (2026-08): **Salesforce API enrichment is postponed** (low priority —
do NOT build it or raise SF tickets), and the flows keep posting through
**Ray's existing connection** (no separate bot account for the store teams —
that is the accepted setup, leave the connections as they are).

1. Open the live intake form and list its actual questions first.
2. **Add one optional question** to the form (safe: Forms appends a new column
   to the response workbook; existing flows are unaffected):
   - "Salesforce case link (paste from your browser)" — text. This gives the
     clickable case link with zero Salesforce integration.
   - Only if Ray confirms he also wants Order / Customer lines in the message:
     add optional "Order number" and "Customer email or phone" questions the
     same way.
3. Edit **Ada Hub - Case Intake v2** (`c02e5bbc-5c41-4310-b686-7587d7cc26e2`):
   replace the plain thank-you text in BOTH branches' "Post message in a chat
   or channel" with this template — include only lines whose field exists on
   the form, using each branch's own dynamic fields:

   > 🚩 **Ada case flagged — thank you!**
   > **Flagged by:** {responder name}
   > **Case ID:** {Salesforce case number}
   > **SF link:** {pasted Salesforce case link}
   > **Order:** {order number}
   > **Customer:** {customer email / phone}
   > **Issue:** {issue description}

4. Map any newly added form columns into the Phase A feed flow's Select as well
   (e.g. `SalesforceLink`, `OrderNumber`, `CustomerContact`) so the dashboard
   ticket details stay in sync.
5. Keep both branches' Peek Code single-`@` clean, then post a test submission
   and verify the message renders with all lines (delete the test row + ticket
   afterwards).

*(Backlog — do not build now: Salesforce Get-records enrichment to auto-resolve
C-numbers into record links + customer context. Requires SF API access for the
Power Automate Salesforce connector; parked until prioritised.)*

## Phase G — reliability (quick)

For all three flows (Intake v2, Case Completed, Data Feed): open flow →
**... → Properties/Settings** and make sure **failure notification emails** are
on (default is on for the owner — confirm), and add Ray as **co-owner** plus
the two other admins so the flows are not single-owner. Do the same
share for the workbook and the Microsoft Form (Share → specific people).

## Phase H — Jira cards must show the Salesforce case number (requested)

Today every AH issue's summary is literally `"Ada Flag: "` — the case number
the agent typed into the form never reaches Jira, so the board is unreadable
without opening the workbook.

**Future flags (the durable fix).** Edit **Ada Hub - Case Intake v2**
(`c02e5bbc-5c41-4310-b686-7587d7cc26e2`), in BOTH branches' "Create a new
issue (V3)":
1. **Summary:** `Ada Flag: ` + the form's case-number dynamic field (so cards
   read "Ada Flag: C-03712345"). If the agent left it blank the summary just
   stays "Ada Flag: " — acceptable.
2. **Description:** prepend a first line `Salesforce case: ` + the same field,
   then a blank line, then the existing issue-description field.
3. Peek Code both branches (single-`@`), save, submit one test flag and verify
   the new card shows the C-number; clean up the test afterwards.

**Existing cards (backfill).** The real issues are **AH-8, AH-9, AH-10, AH-12,
AH-13, AH-14, AH-15, AH-16, AH-17** (AH-1…7 and AH-11 are tests). For each:
find its row in **Ada Flags form.xlsx** (match submitter email + submission
time ≈ Jira created time, listed below), take the row's case number, and update
the issue summary to `Ada Flag: {C-number}` (keep everything else unchanged).

| Issue | Submitter | Created (CET) |
| --- | --- | --- |
| AH-8 | FMilas | 2026-08-03 08:13 |
| AH-9 | FMilas | 2026-08-03 08:15 |
| AH-10 | FMilas | 2026-08-03 10:35 |
| AH-12 | FSantosBarreto | 2026-08-05 10:09 |
| AH-13 | WEnnakib | 2026-08-05 14:00 |
| AH-14 | SZotescu | 2026-08-07 11:28 |
| AH-15 | SZotescu | 2026-08-08 11:10 |
| AH-16 | KPeque | 2026-08-09 09:46 |
| AH-17 | KRebeloNazareth | 2026-08-09 17:19 |

(The dashboard needs no change — its ticket cards already lead with the
case number, fed by the `CaseNumber` mapping in Phase A.)

## Wrap-up

Report back: the Phase A flow URL, what was cleaned in Phase B, and whether
C/D were executed. Ray will pin this message in the Self-Service
Troubleshooting channel:

> 📊 **Ada Hub — our CS contribution dashboard:** https://rpezzullo-cpu.github.io/Ada-Flags/
> First visit: enter your name + Suitsupply email, and paste this team data link when asked: `<flow URL>`
> Every flag you submit trains Ada — check the leaderboard 🏆
