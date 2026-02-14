-- PRE-Migration: Save business_groups data before EF migration drops the table
BEGIN;

-- Create temporary backup table
CREATE TEMP TABLE IF NOT EXISTS business_groups_backup AS
SELECT * FROM business_groups;

SELECT COUNT(*) as rows_backed_up FROM business_groups_backup;

COMMIT;

-- After running this, apply the EF migration: dotnet ef database update
-- Then run PostMigration_RestoreBusinessGroupsData.sql
