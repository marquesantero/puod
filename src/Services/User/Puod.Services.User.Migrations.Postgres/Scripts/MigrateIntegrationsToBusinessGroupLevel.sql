-- Migration Script: Move Integrations from Company-Level to BusinessGroup-Level
-- Purpose: Update all company-owned integrations to be owned by their BusinessGroup
-- Created: 2025-12-25

BEGIN;

-- Verify integrations before migration
SELECT
    i.id,
    i.name,
    i.profile_id,
    i.owner_type,
    i.company_group_id,
    i.business_group_id,
    p.business_group_id as profile_business_group_id
FROM integrations i
LEFT JOIN profiles p ON i.profile_id = p.id
WHERE i.owner_type = 'company' AND NOT i.is_deleted;

-- Update integrations to BusinessGroup ownership
UPDATE integrations i
SET
    owner_type = 'group',
    business_group_id = p.business_group_id,
    company_ids = ARRAY[i.profile_id]::uuid[],
    updated_at = NOW()
FROM profiles p
WHERE
    i.profile_id = p.id
    AND i.owner_type = 'company'
    AND p.business_group_id IS NOT NULL
    AND NOT i.is_deleted;

-- Verify results after migration
SELECT
    i.id,
    i.name,
    i.owner_type,
    i.business_group_id,
    bg.name as business_group_name,
    i.company_ids,
    i.updated_at
FROM integrations i
LEFT JOIN business_groups bg ON i.business_group_id = bg.id
WHERE i.owner_type = 'group' AND NOT i.is_deleted
ORDER BY i.updated_at DESC;

-- Summary statistics
SELECT
    'Total integrations migrated' as description,
    COUNT(*) as count
FROM integrations
WHERE owner_type = 'group' AND NOT is_deleted;

COMMIT;
