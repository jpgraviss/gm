-- Normalize stored service values to the restructured catalog.
--
-- Context: `lib/services.ts` gained a recurring/one-time/pass-through/other
-- classification and several renames (SEO / AEO / GEO → SEO Management,
-- Social Media → Social Media Management, plus new billing categories). The
-- catalog's alias table means the app *resolves* old values correctly, so
-- nothing was broken — but the stored values themselves were stale, and a
-- few were genuinely wrong rather than merely old.
--
-- Written against the real values in the live database (queried 2026-08-05),
-- not against a guess at what might be in there. Tables not touched below
-- (invoices, proposals, tickets, time_entries, maintenance_records) returned
-- zero rows in that survey — they are empty, so there is nothing to migrate.
--
-- Deliberately excluded, because they need a human decision rather than a
-- rule (see the report at the end of this file): 'General', 'Custom',
-- 'Management', 'New Deal', and the multi-service deal titles whose
-- "Website" half is ambiguous between Build and Management.

BEGIN;

-- ── A. Straight renames — old and new mean the same thing ────────────────
-- 'SEO Basic' is a pricing TIER of SEO Management ("Basic"/"Standard"/
-- "Premium"), not a service in its own right; it leaked into the service
-- field. Same service either way, so this is a rename, not a reclassification.

CREATE TEMP TABLE service_rename(old text PRIMARY KEY, new text) ON COMMIT DROP;
INSERT INTO service_rename VALUES
  ('SEO',                   'SEO Management'),
  ('AEO',                   'SEO Management'),
  ('GEO',                   'SEO Management'),
  ('SEO / AEO',             'SEO Management'),
  ('SEO / AEO / GEO',       'SEO Management'),
  ('SEO Basic',             'SEO Management'),
  ('Social Media',          'Social Media Management'),
  ('PPC',                   'Advertising Management'),
  ('Paid Ads',              'Advertising Management'),
  ('Ad Management',         'Advertising Management'),
  ('Ad Spend',              'Advertising Spend'),
  ('Media Spend',           'Advertising Spend'),
  ('Travel Expense',        'Client Reimbursable Expenses'),
  ('Amazon Order',          'Client Reimbursable Expenses'),
  ('Reimbursable Expenses', 'Client Reimbursable Expenses'),
  ('Expenses',              'Client Reimbursable Expenses'),
  ('Fractional Sales Lead', 'Fractional Sales Lead / CRO'),
  ('Cancellation Fee',      'Cancellation'),
  ('Early Termination',     'Cancellation'),
  ('Hourly',                'Hourly Services'),
  ('Hourly Consulting',     'Hourly Services');

UPDATE public.contracts t SET service_type = r.new FROM service_rename r WHERE t.service_type = r.old;
UPDATE public.renewals  t SET service_type = r.new FROM service_rename r WHERE t.service_type = r.old;
UPDATE public.projects  t SET service_type = r.new FROM service_rename r WHERE t.service_type = r.old;
UPDATE public.deals     t SET service_type = r.new FROM service_rename r WHERE t.service_type = r.old;

UPDATE public.projects p SET service_types = ARRAY(
  SELECT COALESCE(r.new, e) FROM unnest(p.service_types) e LEFT JOIN service_rename r ON r.old = e)
  WHERE EXISTS (SELECT 1 FROM unnest(p.service_types) e JOIN service_rename r ON r.old = e);

UPDATE public.deals d SET service_types = ARRAY(
  SELECT COALESCE(r.new, e) FROM unnest(d.service_types) e LEFT JOIN service_rename r ON r.old = e)
  WHERE EXISTS (SELECT 1 FROM unnest(d.service_types) e JOIN service_rename r ON r.old = e);

-- ── B. `deals.service_type` held deal TITLES, not services ───────────────
-- The Asana/register import wrote each deal's name into this column. Where
-- the title names its service unambiguously, resolve it; where it names
-- several, use the `service_types[]` array the schema already has (and set
-- `service_type` to the first, per this repo's service_type = service_types[0]
-- convention). Titles that don't clearly identify a service are left alone
-- and reported at the end rather than guessed at.

-- Single service, unambiguous from the title
UPDATE public.deals SET service_type = 'Website Build', service_types = ARRAY['Website Build']
 WHERE service_type IN ('Website Rebuild', 'E-Commerce Site');

UPDATE public.deals SET service_type = 'Website Management', service_types = ARRAY['Website Management']
 WHERE service_type = 'Website Maintenance Transfer';

UPDATE public.deals SET service_type = 'Sales Training', service_types = ARRAY['Sales Training']
 WHERE service_type IN (
   'Sales Training Sprint', 'Sales Training 2/26', 'Sales Training Expansion 26',
   'Onboarding Training May ''26', 'Anthony Onboarding Training', 'AE Onboarding');

-- Multi-service, where every component is explicit in the title
UPDATE public.deals SET service_types = ARRAY['Website Build','Website Management','SEO Management'],
                        service_type  = 'Website Build'
 WHERE service_type = 'Website Design, Web Maintenance & SEO';

UPDATE public.deals SET service_types = ARRAY['Website Build','Website Management'],
                        service_type  = 'Website Build'
 WHERE service_type = '2026 Website Redesign + Hosting';

UPDATE public.deals SET service_types = ARRAY['SEO Management','Website Management'],
                        service_type  = 'SEO Management'
 WHERE service_type = 'SEO + Website Maintenance';

UPDATE public.deals SET service_types = ARRAY['Website Management'],
                        service_type  = 'Website Management'
 WHERE service_type = 'Web + Maintenance';

UPDATE public.deals SET service_types = ARRAY['SEO Management','Advertising Management'],
                        service_type  = 'SEO Management'
 WHERE service_type = 'SEO / Google Ads';

UPDATE public.deals SET service_types = ARRAY['SEO Management','Hourly Services'],
                        service_type  = 'SEO Management'
 WHERE service_type = 'SEO / Consulting';

COMMIT;

-- ── What remains, and why it wasn't touched ──────────────────────────────
-- Run this to see everything still not resolving to a catalog service.
-- Each needs a human call — the title genuinely doesn't determine the answer,
-- and guessing would put real revenue in the wrong bucket:
--
--   'General' (41 deals, 2 projects)  the honest default for "not yet set"
--   'Custom'  (1 project)             ditto
--   'Management' (1 contract, 1 renewal)  Website Management? SEO Management?
--   'New Deal' (1)                    placeholder title
--   'Scoreboard Designer' (1)         a build? creative work? neither is certain
--   'Sales Consulting' (1)            Sales Coaching, or Hourly Services?
--   'Sales Systems Proposal' (1)      Sales Enablement, most likely
--   'Website + SEO', 'Website + SEO 26', 'Website / SEO' (3)
--   'SEO Basic + Management' (1)      is "Management" here SEO or Website?
--   'Training + CRM + Website 26' (1) CRM isn't a service in the catalog
--
-- The "Website" half of those combos is the blocker: Website Build is
-- one-time and Website Management is recurring, so picking wrong moves real
-- money between revenue buckets.
--
--   SELECT 'deals' AS tbl, service_type, count(*) FROM public.deals
--    WHERE service_type NOT IN (
--      'Website Build','Website Management','SEO Management',
--      'Social Media Management','Advertising Management','Email Marketing',
--      'Fractional CMO','Sales Training','Sales Enablement','Sales Coaching',
--      'Sales Enablement Support','Fractional Sales Lead / CRO',
--      'Advertising Spend','Client Reimbursable Expenses',
--      'Onboarding and Setup Fee','Content and Creative','Cancellation',
--      'Hourly Services')
--    GROUP BY 2 ORDER BY 3 DESC;
