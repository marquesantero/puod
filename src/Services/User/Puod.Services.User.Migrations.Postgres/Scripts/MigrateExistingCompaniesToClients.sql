-- Data Migration: Migrate Existing Companies to Client Hierarchy
-- This script migrates existing Platform and White Cube companies to the new Client → BusinessGroup → Company structure

-- Step 1: Create Platform Client from existing Platform company
DO $$
DECLARE
    v_platform_profile_id uuid;
    v_platform_client_id uuid := gen_random_uuid();
    v_platform_group_id uuid := gen_random_uuid();
BEGIN
    -- Find existing Platform profile
    SELECT id INTO v_platform_profile_id
    FROM profiles
    WHERE LOWER(name) = 'platform' AND NOT is_deleted
    LIMIT 1;

    IF v_platform_profile_id IS NOT NULL THEN
        -- Create Platform Client (UNALTERABLE)
        INSERT INTO clients (
            id, name, slug, tier, is_alterable, is_active,
            tax_id, website, email, phone, address, city, state, country, postal_code,
            description, industry, employee_count, founded_date, logo_url,
            created_at, updated_at, is_deleted, deleted_at, created_by, updated_by, deleted_by
        )
        SELECT
            v_platform_client_id,
            p.name,
            p.slug || '_client',  -- Add suffix to avoid conflict
            p.tier::text,  -- Convert enum to string
            false,  -- Platform is UNALTERABLE
            p.is_active,
            p.tax_id, p.website, p.email, p.phone, p.address, p.city, p.state, p.country, p.postal_code,
            p.description, p.industry, p.employee_count, p.founded_date, p.logo_url,
            p.created_at, p.updated_at, false, NULL, p.created_by, p.updated_by, NULL
        FROM profiles p
        WHERE p.id = v_platform_profile_id;

        -- Create "Puod" BusinessGroup for Platform
        INSERT INTO business_groups (
            id, client_id, name, slug, description, is_active,
            created_at, updated_at, is_deleted, deleted_at, created_by, updated_by, deleted_by
        )
        SELECT
            v_platform_group_id,
            v_platform_client_id,
            'Puod',  -- Default group name for Platform
            'puod',
            'Platform default business group',
            true,
            NOW(), NULL, false, NULL, p.created_by, NULL, NULL
        FROM profiles p
        WHERE p.id = v_platform_profile_id;

        -- Update Platform profile with client and group references
        UPDATE profiles
        SET
            client_id = v_platform_client_id,
            business_group_id = v_platform_group_id,
            inherit_from_client = true,
            updated_at = NOW()
        WHERE id = v_platform_profile_id;

        RAISE NOTICE 'Platform company migrated: Profile ID %, Client ID %, Group ID %',
            v_platform_profile_id, v_platform_client_id, v_platform_group_id;
    ELSE
        RAISE NOTICE 'Platform profile not found - skipping Platform migration';
    END IF;
END $$;

-- Step 2: Create White Cube Client from existing White Cube company
DO $$
DECLARE
    v_whitecube_profile_id uuid;
    v_whitecube_client_id uuid := gen_random_uuid();
    v_whitecube_group_id uuid := gen_random_uuid();
BEGIN
    -- Find existing White Cube profile
    SELECT id INTO v_whitecube_profile_id
    FROM profiles
    WHERE LOWER(name) = 'white cube' AND NOT is_deleted
    LIMIT 1;

    IF v_whitecube_profile_id IS NOT NULL THEN
        -- Create White Cube Client (ALTERABLE)
        INSERT INTO clients (
            id, name, slug, tier, is_alterable, is_active,
            tax_id, website, email, phone, address, city, state, country, postal_code,
            description, industry, employee_count, founded_date, logo_url,
            created_at, updated_at, is_deleted, deleted_at, created_by, updated_by, deleted_by
        )
        SELECT
            v_whitecube_client_id,
            p.name,
            p.slug || '_client',  -- Add suffix to avoid conflict
            p.tier::text,  -- Convert enum to string
            true,  -- White Cube is ALTERABLE
            p.is_active,
            p.tax_id, p.website, p.email, p.phone, p.address, p.city, p.state, p.country, p.postal_code,
            p.description, p.industry, p.employee_count, p.founded_date, p.logo_url,
            p.created_at, p.updated_at, false, NULL, p.created_by, p.updated_by, NULL
        FROM profiles p
        WHERE p.id = v_whitecube_profile_id;

        -- Create "Think IT" BusinessGroup for White Cube
        INSERT INTO business_groups (
            id, client_id, name, slug, description, is_active,
            created_at, updated_at, is_deleted, deleted_at, created_by, updated_by, deleted_by
        )
        SELECT
            v_whitecube_group_id,
            v_whitecube_client_id,
            'Think IT',  -- Default group name for White Cube
            'think-it',
            'White Cube default business group',
            true,
            NOW(), NULL, false, NULL, p.created_by, NULL, NULL
        FROM profiles p
        WHERE p.id = v_whitecube_profile_id;

        -- Update White Cube profile with client and group references
        UPDATE profiles
        SET
            client_id = v_whitecube_client_id,
            business_group_id = v_whitecube_group_id,
            inherit_from_client = true,
            updated_at = NOW()
        WHERE id = v_whitecube_profile_id;

        RAISE NOTICE 'White Cube company migrated: Profile ID %, Client ID %, Group ID %',
            v_whitecube_profile_id, v_whitecube_client_id, v_whitecube_group_id;
    ELSE
        RAISE NOTICE 'White Cube profile not found - skipping White Cube migration';
    END IF;
END $$;

-- Step 3: Handle orphaned companies (companies without client/group assignment)
DO $$
DECLARE
    v_default_client_id uuid;
    v_default_group_id uuid;
    v_orphan_count int;
BEGIN
    -- Check if there are orphaned profiles
    SELECT COUNT(*) INTO v_orphan_count
    FROM profiles
    WHERE client_id IS NULL AND NOT is_deleted;

    IF v_orphan_count > 0 THEN
        -- Create Default Client for orphaned companies
        v_default_client_id := gen_random_uuid();
        v_default_group_id := gen_random_uuid();

        INSERT INTO clients (
            id, name, slug, tier, is_alterable, is_active,
            created_at, is_deleted
        )
        VALUES (
            v_default_client_id,
            'Default Client',
            'default-client',
            'free',
            true,
            true,
            NOW(),
            false
        );

        -- Create Default BusinessGroup
        INSERT INTO business_groups (
            id, client_id, name, slug, description, is_active,
            created_at, is_deleted
        )
        VALUES (
            v_default_group_id,
            v_default_client_id,
            'Default Group',
            'default-group',
            'Default business group for migrated companies',
            true,
            NOW(),
            false
        );

        -- Assign all orphaned profiles to the default client/group
        UPDATE profiles
        SET
            client_id = v_default_client_id,
            business_group_id = v_default_group_id,
            inherit_from_client = false,  -- Keep their individual info
            updated_at = NOW()
        WHERE client_id IS NULL AND NOT is_deleted;

        RAISE NOTICE 'Created default client/group and migrated % orphaned companies',
            v_orphan_count;
    ELSE
        RAISE NOTICE 'No orphaned companies found';
    END IF;
END $$;

-- Step 4: Verification - Show migration results
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '========================================';

    RAISE NOTICE 'Total Clients: %', (SELECT COUNT(*) FROM clients WHERE NOT is_deleted);
    RAISE NOTICE 'Total Business Groups: %', (SELECT COUNT(*) FROM business_groups WHERE NOT is_deleted);
    RAISE NOTICE 'Total Companies with Client: %', (SELECT COUNT(*) FROM profiles WHERE client_id IS NOT NULL AND NOT is_deleted);
    RAISE NOTICE 'Total Companies with Group: %', (SELECT COUNT(*) FROM profiles WHERE business_group_id IS NOT NULL AND NOT is_deleted);
    RAISE NOTICE 'Orphaned Companies: %', (SELECT COUNT(*) FROM profiles WHERE client_id IS NULL AND NOT is_deleted);

    RAISE NOTICE '========================================';
END $$;
