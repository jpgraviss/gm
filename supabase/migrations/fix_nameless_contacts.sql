-- Fix contacts imported from HubSpot with no first/last name.
-- Derive names from email addresses where possible, delete generic/company emails.

-- ── Update contacts where we can derive names ──────────────────────────────────

UPDATE crm_contacts SET first_name = 'Allan', last_name = 'Atkins', full_name = 'Allan Atkins'
WHERE id = 'ct-hs-unknown-atkins-allan-b2f9e6';

UPDATE crm_contacts SET first_name = 'Dave', last_name = 'Westburg', full_name = 'Dave Westburg'
WHERE id = 'ct-hs-unknown-davewestburg-91231a';

UPDATE crm_contacts SET first_name = 'Matthew', last_name = 'O''Connell', full_name = 'Matthew O''Connell'
WHERE id = 'ct-hs-unknown-matthewoconnell-54447f';

UPDATE crm_contacts SET first_name = 'Cam', last_name = 'Russelle', full_name = 'Cam Russelle'
WHERE id = 'ct-hs-unknown-cam-t-russelle-53228a';

UPDATE crm_contacts SET first_name = 'Koby', last_name = 'Dean', full_name = 'Koby Dean'
WHERE id = 'ct-hs-dean-koby-dean-28d554';

UPDATE crm_contacts SET first_name = 'Megan', last_name = '', full_name = 'Megan'
WHERE id = 'ct-hs-unknown-megan-672925';

UPDATE crm_contacts SET first_name = 'Tony', last_name = 'C', full_name = 'Tony C'
WHERE id = 'ct-hs-unknown-tonyc-3aca0f';

UPDATE crm_contacts SET first_name = 'Muthu', last_name = '', full_name = 'Muthu'
WHERE id = 'ct-hs-unknown-muthu-5d4371';

UPDATE crm_contacts SET first_name = 'Anna', last_name = 'Savignano', full_name = 'Anna Savignano'
WHERE id = 'ct-hs-unknown-annas-e67d2c';

UPDATE crm_contacts SET first_name = 'N', last_name = 'Spencer', full_name = 'N Spencer'
WHERE id = 'ct-hs-unknown-nspencer-a0c98e';

UPDATE crm_contacts SET first_name = 'A', last_name = 'Ray', full_name = 'A Ray'
WHERE id = 'ct-hs-unknown-aray-daba6e';

UPDATE crm_contacts SET first_name = 'Brent', last_name = 'Baer', full_name = 'Brent Baer'
WHERE id = 'ct-hs-unknown-bbaer-2a2faa';

UPDATE crm_contacts SET first_name = 'Milano', last_name = 'D', full_name = 'Milano D'
WHERE id = 'ct-hs-unknown-milanod-384dd4';

-- ── Delete generic/company email contacts (not real people) ────────────────────

DELETE FROM crm_contacts WHERE id IN (
  'ct-hs-unknown-billing-ffbc84',       -- billing@gravissmarketing.com
  'ct-hs-unknown-info-134adc',          -- info@cantmiss.us
  'ct-hs-unknown-cantmissus-09ea3a',    -- cantmissus@gmail.com
  'ct-hs-unknown-ceo-1ae8bb',           -- ceo@opsiq.biz
  'ct-hs-unknown-growth-746d19',        -- growth@opsiq.biz
  'ct-hs-unknown-superhuman-e3e452',    -- superhuman@joinsuperhuman.io
  'ct-hs-unknown-marketing-a1e02e',     -- marketing@formetco.com
  'ct-hs-unknown-news-63aa16',          -- news@joinsalesbytes.ai
  'ct-hs-unknown-kasperhallberg25-bcba30', -- kasper.hallberg25@nordicleadpipeline.pro (spam)
  'ct-hs-unknown-anas-bb576e'             -- anas@formetco.com
);
