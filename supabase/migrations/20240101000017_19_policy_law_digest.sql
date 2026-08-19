-- Law digest memos: store synced law snapshots on policies and what each employee signed.
-- Safe to run multiple times.

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS law_digest JSONB;

ALTER TABLE policy_acknowledgements
  ADD COLUMN IF NOT EXISTS acknowledged_law_digest JSONB;

COMMENT ON COLUMN policies.law_digest IS
  'State HR law digest metadata: { stateCode, stateName, syncedAt, entries[] }';
COMMENT ON COLUMN policy_acknowledgements.acknowledged_law_digest IS
  'Law digest entries the employee acknowledged (full snapshot at sign time)';
