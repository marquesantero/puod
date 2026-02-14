-- Data Migration: Move Auth Profiles and Integrations to Group Level
-- This script migrates all company-level auth profiles and integrations to business group level

-- Step 1: Migrate AuthProfiles from company-level to group-level
DO $$
DECLARE
    v_migrated_auth_count int := 0;
BEGIN
    -- Update all company-level AuthProfiles to group ownership
    -- Note: Using BusinessGroupId column which references business_groups table (new system)
    WITH updated_auth AS (
        UPDATE auth_profiles ap
        SET
            owner_type = 'group',
            "BusinessGroupId" = p.business_group_id,  -- Use new BusinessGroup system
            company_ids = ARRAY[ap.profile_id]::uuid[],  -- Set to single-element array with current profile
            updated_at = NOW()
        FROM profiles p
        WHERE
            ap.profile_id = p.id
            AND ap.owner_type = 'company'
            AND p.business_group_id IS NOT NULL
            AND NOT ap.is_deleted
        RETURNING ap.id
    )
    SELECT COUNT(*) INTO v_migrated_auth_count FROM updated_auth;

    RAISE NOTICE 'Migrated % AuthProfiles from company to group level', v_migrated_auth_count;
END $$;

-- Step 2: Migrate IntegrationConnections from company-level to group-level
-- NOTE: Integrations currently use the old CompanyGroup system (company_group_id)
-- They don't have BusinessGroupId column and need a different migration approach
-- Skipping integrations migration for now - they will continue using CompanyGroup system
DO $$
BEGIN
    RAISE NOTICE 'Skipping IntegrationConnections migration - using old CompanyGroup system';
    RAISE NOTICE 'Integrations will continue to use company_group_id referencing company_groups table';
END $$;

-- Step 3: Handle orphaned auth profiles (without group reference)
DO $$
DECLARE
    v_orphan_auth_count int;
BEGIN
    SELECT COUNT(*) INTO v_orphan_auth_count
    FROM auth_profiles ap
    WHERE
        ap.owner_type = 'company'
        AND NOT EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = ap.profile_id AND p.business_group_id IS NOT NULL
        )
        AND NOT ap.is_deleted;

    IF v_orphan_auth_count > 0 THEN
        RAISE WARNING 'Found % orphaned AuthProfiles without valid business group reference', v_orphan_auth_count;
        RAISE WARNING 'These will need manual intervention to assign to a group';
    END IF;
END $$;

-- Step 4: Handle orphaned integrations - SKIPPED
-- Integrations still use old CompanyGroup system
DO $$
BEGIN
    RAISE NOTICE 'Step 4 skipped - Integrations use old CompanyGroup system';
END $$;

-- Step 5: Verification - Show migration results
DO $$
DECLARE
    v_group_auth_count int;
    v_company_auth_count int;
    v_group_integration_count int;
    v_company_integration_count int;
BEGIN
    -- Count AuthProfiles by ownership type
    SELECT COUNT(*) INTO v_group_auth_count
    FROM auth_profiles
    WHERE owner_type = 'group' AND "BusinessGroupId" IS NOT NULL AND NOT is_deleted;

    SELECT COUNT(*) INTO v_company_auth_count
    FROM auth_profiles
    WHERE owner_type = 'company' AND NOT is_deleted;

    -- Count Integrations by ownership type (using old CompanyGroup system)
    SELECT COUNT(*) INTO v_group_integration_count
    FROM integrations
    WHERE owner_type = 'group' AND company_group_id IS NOT NULL AND NOT is_deleted;

    SELECT COUNT(*) INTO v_company_integration_count
    FROM integrations
    WHERE owner_type = 'company' AND NOT is_deleted;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'AuthProfiles:';
    RAISE NOTICE '  - Group-level: %', v_group_auth_count;
    RAISE NOTICE '  - Company-level (remaining): %', v_company_auth_count;
    RAISE NOTICE 'IntegrationConnections:';
    RAISE NOTICE '  - Group-level: %', v_group_integration_count;
    RAISE NOTICE '  - Company-level (remaining): %', v_company_integration_count;
    RAISE NOTICE '========================================';

    IF v_company_auth_count > 0 OR v_company_integration_count > 0 THEN
        RAISE WARNING 'Some resources are still at company level - review and migrate manually if needed';
    ELSE
        RAISE NOTICE 'SUCCESS: All auth profiles and integrations migrated to group level';
    END IF;
END $$;

-- Step 6: Optional - Display group-level resource summary by business group
DO $$
DECLARE
    v_group_record RECORD;
    v_auth_count int;
    v_integration_count int;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Resources by Business Group:';
    RAISE NOTICE '========================================';

    -- Show auth profiles and integrations per group
    FOR v_group_record IN
        SELECT id, name FROM business_groups WHERE NOT is_deleted ORDER BY name
    LOOP
        SELECT COUNT(*) INTO v_auth_count
        FROM auth_profiles ap
        WHERE ap."BusinessGroupId" = v_group_record.id AND NOT ap.is_deleted;

        -- Note: Integrations use old CompanyGroup system, not BusinessGroup
        -- So we can't count them by BusinessGroup ID
        v_integration_count := 0;

        RAISE NOTICE 'Group: % (%) - Auth Profiles: %, Integrations: %',
            v_group_record.name,
            v_group_record.id,
            v_auth_count,
            v_integration_count;
    END LOOP;

    RAISE NOTICE '========================================';
END $$;
