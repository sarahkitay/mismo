-- =============================================================================
-- MISMO — RLS for report/investigation child tables (and policy acks)
-- Safe to run multiple times.
-- =============================================================================
-- Live DB had RLS enabled on several child tables with ZERO policies, which
-- denies all authenticated access (including HR inserts into report_status_events).
-- =============================================================================

-- 1) report_status_events has org_id — standard org isolation
SELECT public.enable_org_rls('report_status_events');

-- Tighten writes to HR/admin (status history is an HR case-file trail).
-- Keep org-wide SELECT for authenticated org members who can already see the case
-- via reports policies; employees only need history for their own cases when loaded.
DROP POLICY IF EXISTS org_isolation_insert ON report_status_events;
DROP POLICY IF EXISTS org_isolation_update ON report_status_events;
DROP POLICY IF EXISTS org_isolation_delete ON report_status_events;

CREATE POLICY org_isolation_insert ON report_status_events
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND public.is_admin_or_hr()
  );

CREATE POLICY org_isolation_update ON report_status_events
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin_or_hr())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin_or_hr());

CREATE POLICY org_isolation_delete ON report_status_events
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin_or_hr());

-- Employees may read status events for cases they filed (matches reports_select).
DROP POLICY IF EXISTS org_isolation_select ON report_status_events;
CREATE POLICY org_isolation_select ON report_status_events
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      OR EXISTS (
        SELECT 1
        FROM public.reports r
        WHERE r.id = report_status_events.report_id
          AND r.org_id = public.current_org_id()
          AND r.created_by_user_id = public.current_app_user_id()
      )
    )
  );

-- 2) Report children without org_id — gate through parent report
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'report_messages',
    'report_checklist_items',
    'report_handling_ledger',
    'report_attachments'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS report_child_select ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS report_child_insert ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS report_child_update ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS report_child_delete ON %I;', t);

    EXECUTE format(
      'CREATE POLICY report_child_select ON %I FOR SELECT TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.reports r
           WHERE r.id = %I.report_id
             AND r.org_id = public.current_org_id()
             AND (
               public.is_admin_or_hr()
               OR r.created_by_user_id = public.current_app_user_id()
             )
         )
       );',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY report_child_insert ON %I FOR INSERT TO authenticated
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.reports r
           WHERE r.id = %I.report_id
             AND r.org_id = public.current_org_id()
             AND (
               public.is_admin_or_hr()
               OR r.created_by_user_id = public.current_app_user_id()
             )
         )
       );',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY report_child_update ON %I FOR UPDATE TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.reports r
           WHERE r.id = %I.report_id
             AND r.org_id = public.current_org_id()
             AND (
               public.is_admin_or_hr()
               OR r.created_by_user_id = public.current_app_user_id()
             )
         )
       )
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.reports r
           WHERE r.id = %I.report_id
             AND r.org_id = public.current_org_id()
             AND (
               public.is_admin_or_hr()
               OR r.created_by_user_id = public.current_app_user_id()
             )
         )
       );',
      t, t, t
    );
    EXECUTE format(
      'CREATE POLICY report_child_delete ON %I FOR DELETE TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.reports r
           WHERE r.id = %I.report_id
             AND r.org_id = public.current_org_id()
             AND public.is_admin_or_hr()
         )
       );',
      t, t
    );
  END LOOP;
END $$;

-- 3) Investigation children — gate through parent investigation (HR/admin)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'investigation_linked_reports',
    'investigation_notes',
    'investigation_evidence',
    'investigation_persons',
    'investigation_subjects',
    'investigation_witnesses',
    'investigation_stage_history',
    'investigation_response_requests',
    'investigation_corrective_actions',
    'investigation_follow_ups',
    'investigation_linked_policies'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS inv_child_select ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS inv_child_insert ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS inv_child_update ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS inv_child_delete ON %I;', t);
    EXECUTE format('DROP POLICY IF EXISTS inv_child_all ON %I;', t);

    EXECUTE format(
      'CREATE POLICY inv_child_select ON %I FOR SELECT TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.investigations i
           WHERE i.id = %I.investigation_id
             AND i.org_id = public.current_org_id()
             AND public.is_admin_or_hr()
         )
       );',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY inv_child_insert ON %I FOR INSERT TO authenticated
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.investigations i
           WHERE i.id = %I.investigation_id
             AND i.org_id = public.current_org_id()
             AND public.is_admin_or_hr()
         )
       );',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY inv_child_update ON %I FOR UPDATE TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.investigations i
           WHERE i.id = %I.investigation_id
             AND i.org_id = public.current_org_id()
             AND public.is_admin_or_hr()
         )
       )
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.investigations i
           WHERE i.id = %I.investigation_id
             AND i.org_id = public.current_org_id()
             AND public.is_admin_or_hr()
         )
       );',
      t, t, t
    );
    EXECUTE format(
      'CREATE POLICY inv_child_delete ON %I FOR DELETE TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.investigations i
           WHERE i.id = %I.investigation_id
             AND i.org_id = public.current_org_id()
             AND public.is_admin_or_hr()
         )
       );',
      t, t
    );
  END LOOP;
END $$;

-- Note attachments hang off investigation_notes (note_id), not investigation_id.
ALTER TABLE investigation_note_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inv_note_att_select ON investigation_note_attachments;
DROP POLICY IF EXISTS inv_note_att_insert ON investigation_note_attachments;
DROP POLICY IF EXISTS inv_note_att_update ON investigation_note_attachments;
DROP POLICY IF EXISTS inv_note_att_delete ON investigation_note_attachments;

CREATE POLICY inv_note_att_select ON investigation_note_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.investigation_notes n
      JOIN public.investigations i ON i.id = n.investigation_id
      WHERE n.id = investigation_note_attachments.note_id
        AND i.org_id = public.current_org_id()
        AND public.is_admin_or_hr()
    )
  );

CREATE POLICY inv_note_att_insert ON investigation_note_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.investigation_notes n
      JOIN public.investigations i ON i.id = n.investigation_id
      WHERE n.id = investigation_note_attachments.note_id
        AND i.org_id = public.current_org_id()
        AND public.is_admin_or_hr()
    )
  );

CREATE POLICY inv_note_att_update ON investigation_note_attachments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.investigation_notes n
      JOIN public.investigations i ON i.id = n.investigation_id
      WHERE n.id = investigation_note_attachments.note_id
        AND i.org_id = public.current_org_id()
        AND public.is_admin_or_hr()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.investigation_notes n
      JOIN public.investigations i ON i.id = n.investigation_id
      WHERE n.id = investigation_note_attachments.note_id
        AND i.org_id = public.current_org_id()
        AND public.is_admin_or_hr()
    )
  );

CREATE POLICY inv_note_att_delete ON investigation_note_attachments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.investigation_notes n
      JOIN public.investigations i ON i.id = n.investigation_id
      WHERE n.id = investigation_note_attachments.note_id
        AND i.org_id = public.current_org_id()
        AND public.is_admin_or_hr()
    )
  );

-- 4) policy_acknowledgements — employees ack own; HR sees org
ALTER TABLE policy_acknowledgements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_ack_select ON policy_acknowledgements;
DROP POLICY IF EXISTS policy_ack_insert ON policy_acknowledgements;
DROP POLICY IF EXISTS policy_ack_update ON policy_acknowledgements;
DROP POLICY IF EXISTS policy_ack_delete ON policy_acknowledgements;

CREATE POLICY policy_ack_select ON policy_acknowledgements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.id = policy_acknowledgements.policy_id
        AND p.org_id = public.current_org_id()
    )
    AND (
      public.is_admin_or_hr()
      OR user_id = public.current_app_user_id()
    )
  );

CREATE POLICY policy_ack_insert ON policy_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.current_app_user_id()
    AND EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.id = policy_acknowledgements.policy_id
        AND p.org_id = public.current_org_id()
    )
  );

CREATE POLICY policy_ack_update ON policy_acknowledgements
  FOR UPDATE TO authenticated
  USING (
    (
      user_id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
    AND EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.id = policy_acknowledgements.policy_id
        AND p.org_id = public.current_org_id()
    )
  )
  WITH CHECK (
    (
      user_id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
    AND EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.id = policy_acknowledgements.policy_id
        AND p.org_id = public.current_org_id()
    )
  );

CREATE POLICY policy_ack_delete ON policy_acknowledgements
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_hr()
    AND EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.id = policy_acknowledgements.policy_id
        AND p.org_id = public.current_org_id()
    )
  );
