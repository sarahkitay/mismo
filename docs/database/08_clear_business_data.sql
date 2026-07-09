-- =============================================================================
-- MISMO — Remove sample / mock business data (keep org, departments, users)
-- Safe to run when migrating from old demo seeds to empty production dashboards.
-- =============================================================================

DELETE FROM investigation_note_attachments;
DELETE FROM investigation_notes;
DELETE FROM investigation_evidence;
DELETE FROM investigation_response_requests;
DELETE FROM investigation_corrective_actions;
DELETE FROM investigation_follow_ups;
DELETE FROM investigation_persons;
DELETE FROM investigation_subjects;
DELETE FROM investigation_witnesses;
DELETE FROM investigation_stage_history;
DELETE FROM investigation_linked_policies;
DELETE FROM investigation_linked_reports;
DELETE FROM investigations;

DELETE FROM report_attachments;
DELETE FROM report_messages;
DELETE FROM report_handling_ledger;
DELETE FROM report_checklist_items;
DELETE FROM report_status_events;
DELETE FROM reports;

DELETE FROM prompt_responses;
DELETE FROM prompt_deliveries;
DELETE FROM prompt_target_departments;
DELETE FROM prompt_target_users;
DELETE FROM prompts;

DELETE FROM policy_acknowledgements;
DELETE FROM policies;

DELETE FROM announcement_target_departments;
DELETE FROM announcements;

DELETE FROM nudges;
DELETE FROM activity_events;
DELETE FROM audit_logs;
DELETE FROM metrics_snapshots;
DELETE FROM check_in_deferrals;
DELETE FROM wage_hour_screening_acknowledgements;
DELETE FROM outreach_coach_sessions;
DELETE FROM hr_law_notifications;

DELETE FROM company_resources;
DELETE FROM emergency_hotlines;
