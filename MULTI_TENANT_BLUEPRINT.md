# Mismo Multi-Tenant Blueprint

This blueprint converts legacy requirements and old document behavior into a reusable, audit-forward SaaS architecture for multiple companies.

## Goals

- Multi-company by default (strict tenant isolation)
- Legally defensible audit trail for all critical actions
- Reusable modules across industries, not hard-coded to one workflow
- Procedural UI flow: capture, review, investigate, document, report

## Tenant Model

Every core record includes `tenant_id` and is scoped by tenant-aware authorization checks.

- Tenant
- Roles (tenant-defined with default templates)
- Users
- Employees
- Content items (documents, bulletins, prompts/questions)
- Assignments + responses
- Alerts + investigations
- Audit logs + report snapshots

## Core Entities

## `tenants`
- `id`, `name`, `plan`, `status`, `created_at`, `updated_at`

## `roles`
- `id`, `tenant_id`, `name`, `permissions_json`, `created_at`, `updated_at`

## `users`
- `id`, `tenant_id`, `role_id`, `email`, `name`, `status`, `created_at`, `updated_at`

## `employees`
- `id`, `tenant_id`, `first_name`, `last_name`, `email`, `phone`
- `department_id`, `position_id`, `manager_id`
- `hire_date`, `termination_date`, `status`, `created_at`, `updated_at`

## `content_items`
- `id`, `tenant_id`, `type` (`document|bulletin|question`)
- `title`, `body_html`, `file_url`, `category_id`
- `version`, `effective_date`, `published_date`, `end_date`, `status`
- `created_by`, `created_at`, `updated_at`

## `dissemination_rules`
- `id`, `tenant_id`
- `trigger` (`interval|event_login|event_paydate|manual`)
- `cadence`, `audience_type`, `audience_json`, `content_item_ids`
- `status`, `created_at`, `updated_at`

## `assignments`
- `id`, `tenant_id`, `employee_id`, `content_item_id`
- `assigned_at`, `due_at`
- `status` (`pending|read_later|acknowledged|needs_clarification|overdue`)
- `completed_at`, `created_at`, `updated_at`

## `responses`
- `id`, `tenant_id`, `assignment_id`, `employee_id`
- `response_type` (`ack|yes_no|multi_choice|free_text`)
- `response_value`, `created_at`, `updated_at`

## `alerts`
- `id`, `tenant_id`, `triggered_by_response_id`
- `severity`, `route_to_role_id`, `route_to_user_id`
- `status` (`open|in_progress|closed`)
- `created_at`, `closed_at`, `updated_at`

## `investigations`
- `id`, `tenant_id`, `alert_id`, `investigator_user_id`
- `status`, `summary`, `created_at`, `updated_at`

## `form_submissions`
- `id`, `tenant_id`, `investigation_id`
- `form_type`, `payload_json`, `created_at`, `updated_at`

## `audit_logs`
- `id`, `tenant_id`, `actor_user_id`
- `action`, `entity_type`, `entity_id`, `diff_json`, `created_at`

## API Surface (v1)

## Auth + tenant context
- `POST /auth/login`
- `GET /auth/me`

## Admin
- `GET /admin/dashboard`
- `GET /admin/reports`
- `GET /admin/investigations`
- `GET /admin/activity`
- `POST /admin/content`
- `PATCH /admin/content/:id`
- `POST /admin/dissemination-rules`
- `PATCH /admin/dissemination-rules/:id`

## Employees
- `GET /employees`
- `PATCH /employees/:id`
- `POST /employees/import` (CSV with mapping template)
- `POST /employees/import/templates`
- `GET /employees/import/templates`

## Assignments + responses
- `GET /assignments`
- `POST /assignments/:id/respond`
- `POST /assignments/reminders`

## Alerts + investigations
- `GET /alerts`
- `PATCH /alerts/:id`
- `POST /investigations`
- `PATCH /investigations/:id`
- `POST /investigations/:id/forms`

## Reporting + exports
- `GET /exports/at-risk-emails.csv`
- `GET /reports/compliance-summary`
- `GET /reports/audit-log`

## RBAC Matrix (minimum)

- `SUPER_ADMIN`: tenant settings, users/roles, all modules
- `ADMIN`: content, dissemination, reports, investigations, exports
- `INVESTIGATOR`: investigation detail/update, restricted employee visibility
- `MANAGER`: team-level views and reminders
- `EMPLOYEE`: assigned items, self profile, self responses
- `CLIENT_VIEWER`: read-only executive reporting

## Event Bus Topics

- `content.published`
- `assignment.created`
- `assignment.status_changed`
- `response.submitted`
- `alert.created`
- `alert.routed`
- `investigation.created`
- `investigation.updated`
- `export.generated`

## Migration Plan (from current in-browser store)

1. Add backend tables with the schema above.
2. Add `tenant_id` to all existing local entities and default legacy tenant mapping.
3. Build import scripts to lift `localStorage` snapshots into seed tables.
4. Switch store write-paths to API (keep local read cache during transition).
5. Enforce RBAC and tenant scoping in every endpoint.
6. Enable full audit log writes for create/update/delete/status transitions.
7. Turn on export/report endpoints and validate legal traceability.

## Compliance + Defensibility Guardrails

- Never perform cross-tenant joins without explicit super-admin context.
- Every status change must write an audit log entry.
- Preserve immutable timeline entries for case and investigation state transitions.
- Use neutral procedural language in all generated notifications and UI states.
- Separate dashboard (quick check-in) from analytics (deep historical exploration).
