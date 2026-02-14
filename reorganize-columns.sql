-- Create temp table with columns in correct order (integration_id and data_source_json BEFORE created_at/updated_at)
CREATE TABLE studio_dashboard_cards_temp (
    id bigserial PRIMARY KEY,
    dashboard_id bigint NOT NULL,
    card_id bigint NOT NULL,
    order_index integer NOT NULL,
    position_x integer NOT NULL,
    position_y integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    layout_json jsonb,
    refresh_policy_json jsonb,
    integration_id bigint,
    data_source_json jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Copy data from old table
INSERT INTO studio_dashboard_cards_temp
    (id, dashboard_id, card_id, order_index, position_x, position_y, width, height,
     layout_json, refresh_policy_json, integration_id, data_source_json, created_at, updated_at)
SELECT
    id, dashboard_id, card_id, order_index, position_x, position_y, width, height,
    layout_json, refresh_policy_json, integration_id, data_source_json, created_at, updated_at
FROM studio_dashboard_cards;

-- Update sequence to continue from current max id
SELECT setval('studio_dashboard_cards_temp_id_seq', (SELECT COALESCE(MAX(id), 1) FROM studio_dashboard_cards_temp));

-- Drop old table (CASCADE will drop foreign keys)
DROP TABLE studio_dashboard_cards CASCADE;

-- Rename temp table to original name
ALTER TABLE studio_dashboard_cards_temp RENAME TO studio_dashboard_cards;

-- Recreate indexes
CREATE INDEX ix_studio_dashboard_cards_dashboard_id ON studio_dashboard_cards(dashboard_id);
CREATE INDEX ix_studio_dashboard_cards_card_id ON studio_dashboard_cards(card_id);

-- Recreate foreign keys
ALTER TABLE studio_dashboard_cards
    ADD CONSTRAINT "FK_studio_dashboard_cards_studio_cards_card_id"
    FOREIGN KEY (card_id) REFERENCES studio_cards(id) ON DELETE CASCADE;

ALTER TABLE studio_dashboard_cards
    ADD CONSTRAINT "FK_studio_dashboard_cards_studio_dashboards_dashboard_id"
    FOREIGN KEY (dashboard_id) REFERENCES studio_dashboards(id) ON DELETE CASCADE;
