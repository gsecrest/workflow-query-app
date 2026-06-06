# RO Workflow Query

**Quickly identify which team owns each request offering so you can manually correct team assignments without hunting through workflows.**

A Next.js internal tool that queries Ivanti ISM workflows to surface team ownership by block type across request offerings.

## Features

- Search workflows by **offering name**, **block type**, **team name**, and **offering status**
- Results show workflow name, version, offering status, block title, block type, and team name
- Supports multiple databases via environment config
- Export results to CSV / TSV
- Database Explorer at `/explore` for schema discovery queries

## Block Types Supported

| Block Type | Description |
|---|---|
| `quickaction` | QuickAction-based blocks — team from QuickAction JSON |
| `advancedtask_qa` | Advanced task blocks via QuickAction |
| `task` | Task blocks — team from `teamblock` property |
| `vote` / `vote0007` | Approval blocks — team from contact group |

## Tech Stack

- [Next.js 16](https://nextjs.org/)
- [React 19](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [mssql](https://www.npmjs.com/package/mssql) — SQL Server connectivity

## Setup

1. Clone the repo
2. Copy `.env.local.example` to `.env.local` and fill in your database credentials
3. Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```env
DB_NAMES=DB1,DB2
DB_DB1_LABEL=Production
DB_DB1_SERVER=your-server
DB_DB1_DATABASE=your-database
DB_DB1_USER=your-user
DB_DB1_PASSWORD=your-password
```

## Related Projects

- [RO Attribute Query](https://github.com/gsecrest/ro-attribute-query) — List form field attributes and workflow block details for request offerings
