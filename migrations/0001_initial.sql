-- Optituning jobbstyring: første produksjonsskjema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  employee TEXT NOT NULL CHECK (employee IN ('Steffen', 'Henrik', 'Sæter', 'Nyansatt 1')),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '08:00',
  duration_mins INTEGER NOT NULL DEFAULT 90 CHECK (duration_mins BETWEEN 15 AND 720),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  customer_name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  org_no TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  location_captured_at TEXT NOT NULL DEFAULT '',
  job_type TEXT NOT NULL DEFAULT '',
  vehicle_info TEXT NOT NULL DEFAULT '',
  reg_no TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'unknown' CHECK (payment_method IN ('card', 'invoice', 'unknown')),
  invoice_email TEXT NOT NULL DEFAULT '',
  invoice_reference TEXT NOT NULL DEFAULT '',
  invoice_sent INTEGER NOT NULL DEFAULT 0 CHECK (invoice_sent IN (0, 1)),
  invoice_sent_at TEXT NOT NULL DEFAULT '',
  card_paid INTEGER NOT NULL DEFAULT 0 CHECK (card_paid IN (0, 1)),
  card_paid_at TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_date_employee
  ON jobs (date, employee, start_time)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_invoice_followup
  ON jobs (payment_method, invoice_sent, status, date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_customer
  ON jobs (customer_name)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  snapshot_json TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_job_events_occurred_at
  ON job_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id
  ON job_events (job_id, occurred_at DESC);
