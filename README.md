# Workflow Query App

A Next.js app for finding which team owns a block in an Ivanti workflow. Queries the latest version of all `*form` workflows in SQL Server and returns matching blocks with their team assignments.

## What it does

Searches across workflow definitions and returns matching blocks with their team assignments. Results can be exported to CSV directly from the results table.

| Column | Description |
|---|---|
| Workflow Name | Name of the workflow |
| Version | Latest definition version |
| Offering Status | Status of the associated request offering (`Published`, `Design`, or `No Offering` for workflows not yet linked to a request offering) |
| Block Title | Title of the matching block |
| Block Type | See block types table below |
| Team / Group | Team assigned to the block, or approval group for `vote0007`/`vote` blocks (shown with a `group` tag) |

### Block Types

| Value | Display Label | Description |
|---|---|---|
| `task` | Task | Standard task block |
| `advancedtask` | Extended Task | Advanced task block (teamblock team assignment) |
| `advancedtask_qa` | Extended Task (QA) | OwnerTeam set via QuickAction on an Extended Task block |
| `quickaction` | Quick Action | Standalone Quick Action block |
| `update` | Update | Update object block |
| `create` | Insert Child | Creates a child record (older block type) |
| `createnew0002` | Create Object | Create object block (QuickAction-based) |
| `vote0007` | Get Approval | Approval block (current) |
| `vote` | Get Approval | Older approval block type, functionally equivalent to `vote0007`. Exists in legacy workflows (e.g. Software Installation Request (Legacy), New Computer Request (Legacy)). Both are returned when **Get Approval** is selected in the dropdown. Results may show 0 rows for `vote` blocks whose linked approval groups are inactive or no longer exist in ContactGroup. |

> **Extended Task (advancedtask) team sources:** An Extended Task block can have two team assignments — a task-level teamblock and an OwnerTeam set via its QuickAction. Both are returned as separate rows: the teamblock team shows as `advancedtask` (Extended Task), and the QuickAction OwnerTeam shows as `advancedtask_qa` (Extended Task (QA)), indented as a sub-row beneath it.

All filters default to "all values" — leave any field blank to search across everything. The **Workflow Name** field supports multi-word partial search: each word is matched independently (AND logic), so `Ivanti Test` finds workflows containing both words anywhere in the name.

When results are returned, **Copy to Clipboard** and **Export CSV** buttons appear in the results header. The clipboard copy uses tab-separated values so it pastes directly into Excel with columns aligned.

## Setup

### Single database

Create a `.env.local` file in the project root:

```
DB_NAMES=MY_DB

DB_MY_DB_LABEL=My Database
DB_MY_DB_SERVER=your-sql-server
DB_MY_DB_DATABASE=your-database
DB_MY_DB_USER=your-username
DB_MY_DB_PASSWORD=your-password
DB_MY_DB_PORT=1433
```

### Multiple databases

Add each database as a separate entry under `DB_NAMES`:

```
DB_NAMES=WILLIAMS_PRD,ACME_PRD

DB_WILLIAMS_PRD_LABEL=Williams PRD
DB_WILLIAMS_PRD_SERVER=bis-prd-iaz.ivanticloud.com
DB_WILLIAMS_PRD_DATABASE=IAMC_Williams_PRD_NA
DB_WILLIAMS_PRD_USER=BIP_WILLIAMS
DB_WILLIAMS_PRD_PASSWORD=your-password
DB_WILLIAMS_PRD_PORT=31410

DB_ACME_PRD_LABEL=Acme PRD
DB_ACME_PRD_SERVER=acme-server.example.com
DB_ACME_PRD_DATABASE=IAMC_Acme_PRD
DB_ACME_PRD_USER=BIP_ACME
DB_ACME_PRD_PASSWORD=your-password
DB_ACME_PRD_PORT=1433
```

A **Database** dropdown appears in the UI. Switching databases reloads the Team / Group dropdown for that environment. The first entry in `DB_NAMES` is used as the default.

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

> **Note:** `npm install` installs all dependencies locally into `node_modules` — no global installation is required for the app itself.

Open [http://localhost:3000](http://localhost:3000).

## Encrypting the Database Password (Windows DPAPI)

For production deployments on Windows, the database password should be encrypted with Windows DPAPI so it is not stored in plaintext. The encrypted value is tied to your Windows user account — it cannot be decrypted on any other machine or user account.

Use `DB_<KEY>_PASSWORD_ENCRYPTED` in place of `DB_<KEY>_PASSWORD` for each database:

```
DB_WILLIAMS_PRD_PASSWORD_ENCRYPTED=<encrypted value>
```

**If you are using `setup-windows.bat`:** encryption is handled automatically. Just put `DB_<KEY>_PASSWORD=your-plaintext-password` in `.env.local` and run the script — it will encrypt the value and replace the plaintext before building the app.

**To encrypt manually**, run this in PowerShell on the Windows machine that will run the app:

```powershell
Add-Type -AssemblyName System.Security
[System.Convert]::ToBase64String(
  [System.Security.Cryptography.ProtectedData]::Protect(
    [System.Text.Encoding]::UTF8.GetBytes("your-plaintext-password"),
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )
)
```

Copy the output into `.env.local` as `DB_<KEY>_PASSWORD_ENCRYPTED=<paste here>`.

The app decrypts passwords at startup via `lib/db.ts` using `spawnSync` and PowerShell DPAPI. If `DB_<KEY>_PASSWORD_ENCRYPTED` is not set, it falls back to `DB_<KEY>_PASSWORD` for local dev.

## Windows Deployment (no terminal required)

To run the app in the background on Windows without keeping a terminal open, use the included `setup-windows.bat` script. It installs PM2, builds the app for production, and configures it to start automatically on Windows boot.

**Prerequisites:**
- [Node.js](https://nodejs.org) installed
- `.env.local` file created in the project root with `DB_<KEY>_PASSWORD=your-plaintext-password` — **the script will not proceed without it, and will encrypt the password automatically before building**

**Steps:**
1. Clone the repository to the Windows machine
2. Create `.env.local` with your database credentials (use `DB_<KEY>_PASSWORD=` — the script encrypts it)
3. Right-click `setup-windows.bat` and select **Run as Administrator**

The app will be available at [http://localhost:3000](http://localhost:3000) and will start automatically after every reboot.

### PM2 Installation Options

PM2 can be installed **globally** (recommended for production) or run **locally via npx** (no global install needed).

**Option A — Global install (recommended for production/run-on-boot):**
```bash
npm install -g pm2 pm2-windows-startup
pm2 start ecosystem.config.js
pm2 save
```
Use plain `pm2` commands anywhere on the machine.

**Option B — Local via npx (no global install):**
```bash
npx pm2 start ecosystem.config.js
npx pm2 save
```
Prefix every `pm2` command with `npx`. Note: the Windows startup hook (`pm2-windows-startup`) works more reliably with a global install — use Option A if you need the app to start automatically on boot.

**Useful PM2 commands** (prefix with `npx` if using Option B):
```bash
pm2 status                              # check if the app is running
pm2 logs workflow-query-app             # view app logs
pm2 restart workflow-query-app          # restart the app
pm2 stop workflow-query-app             # stop the app
```

## Uninstalling

The easiest way to uninstall is to run `uninstall-windows.bat` — it prompts for which PM2 option was used and handles all cleanup steps, including an option to delete the app folder.

To uninstall manually:

### Option 1 — Global install

```bash
# 1. Stop and remove the PM2 process
pm2 delete workflow-query-app

# 2. Remove the Windows startup entry
npx pm2-windows-startup uninstall

# 3. Save the empty PM2 process list
pm2 save

# 4. (Optional) Uninstall PM2 and the startup manager globally
npm uninstall -g pm2 pm2-windows-startup
```

### Option 2 — Local via npx

```bash
# 1. Stop and remove the PM2 process
npx pm2 delete workflow-query-app

# 2. Save the empty PM2 process list
npx pm2 save
```

No startup entry was created, so no further cleanup is needed.

In both cases, delete the app folder to fully remove the app and `.env.local` credentials.

Then delete the app folder from your machine. The `.env.local` file (with your DB credentials) is inside that folder and will be removed along with it.

## Standalone SQL Script

A standalone version of the workflow query is kept at:

```
~/Downloads/Claude/SQL/FindTeamByBlockTypeAndWorkflow_v8.sql
```

This is the same logic as the app but written to run directly in SSMS. Parameters are declared at the top with hardcoded defaults — set them before running. Connection pool reuse is an app-layer concern and does not apply in SSMS; each execution is its own session.

Use it to test filter changes, inspect raw results, or verify query behaviour before updating `lib/workflow-query.ts`.

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/databases` | GET | List available databases from `DB_NAMES` |
| `/api/query` | POST | Run the workflow block query with filters |
| `/api/teams` | GET | Fetch service desk teams and approval groups for the Team / Group dropdown |
| `/api/export/workflow-results.csv` | GET | Download results as a CSV file |

### GET `/api/databases`

**Response:**
```json
{
  "databases": [
    { "key": "WILLIAMS_PRD", "label": "Williams PRD" }
  ]
}
```

### POST `/api/query`

**Body** (all fields optional — omit or pass empty string to match all):
```json
{
  "workflowName": "",
  "blockType": "",
  "teamName": "",
  "status": "",
  "db": "WILLIAMS_PRD"
}
```

`workflowName` supports multi-word partial search — each space-separated word is applied as a separate `LIKE` condition (AND logic). `db` defaults to the first entry in `DB_NAMES` if omitted.

**Response:**
```json
{
  "rows": [
    {
      "WorkflowName": "...",
      "DefVersion": "5",
      "RequestOfferingStatus": "Published",
      "BlockTitle": "...",
      "BlockType": "task",
      "TeamName": "..."
    }
  ]
}
```

### GET `/api/teams?db=WILLIAMS_PRD`

`db` defaults to the first entry in `DB_NAMES` if omitted.

### GET `/api/export/workflow-results.csv`

Accepts the same filter params as `/api/query` (`workflowName`, `blockType`, `teamName`, `status`, `db`) as query string parameters.

## Project Structure

```
app/
  page.tsx          — UI with filters and results table
  layout.tsx        — Root layout
  globals.css       — Global styles
  api/
    databases/route.ts           — List available databases
    query/route.ts               — Workflow block query endpoint
    teams/route.ts               — Active teams endpoint
    export/
      workflow-results.csv/
        route.ts                 — CSV export endpoint
lib/
  db.ts             — Multi-database connection pool management
  db-password.ts    — DPAPI password decryption utility (legacy single-db reference)
  workflow-query.ts — SQL query builder (used by query and export routes)
```

## Troubleshooting

### PM2 shows `errored` status

Run `pm2 logs workflow-query-app --lines 50` to see the crash output, then check the table below.

| Error | Cause | Fix |
|---|---|---|
| `SyntaxError: missing ) after argument list` in `node_modules/.bin/next` | PM2 tried to run the Unix bash wrapper instead of a Node.js file | Fixed in `ecosystem.config.js` — `script` now points to `node_modules/next/dist/bin/next` |
| DB connection errors or missing env vars | `.env.local` is missing or credentials are wrong | Create `.env.local` in the project root with the correct values (see Setup above) |
| `Login failed for user` | `DB_<KEY>_PASSWORD_ENCRYPTED` key name wrong in `.env.local` | Ensure the key matches the pattern `DB_<KEY>_PASSWORD_ENCRYPTED` |
| `Timeout: Request failed to complete in 15000ms` | Default mssql request timeout too short for large datasets | Already fixed in `lib/db.ts` — `requestTimeout` is set to 60s |

### PM2 config changes not taking effect

`pm2 restart` reuses the cached process definition and does **not** re-read `ecosystem.config.js`. After any change to `ecosystem.config.js`, run:

```bash
pm2 delete workflow-query-app
pm2 start ecosystem.config.js
pm2 save
```

### Export CSV does nothing in Chrome

If Chrome is managed by your organization (you'll see "Your browser is managed by your organization" in Chrome settings), it may block redirects from localhost. Fix:

1. In Chrome, go to **Settings → Privacy and security → Site settings → Pop-ups and redirects**
2. Under **Allowed to send pop-ups and use redirects**, click **Add**
3. Enter `http://localhost:3000` and click **Add**

Export CSV will work normally after this. Other browsers (Edge, Firefox) are not affected.

### App starts but team dropdown is empty or queries fail

Confirm the DB credentials in `.env.local` are correct and that the SQL Server is reachable from the machine running the app.
