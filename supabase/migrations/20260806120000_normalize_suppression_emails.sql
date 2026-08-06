-- AUDIT #750 — normalize sequence_suppression_list.email to lowercase.
--
-- Every reader of this table lowercases the address it is looking for
-- (app/api/sequences/[id]/enroll/route.ts even says so in a comment), but
-- nothing enforced that rows were stored lowercase. Any row written with
-- capitals is invisible to those checks, which means an unsubscribe that
-- silently did not take: the person keeps receiving broadcasts, sequence
-- steps and review requests.
--
-- The application code now normalizes on both sides, so new rows are fine
-- and mixed-case legacy rows are matched at read time. This migration fixes
-- the stored data as well, so the table means one thing, and adds a
-- constraint so it cannot drift again.
--
-- Safe to re-run.

BEGIN;

-- 1. Collapse duplicates that differ only by case, keeping the OLDEST row
--    (the earliest unsubscribe is the one that should be on record).
--    Done before the UPDATE, because lowercasing first would violate the
--    unique constraint on email.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(email))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM sequence_suppression_list
  WHERE email IS NOT NULL
)
DELETE FROM sequence_suppression_list s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- 2. Normalize what is left.
UPDATE sequence_suppression_list
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

-- 3. Keep it that way. A CHECK is deliberate rather than a trigger: an
--    insert with capitals should fail loudly at the point the bug is
--    written, not be silently corrected, so the offending writer gets
--    found instead of masked.
ALTER TABLE sequence_suppression_list
  DROP CONSTRAINT IF EXISTS sequence_suppression_list_email_lowercase;

ALTER TABLE sequence_suppression_list
  ADD CONSTRAINT sequence_suppression_list_email_lowercase
  CHECK (email IS NULL OR email = lower(btrim(email)));

COMMIT;

-- Verification — expect stray_case = 0, and duplicates = 0.
--
-- SELECT
--   (SELECT count(*) FROM sequence_suppression_list
--      WHERE email IS NOT NULL AND email <> lower(btrim(email))) AS stray_case,
--   (SELECT count(*) FROM (
--      SELECT lower(btrim(email)) FROM sequence_suppression_list
--      WHERE email IS NOT NULL
--      GROUP BY 1 HAVING count(*) > 1) d)                        AS duplicates,
--   (SELECT count(*) FROM sequence_suppression_list)             AS total_rows;
