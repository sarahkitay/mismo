-- =============================================================================
-- MISMO — AI HR Law Monitor + Outreach Coach
-- Run AFTER 01_full_schema.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

CREATE TYPE hr_law_topic AS ENUM (
  'WAGE_HOUR',
  'LEAVE',
  'DISCRIMINATION',
  'HARASSMENT',
  'RETALIATION',
  'WORKPLACE_SAFETY',
  'PRIVACY',
  'RECORDKEEPING',
  'UNEMPLOYMENT',
  'OTHER'
);

CREATE TYPE hr_law_source_type AS ENUM (
  'STATUTE',
  'REGULATION',
  'AGENCY_GUIDANCE',
  'COURT_DECISION',
  'POSTER_REQUIREMENT',
  'OTHER'
);

CREATE TYPE hr_law_change_type AS ENUM (
  'NEW',
  'AMENDED',
  'REPEALED',
  'GUIDANCE_UPDATE',
  'DEADLINE'
);

CREATE TYPE ai_job_status AS ENUM (
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TYPE outreach_tone_level AS ENUM (
  'EMPATHETIC',
  'PROFESSIONAL',
  'NEUTRAL',
  'DIRECT',
  'FIRM',
  'HARSH'
);

-- -----------------------------------------------------------------------------
-- State HR law corpus (researched + curated)
-- -----------------------------------------------------------------------------

CREATE TABLE hr_law_jurisdictions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code    CHAR(2) NOT NULL UNIQUE,          -- US state/territory (e.g. CA, NY)
  state_name    TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr_law_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL REFERENCES hr_law_jurisdictions(id) ON DELETE CASCADE,
  topic           hr_law_topic NOT NULL,
  source_type     hr_law_source_type NOT NULL DEFAULT 'STATUTE',
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  full_text       TEXT,
  citation        TEXT,                            -- e.g. Cal. Lab. Code § 510
  source_url      TEXT,
  effective_date  DATE,
  content_hash    TEXT NOT NULL,                   -- SHA-256 of canonical summary for change detection
  openai_file_id  TEXT,                            -- optional: vector store / file id in OpenAI
  metadata        JSONB NOT NULL DEFAULT '{}',
  is_current      BOOLEAN NOT NULL DEFAULT TRUE,
  superseded_by   UUID REFERENCES hr_law_records(id),
  researched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (jurisdiction_id, citation, content_hash)
);

CREATE INDEX idx_hr_law_records_jurisdiction ON hr_law_records (jurisdiction_id, topic) WHERE is_current;
CREATE INDEX idx_hr_law_records_hash ON hr_law_records (content_hash);

-- Detected changes between sync runs
CREATE TABLE hr_law_updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = platform-wide
  jurisdiction_id UUID NOT NULL REFERENCES hr_law_jurisdictions(id),
  law_record_id   UUID REFERENCES hr_law_records(id),
  change_type     hr_law_change_type NOT NULL,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  previous_hash   TEXT,
  new_hash        TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_law_updates_pending_notify ON hr_law_updates (detected_at) WHERE notified_at IS NULL;

-- Per-org subscription: which states/topics to monitor
CREATE TABLE org_hr_law_watchlists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_codes     TEXT[] NOT NULL DEFAULT '{}',    -- e.g. {CA,NY,TX}
  topics          hr_law_topic[] NOT NULL DEFAULT '{}',
  notify_emails   TEXT[] NOT NULL DEFAULT '{}',
  notify_in_app   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

-- -----------------------------------------------------------------------------
-- AI job audit trail (OpenAI calls, token usage, errors)
-- -----------------------------------------------------------------------------

CREATE TABLE ai_job_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  job_type        TEXT NOT NULL,                   -- HR_LAW_SYNC | OUTREACH_COACH | LAW_DIGEST
  status          ai_job_status NOT NULL DEFAULT 'QUEUED',
  model           TEXT,
  prompt_version  TEXT,
  input_ref       TEXT,                            -- e.g. state_code, report_id
  tokens_in       INT,
  tokens_out      INT,
  latency_ms      INT,
  error_message   TEXT,
  result_summary  TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_job_runs_org_type ON ai_job_runs (org_id, job_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- Outreach tone coaching (HR case outreach drafts)
-- -----------------------------------------------------------------------------

CREATE TABLE outreach_coach_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id       TEXT REFERENCES reports(id) ON DELETE SET NULL,
  investigation_id TEXT REFERENCES investigations(id) ON DELETE SET NULL,
  created_by      TEXT NOT NULL REFERENCES users(id),
  jurisdiction    CHAR(2),                         -- employee work state for law context
  case_context    JSONB NOT NULL DEFAULT '{}',     -- category, severity, case type
  original_subject TEXT,
  original_body   TEXT NOT NULL,
  tone_level      outreach_tone_level NOT NULL,
  tone_score      SMALLINT NOT NULL CHECK (tone_score BETWEEN 1 AND 6),  -- 1=empathetic .. 6=harsh
  risk_flags      TEXT[] NOT NULL DEFAULT '{}',
  suggested_subject TEXT,
  suggested_body  TEXT,
  rationale       TEXT,
  applicable_laws JSONB NOT NULL DEFAULT '[]',     -- [{ citation, summary, relevance }]
  ai_job_run_id   UUID REFERENCES ai_job_runs(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outreach_coach_report ON outreach_coach_sessions (report_id, created_at DESC);

-- In-app notifications for law updates
CREATE TABLE hr_law_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  update_id       UUID NOT NULL REFERENCES hr_law_updates(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL = broadcast to admins
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  emailed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_law_notifications_org_unread ON hr_law_notifications (org_id, created_at DESC) WHERE read_at IS NULL;

-- Seed US jurisdictions (50 states + DC; extend as needed)
INSERT INTO hr_law_jurisdictions (state_code, state_name) VALUES
  ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),('CA','California'),
  ('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),('DC','District of Columbia'),
  ('FL','Florida'),('GA','Georgia'),('HI','Hawaii'),('ID','Idaho'),('IL','Illinois'),
  ('IN','Indiana'),('IA','Iowa'),('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),
  ('ME','Maine'),('MD','Maryland'),('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),
  ('MS','Mississippi'),('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),
  ('NH','New Hampshire'),('NJ','New Jersey'),('NM','New Mexico'),('NY','New York'),
  ('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),('OK','Oklahoma'),('OR','Oregon'),
  ('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),('SD','South Dakota'),
  ('TN','Tennessee'),('TX','Texas'),('UT','Utah'),('VT','Vermont'),('VA','Virginia'),
  ('WA','Washington'),('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming')
ON CONFLICT (state_code) DO NOTHING;

-- =============================================================================
-- Scheduled jobs: use Supabase Edge Functions + cron, or services/api on a scheduler.
-- OPENAI_API_KEY: server-side only (Edge Function secret / API env).
-- =============================================================================
