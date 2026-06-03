# Transitioned Client Billing Tracker

Internal tool for Optimite to reconcile and generate the monthly EM billing tracker.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your ClickUp API token to .env.local (optional — can enter in UI)
npm run dev
```

## How it works

1. **Upload** — Export CSV from ClickUp (EM space, date range = billing month) and upload
2. **Reconcile** — App fetches the live `Clients (transitioned)` dropdown from ClickUp and runs 4-set reconciliation:
   - **Set D** — Ground truth: tasks where client field matches live ClickUp dropdown
   - **Set A** — Billable: Task Source = Transitioned + Billing Month = month + Req Month = month
   - **Set B** — Source tagged: Task Source = Transitioned
   - **Set C** — Month tagged: Billing Month = month OR Req Month = month
   - All 3 must equal D. Gaps shown with exact fix instructions and direct ClickUp task links.
3. **Export** — Downloads `[Month]_[Year]_EM_Billing_Tracker.xlsx` with 3 tabs: Master (Set A), Set B, Set C

## ClickUp export instructions

1. Go to Team Email Marketing space → Tasks view
2. Filter: Date Created = last day of previous month → last day of billing month
3. Export → Export to CSV
4. Upload here

## Env vars

| Variable | Description |
|---|---|
| `VITE_CLICKUP_TOKEN` | ClickUp personal API token (pre-fills the UI) |

Never commit `.env.local`.
