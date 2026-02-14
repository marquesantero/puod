-- Manual migration to consolidate business_groups into company_groups
-- This replaces the EF migration to have better control over data migration

BEGIN;

-- Step 1: Add missing columns to company_groups
ALTER TABLE company_groups
ADD COLUMN IF NOT EXISTS client_id uuid;

ALTER TABLE company_groups
ADD COLUMN IF NOT EXISTS slug text DEFAULT '';

-- Step 2: Delete old/duplicate data from company_groups that doesn't have proper structure
-- Keep only records that will be replaced by business_groups data
DELETE FROM company_groups WHERE client_id IS NULL;

-- Step 3: Copy all data from business_groups to company_groups
INSERT INTO company_groups (
    id, client_id, name, slug, description, is_active,
    created_at, updated_at, is_deleted, deleted_at,
    created_by, updated_by, deleted_by
)
SELECT
    id, client_id, name, slug, description, is_active,
    created_at, updated_at, is_deleted, deleted_at,
    created_by, updated_by, deleted_by
FROM business_groups
ON CONFLICT (id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at,
    is_deleted = EXCLUDED.is_deleted,
    deleted_at = EXCLUDED.deleted_at,
    updated_by = EXCLUDED.updated_by;

-- Step 4: Make client_id NOT NULL now that data is populated
ALTER TABLE company_groups
ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE company_groups
ALTER COLUMN slug SET NOT NULL;

-- Step 5: Update integrations - copy business_group_id to company_group_id if needed
UPDATE integrations
SET company_group_id = business_group_id
WHERE business_group_id IS NOT NULL;

-- Step 6: Rename columns in other tables
-- profiles: business_group_id -> company_group_id (already exists as business_group_id)
-- (EF migration will handle this)

-- Step 7: Drop old foreign keys
ALTER TABLE auth_profiles DROP CONSTRAINT IF EXISTS "FK_auth_profiles_business_groups_BusinessGroupId";
ALTER TABLE groups DROP CONSTRAINT IF EXISTS "FK_groups_business_groups_BusinessGroupId";
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS "FK_integrations_business_groups_business_group_id";
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS "FK_profiles_business_groups_business_group_id";
ALTER TABLE roles DROP CONSTRAINT IF EXISTS "FK_roles_business_groups_BusinessGroupId";

-- Step 8: Drop business_groups table
DROP TABLE IF EXISTS business_groups CASCADE;

-- Step 9: Create indexes on company_groups
CREATE INDEX IF NOT EXISTS "IX_company_groups_client_id_is_deleted"
ON company_groups (client_id, is_deleted);

CREATE UNIQUE INDEX IF NOT EXISTS "IX_company_groups_client_id_slug_is_deleted"
ON company_groups (client_id, slug, is_deleted);

-- Step 10: Add foreign key from company_groups to clients
ALTER TABLE company_groups
ADD CONSTRAINT "FK_company_groups_clients_client_id"
FOREIGN KEY (client_id)
REFERENCES clients(id)
ON DELETE RESTRICT;

-- Step 11: Add foreign keys from other tables to company_groups (if not exists)
-- (integrations and auth_profiles already have company_group_id column)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FK_integrations_company_groups_company_group_id'
    ) THEN
        ALTER TABLE integrations
        ADD CONSTRAINT "FK_integrations_company_groups_company_group_id"
        FOREIGN KEY (company_group_id)
        REFERENCES company_groups(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'FK_auth_profiles_company_groups_company_group_id'
    ) THEN
        ALTER TABLE auth_profiles
        ADD CONSTRAINT "FK_auth_profiles_company_groups_company_group_id"
        FOREIGN KEY (company_group_id)
        REFERENCES company_groups(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

COMMIT;

SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as company_groups_count FROM company_groups;
