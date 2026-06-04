# Find Team by Block Type & Workflow — Documentation v11

## Overview

The Workflow Query App is a web-based tool for finding which team owns a block within an Ivanti workflow. It queries the Ivanti SQL Server database and returns matching workflow blocks with their team assignments.

The app is accessible at **http://localhost:3000** and requires no login.

---

## Search Filters

The app provides four search filters. All filters are optional — leave any field blank to search across all values.

| Filter | Description |
|---|---|
| **Database** | Select which Ivanti environment to query (e.g. Williams PRD). Changing the database reloads the Team / Group dropdown for that environment. |
| **Workflow Name** | Partial name search. Supports multiple words — each word is matched independently, so typing `Ivanti Test` finds workflows containing both words anywhere in the name. |
| **Block Type** | Filter by the type of workflow block. See Block Types section below. |
| **Status** | Filter by the request offering status: Published, Design, or leave blank for all. |

Click **Run Query** to execute. Click **Clear** to reset all filters and results.

---

## Results Table

| Column | Description |
|---|---|
| **Workflow Name** | Name of the workflow |
| **Version** | Latest definition version number |
| **Offering Status** | Status of the linked request offering: `Published (Automatic)`, `Design`, or `No Offering` if no request offering has been linked yet |
| **Block Title** | Title of the matching workflow block |
| **Block Type** | The type of block (see Block Types below) |
| **Team / Group** | Team assigned to the block. Approval groups (from Get Approval blocks) are shown with a `group` tag. |

### Extended Task sub-rows

When an Extended Task block has both a task-level team assignment **and** a QuickAction OwnerTeam, both appear as separate rows. The QuickAction OwnerTeam row is shown indented (↳) beneath the Extended Task row with a shaded background, making the relationship visually clear.

---

## Block Types

| Block Type Value | Display Label | Description |
|---|---|---|
| `task` | **Task** | Standard task block with a direct team assignment |
| `advancedtask` | **Extended Task** | Advanced task block — team assigned via the task-level teamblock property |
| `advancedtask_qa` | **Extended Task (QA)** | The OwnerTeam set via the QuickAction associated with an Extended Task block. Appears as an indented sub-row beneath its Extended Task |
| `quickaction` | **Quick Action** | Standalone Quick Action block with an OwnerTeam assignment |
| `update` | **Update** | Updates fields on an existing record |
| `create` | **Insert Child** | Creates a child record (older block type) |
| `createnew0002` | **Create Object** | Creates a new object via QuickAction (current block type) |
| `vote0007` | **Get Approval** | Approval block — sends a request to an approval group |
| `vote` | **Get Approval** | Older approval block type, functionally equivalent to `vote0007`. Found in legacy workflows. Both `vote` and `vote0007` are returned when Get Approval is selected. |

> **Note on `vote` blocks:** Legacy workflows such as "Software Installation Request (Legacy)" and "New Computer Request (Legacy)" use the older `vote` block type. These may return no team results if their linked approval groups are no longer active in the system.

> **Note on `notification` blocks:** Notification blocks carry no team assignments and are excluded from the Block Type filter.

---

## Exporting Results

When results are returned, two export options appear in the results header:

- **Copy to Clipboard** — Copies results as tab-separated values. Paste directly into Excel and columns will align automatically.
- **Export CSV** — Downloads results as a `.csv` file.

---

## Multiple Database Support

The app supports multiple Ivanti environments. The **Database** dropdown at the top of the filters lists all configured environments. Switching databases:
- Reloads the Team / Group dropdown with teams from the selected environment
- Clears any existing results
- Applies to all queries, exports, and team lookups

New environments are added by updating the `.env.local` configuration file on the server — no code changes are needed.

---

## How Teams Are Resolved

The app resolves team assignments through three paths, which are combined in the final results:

### Path 1 — QuickAction OwnerTeam
Applies to blocks with an associated QuickAction (`createnew0002`, `quickaction`, `update`, `create`, and `advancedtask`). The QuickAction's `Definition` is inspected for an `OwnerTeam` field with a non-null value. For `advancedtask` blocks, this row is shown as **Extended Task (QA)**.

### Path 2 — Task Teamblock
Applies to blocks with a `teamblock` property (`task`, `advancedtask`). The team value is read from the `team` or `teamEx` parameter within the teamblock. For `advancedtask` blocks, this row is shown as **Extended Task**.

### Path 3 — Approval Group
Applies to `vote0007` and `vote` blocks. The approval group GUID is extracted from the block XML and joined to the `ContactGroup` table to resolve the group name. Only active groups with type `Service Request Approval` are returned.

---

## Offering Status

The **Offering Status** column reflects the status of the request offering linked to the workflow:

| Status | Meaning |
|---|---|
| `Published (Automatic)` | The request offering is live and available to end users |
| `Design` | The request offering is in draft/design state |
| `No Offering` | The workflow exists but has no request offering linked to it yet |

Workflows with `No Offering` status are included in results — previously these were excluded.

---

## Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org) installed on the machine
- Access to the Ivanti SQL Server database
- A `.env.local` file in the project root (see below)

### Configure .env.local

The app supports one or more Ivanti database environments. Add each as a named entry under `DB_NAMES`:

```
DB_NAMES=WILLIAMS_PRD

DB_WILLIAMS_PRD_LABEL=Williams PRD
DB_WILLIAMS_PRD_SERVER=your-sql-server
DB_WILLIAMS_PRD_DATABASE=your-database
DB_WILLIAMS_PRD_USER=your-username
DB_WILLIAMS_PRD_PASSWORD=your-password
DB_WILLIAMS_PRD_PORT=1433
```

To add a second environment, append it to `DB_NAMES` (comma-separated) and add its vars:

```
DB_NAMES=WILLIAMS_PRD,ACME_PRD

DB_ACME_PRD_LABEL=Acme PRD
DB_ACME_PRD_SERVER=acme-server.example.com
...
```

### Install and Run (Development)

```bash
npm install       # installs dependencies locally — no global install required
npm run dev       # starts the dev server at http://localhost:3000
```

### Windows Deployment (Run in Background / Auto-start on Boot)

Use `setup-windows.bat` (run as Administrator for Option 1). When prompted, choose:

**Option 1 — Global install (recommended for production)**
- Installs PM2 system-wide
- App starts automatically on Windows boot
- Requires Administrator
- Use plain `pm2` commands

**Option 2 — Local via npx (no global install)**
- No system-wide install required
- App does **not** start automatically on boot — must be restarted manually after reboot
- No Administrator required
- Prefix all PM2 commands with `npx`

The script automatically encrypts any plaintext `DB_*_PASSWORD` values in `.env.local` using Windows DPAPI before building, so passwords are never stored in plaintext in production.

**PM2 commands (Option 1):**
```
pm2 status                         check if app is running
pm2 logs workflow-query-app        view app logs
pm2 restart workflow-query-app     restart the app
pm2 stop workflow-query-app        stop the app
```

**PM2 commands (Option 2 — prefix with npx):**
```
npx pm2 status
npx pm2 logs workflow-query-app
npx pm2 restart workflow-query-app
npx pm2 stop workflow-query-app
```

---

## Version History

| Version | Changes |
|---|---|
| v11 | Added Installation & Setup section covering .env.local multi-DB format, dev server setup, and Windows deployment with Option 1 (global PM2, auto-start on boot) and Option 2 (local via npx). setup-windows.bat updated to prompt for install option and handle new multi-DB password encryption. |
| v10 | SQL query performance optimizations: BlockType computed once per block; QuickAction definitions pre-materialised per unique QAID; OwnerTeam extraction uses single combined CHARINDEX; WorkflowOffering scoped to matched workflows only. |
| v9 | Multi-database support; Extended Task (QA) sub-row display; block type labels (Task, Extended Task, Insert Child, Create Object, Get Approval, Update, Quick Action); multi-word workflow name search; No Offering workflows now shown; fixed QuickAction OwnerTeam resolution for long `ntext` definitions; `vote` and `vote0007` merged under Get Approval filter |
| v8 | Previous version |
