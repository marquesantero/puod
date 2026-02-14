-- Migration script to consolidate business_groups into company_groups
-- This should be run BEFORE applying the ConsolidateToCompanyGroups EF migration

BEGIN;

-- Step 1: Copy data from business_groups to company_groups if business_groups has data
INSERT INTO company_groups (id, client_id, name, slug, description, is_active, created_at, updated_at, is_deleted, deleted_at, created_by, updated_by, deleted_by)
SELECT
    id,
    client_id,
    name,
    slug,
    description,
    is_active,
    created_at,
    updated_at,
    is_deleted,
    deleted_at,
    created_by,
    updated_by,
    deleted_by
FROM business_groups
WHERE id NOT IN (SELECT id FROM company_groups)
ON CONFLICT (id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    slug = EXCLUDED.slug;

-- Step 2: Update profiles that reference business_groups to reference company_groups
-- The business_group_id column in profiles will be renamed to company_group_id by the EF migration
-- No action needed here as the data is already in the right column

-- Step 3: Update integrations - change from business_group_id to company_group_id
UPDATE integrations
SET company_group_id = business_group_id
WHERE business_group_id IS NOT NULL
  AND company_group_id IS NULL;

-- Step 4: Update auth_profiles - change from BusinessGroupId to company_group_id
-- Note: auth_profiles might have a different column name case
UPDATE auth_profiles
SET company_group_id = COALESCE(company_group_id,
    (SELECT id FROM company_groups cg
     WHERE cg.id = (SELECT business_group_id FROM business_groups bg LIMIT 1)))
WHERE company_group_id IS NULL;

COMMIT;

-- After this script, run the EF migration which will:
-- 1. Drop business_groups table
-- 2. Rename business_group_id columns to company_group_id
-- 3. Add client_id and slug to company_groups if missing
-- 4. Create proper foreign keys
