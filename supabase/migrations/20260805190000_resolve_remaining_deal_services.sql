-- Resolve the last deal titles left in `deals.service_type`.
--
-- The previous migration (20260805180000) handled everything the title
-- stated outright and stopped at 11 values that needed a judgment call,
-- chiefly because "Website" is ambiguous between Website Build (one-time)
-- and Website Management (recurring).
--
-- That ambiguity is now resolved FROM THE DATA rather than by guessing: the
-- same deal set contains 'Website Maintenance Transfer' and 'Web +
-- Maintenance' as distinct titles. The team names management deals
-- explicitly, so a title saying only "Website" is a build. Every call below
-- follows that reading.
--
-- Scope note: these are `deals` — pipeline opportunities, not booked
-- revenue. `computeMRR()` reads `contracts`, so nothing here moves MRR or
-- ARR; it affects the one-time/recurring split in the pipeline forecast
-- (lib/deal-reporting.ts). That is why these were reasonable to decide,
-- where the equivalent call on a contract would not have been.
--
-- Where a title was genuinely 50/50, the choice is the one that does NOT
-- overstate recurring revenue — consistent with the rest of this work.
--
-- 'General' (41 deals) is deliberately untouched. It is the honest default
-- for "not categorised yet"; inventing a service for 41 deals would be
-- fabricating data, not fixing it.

BEGIN;

-- ── "Website" alone = a build ────────────────────────────────────────────
-- Justified by the sibling titles above naming maintenance explicitly.
UPDATE public.deals SET service_type = 'Website Build', service_types = ARRAY['Website Build']
 WHERE service_type = 'Website';

-- ── Website + SEO combos ─────────────────────────────────────────────────
-- The classic agency pairing: build the site, then run SEO on it. Same
-- "Website = build" reading as above.
UPDATE public.deals SET service_types = ARRAY['Website Build','SEO Management'],
                        service_type  = 'Website Build'
 WHERE service_type IN ('Website + SEO', 'Website + SEO 26', 'Website / SEO');

-- ── 'SEO Basic + Management' ─────────────────────────────────────────────
-- 'SEO Basic' is the Basic tier of SEO Management, so the trailing
-- "Management" must refer to something else — Website Management, the only
-- other management service sold. Reading it as SEO Management alone would
-- make the "+ Management" half meaningless.
UPDATE public.deals SET service_types = ARRAY['SEO Management','Website Management'],
                        service_type  = 'SEO Management'
 WHERE service_type = 'SEO Basic + Management';

-- ── 'Training + CRM + Website 26' ────────────────────────────────────────
-- Sales Training is explicit. "CRM" isn't a catalog service on its own —
-- CRM build/config is what Sales Enablement covers. "Website" reads as a
-- build per the rule above.
UPDATE public.deals SET service_types = ARRAY['Sales Training','Sales Enablement','Website Build'],
                        service_type  = 'Sales Training'
 WHERE service_type = 'Training + CRM + Website 26';

-- ── 'Sales Systems Proposal' ─────────────────────────────────────────────
-- Building a client's sales system is precisely Sales Enablement
-- (Foundation / Core Build / System tiers).
UPDATE public.deals SET service_type = 'Sales Enablement', service_types = ARRAY['Sales Enablement']
 WHERE service_type = 'Sales Systems Proposal';

-- ── 'Sales Consulting' ───────────────────────────────────────────────────
-- Genuinely 50/50 between Sales Coaching (ongoing retainer) and Hourly
-- Services (ad-hoc blocks). Chosen as Hourly Services because it does not
-- overstate recurring revenue — the conservative direction. Flip it to
-- 'Sales Coaching' if this is in fact a standing monthly engagement.
UPDATE public.deals SET service_type = 'Hourly Services', service_types = ARRAY['Hourly Services']
 WHERE service_type = 'Sales Consulting';

-- ── 'Scoreboard Designer' ────────────────────────────────────────────────
-- A design deliverable rather than a site build or a retainer.
UPDATE public.deals SET service_type = 'Content and Creative', service_types = ARRAY['Content and Creative']
 WHERE service_type = 'Scoreboard Designer';

-- ── 'New Deal' ───────────────────────────────────────────────────────────
-- A placeholder title from deal creation, not a service. Reset to the same
-- default the other 41 uncategorised deals carry, so it stops looking like
-- a real classification.
UPDATE public.deals SET service_type = 'General', service_types = ARRAY[]::text[]
 WHERE service_type = 'New Deal';

COMMIT;

-- Every change above is a plain UPDATE keyed on the old string, so any
-- single call can be reverted by setting that deal's service_type back — no
-- data is lost, and the deal's own name/title column is untouched throughout.
--
-- After running, only 'General' should remain unresolved:
--
--   SELECT service_type, count(*) FROM public.deals
--    WHERE service_type NOT IN (
--      'Website Build','Website Management','SEO Management',
--      'Social Media Management','Advertising Management','Email Marketing',
--      'Fractional CMO','Sales Training','Sales Enablement','Sales Coaching',
--      'Sales Enablement Support','Fractional Sales Lead / CRO',
--      'Advertising Spend','Client Reimbursable Expenses',
--      'Onboarding and Setup Fee','Content and Creative','Cancellation',
--      'Hourly Services')
--    GROUP BY 1 ORDER BY 2 DESC;
