// ── ClickUp Space & Field IDs ─────────────────────────────────────────────────
export const EM_SPACE_ID = '90165413223'

export const FIELD_IDS = {
  clientTransitioned: 'cc80f6eb-dd7c-4f42-b240-175ab0d07e13',
  taskSource:         '285f4d84-37be-47db-be4a-45b9eb978f83',
  billingMonth:       '5e4917cb-4a24-4222-a526-3ecdcb881ebb',
  reqReceivedMonth:   'c629bf84-1f1f-47cb-b8bb-efe8fec3da98',
  brandEmail:         '348179c4-1d6e-493a-b5ae-7bf7c98abc23',
  deliverablesEM:     '82d1cacd-93bb-445a-b2fb-7e00000f7d2c',
  primaryDesigner:    'ec7f59f4-fdba-456b-ab58-603c8ce87825',
  primaryDeveloper:   'd231edbd-e657-4536-9f7d-c53ad250b2da',
}

// ── CSV column names (exact headers from ClickUp export) ─────────────────────
export const COL = {
  taskId:             'Task ID',
  taskName:           'Task Name',
  status:             'Status',
  list:               'List',
  dateCreated:        'Date Created',
  clientTransitioned: 'Clients (transitioned) (drop down)',
  brandEmail:         'Brands email (transitioned) (drop down)',
  taskSource:         'Task Source (drop down)',
  billingMonth:       'Billing Month (drop down)',
  reqReceivedMonth:   'Request Received Month (drop down)',
  deliverablesEM:     'Deliverables EM (drop down)',
  // Note: two "Primary Designer (users)" columns exist — we take the last one
  primaryDesigner:    'Primary Designer (users)',
  primaryDeveloper:   'Primary Developer (users)',
}

// ── Tracker output columns ────────────────────────────────────────────────────
export const TRACKER_COLS = [
  { key: 'date',        label: 'Date' },
  { key: 'client',      label: 'Clients (transitioned)' },
  { key: 'brand',       label: 'Brands email (transitioned)' },
  { key: 'taskName',    label: 'Task Name' },
  { key: 'deliverables',label: 'Deliverables EM' },
  { key: 'billingMonth',label: 'Billing Month' },
  { key: 'designer',    label: 'Primary Designer' },
  { key: 'developer',   label: 'Primary Developer' },
]

export const BILLING_MONTHS = [
  'January 2026', 'February 2026', 'March 2026', 'April 2026',
  'May 2026', 'June 2026', 'July 2026', 'August 2026',
]
