-- Link contacts to their companies by matching company_name to crm_companies.name.
-- All contacts were imported with company_name but NULL company_id.

-- Step 1: Exact name match
UPDATE crm_contacts c
SET company_id = co.id
FROM crm_companies co
WHERE c.company_name = co.name
  AND (c.company_id IS NULL OR c.company_id = '');

-- Step 2: Case-insensitive match for remaining
UPDATE crm_contacts c
SET company_id = co.id
FROM crm_companies co
WHERE LOWER(TRIM(c.company_name)) = LOWER(TRIM(co.name))
  AND (c.company_id IS NULL OR c.company_id = '');

-- Step 3: Sync each company's contact_ids array from linked contacts
UPDATE crm_companies co
SET contact_ids = sub.ids
FROM (
  SELECT company_id, array_agg(id ORDER BY full_name) AS ids
  FROM crm_contacts
  WHERE company_id IS NOT NULL AND company_id != ''
  GROUP BY company_id
) sub
WHERE co.id = sub.company_id;
