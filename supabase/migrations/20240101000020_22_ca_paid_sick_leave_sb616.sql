-- =============================================================================
-- MISMO — Correct California Paid Sick Leave corpus (SB 616 / Lab. Code § 246)
-- Safe to run multiple times.
-- =============================================================================
-- Statewide floor increased from 24 hours / 3 days to 40 hours / 5 days
-- effective January 1, 2024. Employee-facing memos must not publish the old floor.

UPDATE hr_law_records
SET
  summary = 'Effective January 1, 2024 (SB 616), California employers must generally provide and allow employees to use at least 40 hours or five days of paid sick leave per year (Labor Code § 246). Sick leave may be used for the employee''s or a family member''s health needs. Accrual or front-loading rules apply depending on employer policy; local ordinances that require more leave still control when more generous.',
  citation = 'California Labor Code § 246 (as amended by SB 616, effective Jan 1, 2024)',
  source_url = 'https://www.dir.ca.gov/dlse/paid_sick_leave.htm',
  updated_at = now()
WHERE title ILIKE '%California Paid Sick Leave%'
   OR (
     summary ILIKE '%paid sick%'
     AND summary ILIKE '%24 hours%'
     AND summary ILIKE '%three days%'
   );
