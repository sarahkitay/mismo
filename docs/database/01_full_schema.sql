-- =============================================================================
-- MISMO — Full PostgreSQL Schema (Supabase SQL Editor)
-- =============================================================================
--
-- Run in order: 01 → 02 → 03 → 04 → 05 (see docs/database/README.md)
-- App mapping: src/types/index.ts + src/hooks/useDataStore.ts
--
-- FRONTEND RULE: Never expose vendor names. Browser talks to Mismo API only.
--
-- TENANCY: Every business table includes org_id. Enforced via RLS (04_rls_policies.sql).
--
-- ID STRATEGY: TEXT primary keys for demo import compatibility.
--
-- =============================================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- =============================================================================
-- ENUM TYPES (mirror src/types/index.ts)
-- =============================================================================

CREATE TYPE user_role AS ENUM (
  'EMPLOYEE', 'HR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'CLIENT'
);

CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TYPE prompt_type AS ENUM (
  'INCIDENT', 'TEAM_DYNAMIC', 'MONTHLY_CHECKIN', 'CUSTOM'
);

CREATE TYPE prompt_cadence AS ENUM ('ONCE', 'WEEKLY', 'MONTHLY', 'QUARTERLY');

CREATE TYPE prompt_audience AS ENUM ('ALL', 'DEPARTMENT', 'USER_LIST');

CREATE TYPE prompt_status AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ARCHIVED');

CREATE TYPE delivery_status AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

CREATE TYPE prompt_answer AS ENUM ('NO_ISSUE', 'HAS_ISSUE');

CREATE TYPE report_category AS ENUM (
  'HARASSMENT', 'THEFT', 'SAFETY', 'DISCRIMINATION',
  'WAGE_HOURS', 'RETALIATION', 'OTHER'
);

CREATE TYPE report_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE report_status AS ENUM (
  'NEW', 'TRIAGED', 'ASSIGNED', 'IN_REVIEW', 'NEEDS_INFO',
  'PENDING_WAGE_HOUR_REVIEW', 'PAYROLL_EXPEDITED', 'RESOLVED', 'CLOSED'
);

CREATE TYPE case_type AS ENUM (
  'WORKPLACE_INVESTIGATION', 'WAGE_HOUR', 'ETHICS_COMPLAINT',
  'SAFETY_CONCERN', 'ACCOMMODATION_REQUEST'
);

CREATE TYPE report_source_type AS ENUM (
  'SELF_REPORTED', 'EMPLOYEE_PROMPT_RESPONSE', 'OSHA_PROMPT',
  'WAGE_HOUR_PROMPT', 'ANONYMOUS_HOTLINE', 'HR_SUBMITTED',
  'SUPERVISOR_SUBMITTED', 'COMPLIANCE_AUDIT', 'SYSTEM_TRIGGERED'
);

CREATE TYPE contact_method AS ENUM ('EMAIL', 'PHONE', 'IN_APP');

CREATE TYPE investigation_status AS ENUM ('OPEN', 'CLOSED');

CREATE TYPE investigation_workflow_phase AS ENUM (
  'QUEUED', 'IN_PROGRESS', 'AWAITING_OUTCOME_ACK'
);

CREATE TYPE investigation_stage AS ENUM (
  'INTAKE_RECEIVED', 'PENDING_REVIEW', 'ASSIGNED', 'IN_PROGRESS',
  'EMPLOYEE_FOLLOW_UP', 'EVIDENCE_REVIEW', 'FINDINGS_DRAFTED',
  'OUTCOME_PENDING', 'CLOSED'
);

CREATE TYPE investigation_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE investigation_person_role AS ENUM (
  'REPORTING_PARTY', 'REPORTED_AGAINST', 'WITNESS',
  'HR_REPRESENTATIVE', 'INVESTIGATOR', 'EXTERNAL_PARTY'
);

CREATE TYPE investigation_employee_contact AS ENUM (
  'IN_APP_MESSAGE', 'PHONE_CALL', 'EMAIL', 'IN_PERSON'
);

CREATE TYPE outcome_classification AS ENUM (
  'SUBSTANTIATED', 'PARTIALLY_SUBSTANTIATED', 'UNSUBSTANTIATED', 'INCONCLUSIVE',
  'POLICY_VIOLATION_CONFIRMED', 'CONDUCT_CONCERN', 'COACHING_ISSUED',
  'TERMINATION', 'WARNING_ISSUED', 'TRAINING_ASSIGNED', 'RESOLVED_INFORMALLY'
);

CREATE TYPE investigation_note_visibility AS ENUM ('INTERNAL', 'EMPLOYEE');

CREATE TYPE investigation_note_type AS ENUM (
  'PRIVATE_HR', 'SHARED', 'INTERVIEW', 'LEGAL', 'AI_SUMMARY',
  'OUTCOME_RATIONALE', 'FOLLOW_UP'
);

CREATE TYPE investigation_evidence_type AS ENUM (
  'DOCUMENT', 'EMAIL', 'SLACK', 'SCREENSHOT', 'PDF',
  'AUDIO', 'VIDEO', 'WRITTEN_STATEMENT', 'OTHER'
);

CREATE TYPE evidence_source_type AS ENUM ('UPLOAD', 'EMAIL_IMPORT', 'SYSTEM');

CREATE TYPE response_request_method AS ENUM (
  'IN_APP', 'WRITTEN_STATEMENT', 'ATTORNEY_STATEMENT', 'EMAIL', 'MEETING'
);

CREATE TYPE response_request_status AS ENUM (
  'DRAFT', 'SENT', 'VIEWED', 'SUBMITTED', 'OVERDUE', 'DECLINED'
);

CREATE TYPE corrective_action_type AS ENUM (
  'COACHING', 'WARNING', 'SUSPENSION', 'TERMINATION', 'TRAINING',
  'MEDIATION', 'REASSIGNMENT', 'MONITORING', 'POLICY_UPDATE', 'NO_ACTION'
);

CREATE TYPE corrective_action_status AS ENUM (
  'PENDING', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED'
);

CREATE TYPE follow_up_type AS ENUM (
  'RETALIATION_CHECK', 'WELLNESS', 'MANAGER_REVIEW',
  'CORRECTIVE_VERIFY', 'GENERAL'
);

CREATE TYPE follow_up_status AS ENUM (
  'SCHEDULED', 'COMPLETE', 'OVERDUE', 'CANCELLED'
);

CREATE TYPE nudge_channel AS ENUM ('EMAIL', 'SMS', 'MANUAL');

CREATE TYPE nudge_context_type AS ENUM (
  'PROMPT_REMINDER', 'AT_RISK_OUTREACH', 'MEMO_REMINDER',
  'CASE_REPORT_REMINDER', 'MANUAL_OUTREACH'
);

CREATE TYPE activity_event_type AS ENUM (
  'PROMPT_CREATED', 'PROMPT_SENT', 'PROMPT_RESPONSE', 'REPORT_CREATED',
  'REPORT_ASSIGNED', 'REPORT_STATUS_CHANGED', 'INVESTIGATION_CREATED',
  'INVESTIGATION_UPDATED', 'WAGE_HOUR_SCREENING', 'WAGE_HOUR_SUBMITTED',
  'PAYROLL_EXPEDITED', 'NUDGE_SENT', 'EXPORT_PDF', 'EXPORT_CSV'
);

CREATE TYPE policy_type AS ENUM ('GENERAL', 'SAFETY', 'CONDUCT', 'LEGAL');

CREATE TYPE policy_body_source AS ENUM ('EDITOR', 'UPLOAD', 'LINK');

CREATE TYPE content_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE policy_ack_outcome AS ENUM ('READ_UNDERSTOOD', 'REQUEST_CLARIFICATION');

CREATE TYPE company_resource_category AS ENUM (
  'REQUIRED_MEMO', 'EMPLOYEE_HANDBOOK', 'POLICIES_PROCEDURES',
  'SAFETY_SECURITY', 'WELLNESS', 'LEGAL_COMPLIANCE', 'SUPPORT_CONTACTS',
  'TRAINING_DEVELOPMENT', 'EMERGENCY_HOTLINE'
);

CREATE TYPE announcement_type AS ENUM ('HOLIDAY', 'GENERAL', 'URGENT');

CREATE TYPE announcement_status AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED');

CREATE TYPE report_handling_entry_type AS ENUM (
  'PLAN', 'ACTION_TAKEN', 'EMPLOYEE_RESPONSE', 'NOTE', 'FILE'
);

CREATE TYPE metric_window AS ENUM ('7d', '30d', '90d');

CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- =============================================================================
-- CORE: ORGANIZATIONS & DEPARTMENTS
-- =============================================================================

CREATE TABLE organizations (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  settings        JSONB NOT NULL DEFAULT '{
    "allowAnonymousReports": true,
    "enableSMS": false,
    "enableEmail": true,
    "showRecentActivityOnDashboard": true,
    "showReportsRequiringAttentionOnDashboard": true,
    "thresholds": {
      "atRiskNoResponseDays": 14,
      "atRiskMinResponseRate": 0.7,
      "criticalSLAHours": 24
    }
  }'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX idx_departments_org ON departments(org_id);

-- =============================================================================
-- USERS & AUTH
-- =============================================================================

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  org_id              TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id        UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  role                user_role NOT NULL DEFAULT 'EMPLOYEE',
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               CITEXT NOT NULL,
  phone               TEXT,
  employee_id         TEXT,
  location            TEXT,
  archive_start_date  DATE,
  archive_end_date    DATE,
  department_id       TEXT REFERENCES departments(id) ON DELETE SET NULL,
  manager_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  hired_date          DATE,
  state               TEXT,
  status              user_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_org_role ON users(org_id, role);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_manager ON users(manager_id);

CREATE INDEX idx_users_auth ON users(auth_user_id);

-- Legacy password table — prefer Supabase Auth; kept for migration from demo data
CREATE TABLE auth_credentials (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash     TEXT,
  legacy_external_id TEXT UNIQUE,
  last_login_at     TIMESTAMPTZ,
  mfa_enabled       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id            TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role              user_role NOT NULL,
  refresh_token_hash TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE TABLE user_notification_preferences (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled     BOOLEAN NOT NULL DEFAULT true,
  sms_enabled       BOOLEAN NOT NULL DEFAULT false,
  in_app_enabled    BOOLEAN NOT NULL DEFAULT true,
  preferences       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Replaces localStorage check-in deferral (src/lib/checkInGate.ts)
CREATE TABLE check_in_deferrals (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_delivery_id TEXT NOT NULL,
  deferred_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, prompt_delivery_id, deferred_on)
);

CREATE INDEX idx_check_in_deferrals_user_date ON check_in_deferrals(user_id, deferred_on);

-- =============================================================================
-- PROMPTS & CHECK-INS
-- =============================================================================

CREATE TABLE prompts (
  id                      TEXT PRIMARY KEY,
  org_id                  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type                    prompt_type NOT NULL,
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  cadence                 prompt_cadence NOT NULL DEFAULT 'ONCE',
  schedule_start_at       TIMESTAMPTZ NOT NULL,
  schedule_end_at         TIMESTAMPTZ,
  audience                prompt_audience NOT NULL DEFAULT 'ALL',
  severity_on_has_issue   report_severity NOT NULL DEFAULT 'HIGH',
  allow_anonymous_reports BOOLEAN NOT NULL DEFAULT false,
  status                  prompt_status NOT NULL DEFAULT 'DRAFT',
  route_to_payroll        BOOLEAN NOT NULL DEFAULT false,
  include_financial_question BOOLEAN NOT NULL DEFAULT false,
  created_by              TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompts_org_status ON prompts(org_id, status);

CREATE TABLE prompt_target_departments (
  prompt_id       TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  department_id   TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (prompt_id, department_id)
);

CREATE TABLE prompt_target_users (
  prompt_id       TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (prompt_id, user_id)
);

CREATE TABLE prompt_deliveries (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prompt_id       TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          delivery_status NOT NULL DEFAULT 'PENDING',
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at          TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_deliveries_org_user_status ON prompt_deliveries(org_id, user_id, status);
CREATE INDEX idx_prompt_deliveries_due ON prompt_deliveries(org_id, status, due_at);
CREATE UNIQUE INDEX idx_prompt_deliveries_daily
  ON prompt_deliveries(user_id, prompt_id, ((delivered_at AT TIME ZONE 'UTC')::date));

CREATE TABLE prompt_responses (
  id                  TEXT PRIMARY KEY,
  org_id              TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prompt_id           TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_delivery_id  TEXT NOT NULL REFERENCES prompt_deliveries(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer              prompt_answer NOT NULL,
  notes               TEXT,
  needs_review        BOOLEAN NOT NULL DEFAULT false,
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  finalized_at        TIMESTAMPTZ,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prompt_delivery_id)
);

CREATE INDEX idx_prompt_responses_org_answer ON prompt_responses(org_id, answer);
CREATE INDEX idx_prompt_responses_review ON prompt_responses(org_id, needs_review, reviewed_at);

-- =============================================================================
-- REPORTS / CASE REGISTER
-- =============================================================================

CREATE TABLE reports (
  id                          TEXT PRIMARY KEY,
  org_id                      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_anonymous                BOOLEAN NOT NULL DEFAULT false,
  source_prompt_id            TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  source_prompt_response_id   TEXT REFERENCES prompt_responses(id) ON DELETE SET NULL,
  report_source_type          report_source_type,
  case_type                   case_type,
  reference_number            TEXT,
  category                    report_category NOT NULL DEFAULT 'OTHER',
  severity                    report_severity NOT NULL DEFAULT 'MEDIUM',
  summary                     TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  people_involved             TEXT,
  location                    TEXT,
  incident_at                 TIMESTAMPTZ,
  status                      report_status NOT NULL DEFAULT 'NEW',
  assigned_to                 TEXT REFERENCES users(id) ON DELETE SET NULL,
  investigation_id            TEXT,  -- FK added after investigations table
  preferred_contact_method    contact_method,
  response_plan               TEXT,
  response_action_taken       TEXT,
  employee_response_outcome   TEXT,
  needs_extended_incident_intake BOOLEAN NOT NULL DEFAULT false,
  incident_intake_completed_at TIMESTAMPTZ,
  needs_extended_wage_hour_intake BOOLEAN NOT NULL DEFAULT false,
  wage_hour_intake_completed_at TIMESTAMPTZ,
  wage_hour_intake            JSONB,   -- WageHourIntakeData
  expedited_payroll           BOOLEAN NOT NULL DEFAULT false,
  payroll_sla_due_at          TIMESTAMPTZ,
  gina_build_notes            TEXT,
  evidence_metadata           JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, reference_number)
);

CREATE INDEX idx_reports_org_status ON reports(org_id, status);
CREATE INDEX idx_reports_org_severity ON reports(org_id, severity);
CREATE INDEX idx_reports_assigned ON reports(org_id, assigned_to);
CREATE INDEX idx_reports_source_prompt_response ON reports(source_prompt_response_id);
CREATE INDEX idx_reports_case_type ON reports(org_id, case_type);

CREATE TABLE report_attachments (
  id              TEXT PRIMARY KEY,
  report_id       TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  storage_key     TEXT NOT NULL,          -- private storage path (see 03_storage.sql)
  byte_size       BIGINT,
  uploaded_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_attachments_report ON report_attachments(report_id);

CREATE TABLE report_handling_ledger (
  id              TEXT PRIMARY KEY,
  report_id       TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  entry_type      report_handling_entry_type NOT NULL,
  text            TEXT NOT NULL,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  file_name       TEXT,
  file_size       BIGINT,
  storage_key     TEXT,                   -- private storage path for FILE entries
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_handling_ledger_report ON report_handling_ledger(report_id, created_at);

CREATE TABLE report_checklist_items (
  id              TEXT PRIMARY KEY,
  report_id       TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  section_id      TEXT,
  section_label   TEXT,
  label           TEXT NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT false,
  completed_at    TIMESTAMPTZ,
  completed_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  evidence_note   TEXT,
  evidence_file_name TEXT,
  evidence_storage_key TEXT
);

CREATE INDEX idx_report_checklist_report ON report_checklist_items(report_id, sort_order);

CREATE TABLE report_messages (
  id              TEXT PRIMARY KEY,
  report_id       TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_messages_report ON report_messages(report_id, created_at);

CREATE TABLE report_status_events (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id       TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  from_status     report_status NOT NULL,
  to_status       report_status NOT NULL,
  changed_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_status_events_report ON report_status_events(report_id, created_at);

CREATE TABLE wage_hour_screening_acknowledgements (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  has_concern     BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wage_hour_screening_user ON wage_hour_screening_acknowledgements(user_id, acknowledged_at);

-- =============================================================================
-- INVESTIGATIONS
-- =============================================================================

CREATE TABLE investigations (
  id                          TEXT PRIMARY KEY,
  org_id                      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference_number            TEXT,
  status                      investigation_status NOT NULL DEFAULT 'OPEN',
  owner_id                    TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category                    report_category,
  severity                    report_severity,
  workflow_phase              investigation_workflow_phase,
  stage                       investigation_stage,
  priority                    investigation_priority,
  investigation_type          TEXT,
  report_source_type          report_source_type,
  linked_prompt_id            TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  linked_prompt_response_id   TEXT REFERENCES prompt_responses(id) ON DELETE SET NULL,
  employee_preferred_contact  investigation_employee_contact,
  outcome_summary             TEXT,
  outcome_requires_signature  BOOLEAN NOT NULL DEFAULT false,
  outcome_sent_at             TIMESTAMPTZ,
  outcome_employee_signed_at  TIMESTAMPTZ,
  outcome_employee_agreed     BOOLEAN,
  outcome_classification      outcome_classification,
  outcome_viewed_at           TIMESTAMPTZ,
  outcome_attachment_name     TEXT,
  outcome_attachment_mime     TEXT,
  outcome_attachment_storage_key TEXT,
  findings_rationale          TEXT,
  policy_analysis_notes       TEXT,
  final_findings_report       TEXT,
  legal_involved              BOOLEAN NOT NULL DEFAULT false,
  legal_involvement_notes     TEXT,
  risk_level                  risk_level,
  department_id               TEXT REFERENCES departments(id) ON DELETE SET NULL,
  initial_contact_notes       TEXT,
  non_retaliation_sent_at     TIMESTAMPTZ,
  workflow_pages_completed    JSONB,
  checklist_stages            JSONB,      -- legacy InvestigationChecklistStage[]
  picked_up_at                TIMESTAMPTZ,
  opened_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at                   TIMESTAMPTZ,
  last_update_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, reference_number)
);

ALTER TABLE reports
  ADD CONSTRAINT fk_reports_investigation
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL;

CREATE INDEX idx_investigations_org_status ON investigations(org_id, status);
CREATE INDEX idx_investigations_owner ON investigations(org_id, owner_id);
CREATE INDEX idx_investigations_stage ON investigations(org_id, stage);

CREATE TABLE investigation_linked_reports (
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  report_id        TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  linked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (investigation_id, report_id)
);

CREATE TABLE investigation_subjects (
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (investigation_id, user_id)
);

CREATE TABLE investigation_witnesses (
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  external_name    TEXT,
  PRIMARY KEY (investigation_id, user_id, external_name)
);

CREATE TABLE investigation_persons (
  id              TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  role            investigation_person_role NOT NULL,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  external_name   TEXT,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_investigation_persons_inv ON investigation_persons(investigation_id);

CREATE TABLE investigation_stage_history (
  id              TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  stage           investigation_stage NOT NULL,
  entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  entered_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  owner_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  note            TEXT
);

CREATE INDEX idx_investigation_stage_history ON investigation_stage_history(investigation_id, entered_at);

CREATE TABLE investigation_notes (
  id                          TEXT PRIMARY KEY,
  investigation_id            TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  visibility                  investigation_note_visibility NOT NULL DEFAULT 'INTERNAL',
  note_type                   investigation_note_type,
  body                        TEXT NOT NULL,
  created_by_user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requires_employee_signature BOOLEAN NOT NULL DEFAULT false,
  employee_signed_at          TIMESTAMPTZ,
  sent_at                     TIMESTAMPTZ,
  viewed_at                   TIMESTAMPTZ,
  employee_agreed             BOOLEAN,
  pinned                      BOOLEAN NOT NULL DEFAULT false,
  tagged_user_ids             TEXT[] DEFAULT '{}',
  linked_evidence_ids         TEXT[] DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investigation_notes_inv ON investigation_notes(investigation_id, created_at);

CREATE TABLE investigation_note_attachments (
  id              TEXT PRIMARY KEY,
  note_id         TEXT NOT NULL REFERENCES investigation_notes(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  storage_key     TEXT NOT NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE investigation_evidence (
  id              TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  evidence_type   investigation_evidence_type NOT NULL,
  file_name       TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  storage_key     TEXT,
  description     TEXT,
  source_type     evidence_source_type NOT NULL DEFAULT 'UPLOAD',
  uploaded_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  preserved       BOOLEAN NOT NULL DEFAULT true,
  prompt_label    TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investigation_evidence_inv ON investigation_evidence(investigation_id);

CREATE TABLE investigation_response_requests (
  id              TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  party_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  party_role      investigation_person_role NOT NULL,
  method          response_request_method NOT NULL,
  status          response_request_status NOT NULL DEFAULT 'DRAFT',
  deadline        TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  submitted_at    TIMESTAMPTZ,
  message         TEXT,
  response_text   TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investigation_response_requests ON investigation_response_requests(investigation_id, status);

CREATE TABLE investigation_corrective_actions (
  id              TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  action_type     corrective_action_type NOT NULL,
  status          corrective_action_status NOT NULL DEFAULT 'PENDING',
  assignee_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  deadline        TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE investigation_follow_ups (
  id              TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  follow_up_type  follow_up_type NOT NULL,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  status          follow_up_status NOT NULL DEFAULT 'SCHEDULED',
  assignee_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes           TEXT,
  completed_at    TIMESTAMPTZ,
  concern_logged  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE investigation_linked_policies (
  investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  policy_id        TEXT NOT NULL,
  PRIMARY KEY (investigation_id, policy_id)
);

-- =============================================================================
-- MEMOS, RESOURCES, ANNOUNCEMENTS
-- =============================================================================

CREATE TABLE policies (
  id                      TEXT PRIMARY KEY,
  org_id                  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  type                    policy_type NOT NULL DEFAULT 'GENERAL',
  content                 TEXT NOT NULL DEFAULT '',
  effective_date          TIMESTAMPTZ NOT NULL,
  published_at            TIMESTAMPTZ,
  acknowledgment_required BOOLEAN NOT NULL DEFAULT false,
  superseded_by           TEXT REFERENCES policies(id) ON DELETE SET NULL,
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  status                  content_status NOT NULL DEFAULT 'DRAFT',
  memo_category           TEXT,
  completion_due_date     TIMESTAMPTZ,
  body_source             policy_body_source,
  body_attachment_file_name TEXT,
  body_attachment_storage_key TEXT,
  body_source_url         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_org_status ON policies(org_id, status);

CREATE TABLE policy_acknowledgements (
  policy_id           TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome             policy_ack_outcome,
  signature_storage_key TEXT,              -- PNG signature in private storage
  clarification_note  TEXT,
  PRIMARY KEY (policy_id, user_id)
);

CREATE INDEX idx_policy_ack_user ON policy_acknowledgements(user_id);

CREATE TABLE company_resources (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        company_resource_category NOT NULL,
  url             TEXT,
  phone           TEXT,
  status          content_status NOT NULL DEFAULT 'DRAFT',
  sort_order      INT NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_resources_org ON company_resources(org_id, status, category);

CREATE TABLE emergency_hotlines (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  description     TEXT,
  status          content_status NOT NULL DEFAULT 'PUBLISHED',
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_emergency_hotlines_org ON emergency_hotlines(org_id, status);

CREATE TABLE announcements (
  id                      TEXT PRIMARY KEY,
  org_id                  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  body                    TEXT NOT NULL,
  audience                prompt_audience NOT NULL DEFAULT 'ALL',
  type                    announcement_type NOT NULL DEFAULT 'GENERAL',
  status                  announcement_status NOT NULL DEFAULT 'DRAFT',
  publish_at              TIMESTAMPTZ,
  sent_at                 TIMESTAMPTZ,
  views_count             INT NOT NULL DEFAULT 0,
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE announcement_target_departments (
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  department_id   TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, department_id)
);

-- =============================================================================
-- OUTREACH, ACTIVITY, AUDIT, ANALYTICS
-- =============================================================================

CREATE TABLE nudges (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel         nudge_channel NOT NULL,
  message         TEXT NOT NULL,
  context_type    nudge_context_type NOT NULL,
  context_prompt_id TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  context_policy_id TEXT REFERENCES policies(id) ON DELETE SET NULL,
  context_report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
  context_related_label TEXT,
  sent_by_admin_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nudges_target ON nudges(org_id, target_user_id, sent_at);

CREATE TABLE activity_events (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      activity_event_type NOT NULL,
  actor_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_events_org_created ON activity_events(org_id, created_at DESC);
CREATE INDEX idx_activity_events_type ON activity_events(org_id, event_type);

CREATE TABLE audit_logs (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_type     TEXT NOT NULL,
  record_id       TEXT NOT NULL,
  field           TEXT,
  old_value       TEXT,
  new_value       TEXT,
  actor_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_record ON audit_logs(org_id, record_type, record_id);

CREATE TABLE metrics_snapshots (
  id                      TEXT PRIMARY KEY,
  org_id                  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  time_window             metric_window NOT NULL,
  response_rate           NUMERIC(5,4) NOT NULL DEFAULT 0,
  training_compliance     NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_resolution_time_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  reports_this_month      INT NOT NULL DEFAULT 0,
  category_breakdown      JSONB NOT NULL DEFAULT '{}'::jsonb,
  department_health       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metrics_snapshots_org_window ON metrics_snapshots(org_id, time_window, created_at DESC);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations', 'departments', 'users', 'auth_credentials',
    'prompts', 'prompt_deliveries', 'prompt_responses',
    'reports', 'report_status_events', 'investigations',
    'policies', 'company_resources', 'announcements', 'nudges'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- =============================================================================
-- HELPFUL VIEWS (dashboard / admin registers)
-- =============================================================================

CREATE OR REPLACE VIEW v_open_case_register AS
SELECT r.*
FROM reports r
LEFT JOIN investigations i ON i.id = r.investigation_id
WHERE r.status NOT IN ('RESOLVED', 'CLOSED')
  AND (r.investigation_id IS NULL OR i.status <> 'OPEN');

CREATE OR REPLACE VIEW v_pending_check_ins AS
SELECT d.*, p.title AS prompt_title, p.type AS prompt_type
FROM prompt_deliveries d
JOIN prompts p ON p.id = d.prompt_id
WHERE d.status = 'PENDING';

CREATE OR REPLACE VIEW v_yes_responses_needing_review AS
SELECT pr.*
FROM prompt_responses pr
WHERE pr.answer = 'HAS_ISSUE'
  AND pr.needs_review = true
  AND pr.reviewed_at IS NULL;

-- =============================================================================
-- ROLES: Supabase uses service_role (server) and anon/authenticated (client via RLS).
-- Do NOT expose service_role in the browser. See 04_rls_policies.sql.
-- =============================================================================
-- SEED: MINIMAL ORG (optional — matches demo org in mockData.ts)
-- =============================================================================

INSERT INTO organizations (id, name) VALUES
  ('org-mismo-1', 'Mismo Demo Organization')
ON CONFLICT (id) DO NOTHING;

INSERT INTO departments (id, org_id, name) VALUES
  ('dept-ops', 'org-mismo-1', 'Operations'),
  ('dept-hr', 'org-mismo-1', 'Human Resources')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================================
-- NEXT: Run 02_ai_hr_laws.sql, 03_storage.sql, 04_rls_policies.sql, 05_auth_bridge.sql
-- =============================================================================
--
-- Attachments: upload to private storage bucket; store storage_key path only.
--
-- localStorage → Postgres mapping: see docs/database/README.md
--
-- =============================================================================
