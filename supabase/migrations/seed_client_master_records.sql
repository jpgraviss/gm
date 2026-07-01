-- Seed master client records, contracts, and renewal plan
-- Run in Supabase Dashboard > SQL Editor
-- Idempotent: uses ON CONFLICT DO UPDATE so it can be re-run safely

-- ─── 12 CRM Companies ─────────────────────────────────────────────────────────

INSERT INTO crm_companies (id, name, industry, status, owner, tags, size, hq, description, contact_ids, deal_ids, total_deal_value, created_date)
VALUES
  ('co-formetco',          'Formetco',           'Outdoor Advertising',      'Active Client', 'Jonathan Graviss', ARRAY['Premium'],                    '51-200', '', 'Premium tier. $900 SEO + $300 mgmt = $1,200/mo. Auto-renews yearly, 30-day notice.',                          '{}', '{}', 0, '2026-06-29'),
  ('co-franklin-outdoor',  'Franklin Outdoor',   'Outdoor Advertising',      'Active Client', 'Jonathan Graviss', ARRAY['Standard'],                   '11-50',  '', 'Standard tier. $750 SEO/mgmt. Renewal drafted, unsigned.',                                                     '{}', '{}', 0, '2026-06-29'),
  ('co-trailhead-media',   'Trailhead Media',    'Outdoor Advertising',      'Active Client', 'Jonathan Graviss', ARRAY['Standard'],                   '11-50',  '', 'Standard tier. $650 SEO/mgmt. Renewal drafted, unsigned.',                                                     '{}', '{}', 0, '2026-06-29'),
  ('co-opsiq',             'OpsIQ',              'Technology',               'Active Client', 'Jonathan Graviss', ARRAY['Standard','Discontinuing'],   '11-50',  '', 'Standard tier. $750 SEO/mgmt. Discontinuing -- let lapse, no renewal.',                                        '{}', '{}', 0, '2026-06-29'),
  ('co-capital-outdoor',   'Capital Outdoor',    'Outdoor Advertising',      'Active Client', 'Jonathan Graviss', ARRAY['Basic'],                      '11-50',  '', 'Basic tier. $550 SEO + $50 mgmt = $600/mo. Tier named in signed contract. Fixed term.',                        '{}', '{}', 0, '2026-06-29'),
  ('co-bmv-service',       'BMV Service',        'Automotive Services',      'Active Client', 'Jonathan Graviss', ARRAY['Basic','Legacy'],             '1-10',   '', 'Basic tier. $575 SEO/mgmt + ad spend ($150 or $75). Fixed term, legacy.',                                      '{}', '{}', 0, '2026-06-29'),
  ('co-niche-outdoor',     'Niche Outdoor',      'Outdoor Advertising',      'Active Client', 'Jonathan Graviss', ARRAY['Basic','Legacy'],             '1-10',   '', 'Basic tier (legacy, priced under Basic). $400 SEO/mgmt. Month-to-month, no end.',                              '{}', '{}', 0, '2026-06-29'),
  ('co-turbobrakes',       'TurboBrakes',        'Automotive Parts',         'Active Client', 'Jonathan Graviss', ARRAY['Basic'],                      '1-10',   '', 'Basic tier. $575 SEO/mgmt. Fixed term.',                                                                       '{}', '{}', 0, '2026-06-29'),
  ('co-interstate-outdoor','Interstate Outdoor',  'Outdoor Advertising',      'Active Client', 'Jonathan Graviss', ARRAY['Basic','Onboarding'],         '11-50',  '', 'Onboarding/Basic tier. $550 SEO + $350 mgmt = $900/mo. Contract says Standard. Month-to-month. Tier mismatch.', '{}', '{}', 0, '2026-06-29'),
  ('co-franklin-graphics', 'Franklin Graphics',  'Printing/Graphics',        'Active Client', 'Jonathan Graviss', ARRAY['Basic','Onboarding'],         '11-50',  '', 'Onboarding/Basic tier. $550 SEO + $350 mgmt = $900/mo. 12-mo term starts at launch. Launch pending.',          '{}', '{}', 0, '2026-06-29'),
  ('co-skydragon-designs', 'Skydragon Designs',  'Design',                   'Active Client', 'Jonathan Graviss', ARRAY['Unassigned'],                 '1-10',   '', 'Unassigned tier. $787.50 SEO/mgmt. Tier needs to be settled before renewal.',                                  '{}', '{}', 0, '2026-06-29'),
  ('co-organized-harmony', 'Organized Harmony',  'Professional Organizing',  'Active Client', 'Jonathan Graviss', ARRAY['Non-billing'],                '1-10',   '', 'Non-billing (family). Basic scope, $0. No contract. Exclude from MRR.',                                        '{}', '{}', 0, '2026-06-29')
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  industry    = EXCLUDED.industry,
  status      = EXCLUDED.status,
  owner       = EXCLUDED.owner,
  tags        = EXCLUDED.tags,
  size        = EXCLUDED.size,
  description = EXCLUDED.description;


-- ─── 8 Contracts (clients with active terms) ──────────────────────────────────

INSERT INTO contracts (id, company, status, value, billing_structure, start_date, duration, renewal_date, assigned_rep, service_type)
VALUES
  ('c-formetco-2026',          'Formetco',          'Fully Executed', 1200,   'Monthly', '2026-05-01', 12, '2027-04-30', 'Jonathan Graviss', 'SEO'),
  ('c-franklin-outdoor-2025',  'Franklin Outdoor',  'Fully Executed', 750,    'Monthly', '2025-08-01', 12, '2026-07-31', 'Jonathan Graviss', 'SEO'),
  ('c-trailhead-media-2025',   'Trailhead Media',   'Fully Executed', 650,    'Monthly', '2025-07-01', 12, '2026-06-30', 'Jonathan Graviss', 'SEO'),
  ('c-opsiq-2026',             'OpsIQ',             'Fully Executed', 750,    'Monthly', '2026-02-01', 12, '2027-01-31', 'Jonathan Graviss', 'SEO'),
  ('c-capital-outdoor-2026',   'Capital Outdoor',   'Fully Executed', 600,    'Monthly', '2026-03-01', 12, '2027-02-28', 'Jonathan Graviss', 'SEO'),
  ('c-bmv-service-2026',       'BMV Service',       'Fully Executed', 575,    'Monthly', '2026-04-01', 12, '2027-03-31', 'Jonathan Graviss', 'SEO'),
  ('c-turbobrakes-2026',       'TurboBrakes',       'Fully Executed', 575,    'Monthly', '2026-01-01', 12, '2026-12-31', 'Jonathan Graviss', 'SEO'),
  ('c-skydragon-designs-2026', 'Skydragon Designs', 'Fully Executed', 787.50, 'Monthly', '2026-02-01', 12, '2027-01-31', 'Jonathan Graviss', 'SEO')
ON CONFLICT (id) DO UPDATE SET
  company           = EXCLUDED.company,
  status            = EXCLUDED.status,
  value             = EXCLUDED.value,
  billing_structure = EXCLUDED.billing_structure,
  start_date        = EXCLUDED.start_date,
  duration          = EXCLUDED.duration,
  renewal_date      = EXCLUDED.renewal_date,
  assigned_rep      = EXCLUDED.assigned_rep,
  service_type      = EXCLUDED.service_type;


-- ─── 8 Renewal Plans (sorted by urgency) ──────────────────────────────────────

INSERT INTO renewals (id, company, contract_id, expiration_date, renewal_value, assigned_rep, status, days_until_expiry, service_type)
VALUES
  ('ren-trailhead-media',   'Trailhead Media',   'c-trailhead-media-2025',   '2026-06-30', 650,    'Jonathan Graviss', 'Upcoming',       1,   'SEO'),
  ('ren-franklin-outdoor',  'Franklin Outdoor',   'c-franklin-outdoor-2025',  '2026-07-31', 750,    'Jonathan Graviss', 'Upcoming',       32,  'SEO'),
  ('ren-turbobrakes',       'TurboBrakes',        'c-turbobrakes-2026',       '2026-12-31', 575,    'Jonathan Graviss', 'Upcoming',       185, 'SEO'),
  ('ren-skydragon-designs', 'Skydragon Designs',  'c-skydragon-designs-2026', '2027-01-31', 787.50, 'Jonathan Graviss', 'Upcoming',       216, 'SEO'),
  ('ren-opsiq',             'OpsIQ',              'c-opsiq-2026',             '2027-01-31', 0,      'Jonathan Graviss', 'Discontinuing',  216, 'SEO'),
  ('ren-capital-outdoor',   'Capital Outdoor',    'c-capital-outdoor-2026',   '2027-02-28', 600,    'Jonathan Graviss', 'Upcoming',       244, 'SEO'),
  ('ren-bmv-service',       'BMV Service',        'c-bmv-service-2026',       '2027-03-31', 575,    'Jonathan Graviss', 'Upcoming',       275, 'SEO'),
  ('ren-formetco',          'Formetco',           'c-formetco-2026',          '2027-04-30', 1200,   'Jonathan Graviss', 'Auto-Renew',     305, 'SEO')
ON CONFLICT (id) DO UPDATE SET
  company           = EXCLUDED.company,
  contract_id       = EXCLUDED.contract_id,
  expiration_date   = EXCLUDED.expiration_date,
  renewal_value     = EXCLUDED.renewal_value,
  assigned_rep      = EXCLUDED.assigned_rep,
  status            = EXCLUDED.status,
  days_until_expiry = EXCLUDED.days_until_expiry,
  service_type      = EXCLUDED.service_type;
