#!/bin/bash
echo "Applying Studio Service migrations..."
docker exec puod-postgres psql -U postgres -d puod_studio -c "
ALTER TABLE studio_dashboard_cards
ADD COLUMN IF NOT EXISTS integration_id bigint,
ADD COLUMN IF NOT EXISTS data_source_json jsonb;
"
echo "Migrations applied successfully!"
