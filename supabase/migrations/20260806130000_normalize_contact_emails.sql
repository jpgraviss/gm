-- AUDIT #751 — normalize crm_contacts.emails to lowercase.
--
-- Contact addresses are stored exactly as they arrive. POST /api/crm/contacts
-- writes body.emails verbatim; the CSV import lowercases only for its dedupe
-- comparison, never for what it inserts; the HubSpot import passes through
-- whatever HubSpot held. So the column contains a mix.
--
-- Fourteen lookups find a contact by address using Postgres array containment
-- (`contains`/`overlaps`), which is case-SENSITIVE. Several of them carefully
-- lowercase the value they search for — and that is what turns a cosmetic
-- inconsistency into a real bug, because a lowercase needle cannot match a
-- mixed-case stored value:
--
--   * app/api/forms/public/[slug] and .../funnel-submit search for the
--     lowercased address, miss the existing contact, and CREATE A DUPLICATE.
--     Every repeat form submission from `John@Acme.com` adds another row.
--   * app/api/extension/contact-lookup returns "not found" for a contact
--     that is plainly in the CRM.
--   * app/api/email/inbound and app/api/gmail/message fail to associate the
--     message with its contact, so the activity timeline silently misses it.
--
-- A TRIGGER here, deliberately, rather than the CHECK constraint used for
-- sequence_suppression_list in the previous migration. The two cases differ:
-- that table has five writers, all ours, and a bad row means emailing someone
-- who unsubscribed — worth failing loudly over. This column is written from
-- ~29 places including bulk imports of third-party data, where a hard failure
-- would abort an entire HubSpot or CSV import over one oddly-cased address.
-- Normalizing is the correct behaviour there; rejecting is not.
--
-- Safe to re-run.

BEGIN;

-- 1. Normalize every stored address.
--    Empty strings and NULL entries are dropped while we are here; they match
--    nothing and only pad the array.
UPDATE crm_contacts
SET emails = (
  SELECT COALESCE(array_agg(DISTINCT lower(btrim(e)) ORDER BY lower(btrim(e))), '{}')
  FROM unnest(emails) AS e
  WHERE e IS NOT NULL AND btrim(e) <> ''
)
WHERE emails IS NOT NULL
  AND emails <> (
    SELECT COALESCE(array_agg(DISTINCT lower(btrim(e)) ORDER BY lower(btrim(e))), '{}')
    FROM unnest(emails) AS e
    WHERE e IS NOT NULL AND btrim(e) <> ''
  );

-- 2. Keep it normalized no matter which of the ~29 writers is responsible.
CREATE OR REPLACE FUNCTION normalize_crm_contact_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.emails IS NOT NULL THEN
    NEW.emails := (
      SELECT COALESCE(array_agg(DISTINCT lower(btrim(e)) ORDER BY lower(btrim(e))), '{}')
      FROM unnest(NEW.emails) AS e
      WHERE e IS NOT NULL AND btrim(e) <> ''
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_crm_contact_emails ON crm_contacts;

CREATE TRIGGER trg_normalize_crm_contact_emails
  BEFORE INSERT OR UPDATE OF emails ON crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION normalize_crm_contact_emails();

COMMIT;

-- Verification — expect stray_case = 0 and trigger_installed = true.
--
-- SELECT
--   (SELECT count(*) FROM crm_contacts c, unnest(c.emails) e
--      WHERE e <> lower(btrim(e)))                                AS stray_case,
--   (SELECT count(*) > 0 FROM pg_trigger
--      WHERE tgname = 'trg_normalize_crm_contact_emails')         AS trigger_installed,
--   (SELECT count(*) FROM crm_contacts)                           AS total_contacts;
--
-- Duplicate contacts that the old case-sensitive lookups already created are
-- NOT merged here. Merging contact records is a judgement call about which
-- row's field values win, and the app has a Duplicates panel built for it
-- (app/crm/contacts -> DuplicatesPanel). This query lists them:
--
-- SELECT lower(btrim(e)) AS email, count(*) AS contact_rows,
--        array_agg(c.id) AS contact_ids, array_agg(c.full_name) AS names
-- FROM crm_contacts c, unnest(c.emails) e
-- WHERE e IS NOT NULL AND btrim(e) <> ''
-- GROUP BY 1 HAVING count(*) > 1
-- ORDER BY 2 DESC;
