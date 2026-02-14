-- P.U.O.D. Database Initialization Script
-- PostgreSQL + TimescaleDB

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ==============================================
-- SCHEMA: Multi-tenancy & Users
-- ==============================================

-- Profiles table (Multi-tenancy)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    tier VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    roles TEXT[] NOT NULL DEFAULT '{"user"}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_profile ON users(profile_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Refresh tokens for JWT
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP,
    is_revoked BOOLEAN DEFAULT false
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token) WHERE is_revoked = false;

-- Audit logs
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_profile_time ON audit_logs(profile_id, timestamp DESC);
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ==============================================
-- SCHEMA: Integration Connectors
-- ==============================================

-- Connector configurations
CREATE TABLE connector_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    connector_type VARCHAR(50) NOT NULL CHECK (connector_type IN ('databricks', 'synapse', 'airflow')),
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_health_check TIMESTAMP,
    health_status VARCHAR(20) CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    UNIQUE(profile_id, connector_type, name)
);

CREATE INDEX idx_connector_profile ON connector_configs(profile_id);
CREATE INDEX idx_connector_type ON connector_configs(connector_type);
CREATE INDEX idx_connector_active ON connector_configs(is_active) WHERE is_active = true;

-- Query cache metadata
CREATE TABLE query_cache_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    connector_type VARCHAR(50) NOT NULL,
    query_hash VARCHAR(64) NOT NULL,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    query_text TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    hit_count INT DEFAULT 0,
    last_accessed_at TIMESTAMP
);

CREATE INDEX idx_cache_profile_connector ON query_cache_metadata(profile_id, connector_type);
CREATE INDEX idx_cache_expires ON query_cache_metadata(expires_at);

-- ==============================================
-- SCHEMA: Monitoring & Metrics
-- ==============================================

-- Metrics table (TimescaleDB Hypertable)
CREATE TABLE metrics (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    profile_id UUID NOT NULL,
    source VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    tags JSONB,
    unit VARCHAR(20),
    PRIMARY KEY (time, profile_id, source, metric_name)
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);

-- Create indexes for common queries
CREATE INDEX idx_metrics_profile_source ON metrics(profile_id, source, time DESC);
CREATE INDEX idx_metrics_name_time ON metrics(metric_name, time DESC);
CREATE INDEX idx_metrics_tags ON metrics USING GIN (tags);

-- Continuous aggregates for better performance (TimescaleDB feature)
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    profile_id,
    source,
    metric_name,
    AVG(value) as avg_value,
    MAX(value) as max_value,
    MIN(value) as min_value,
    COUNT(*) as sample_count
FROM metrics
GROUP BY bucket, profile_id, source, metric_name
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metrics_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Alert rules
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_name VARCHAR(100) NOT NULL,
    condition VARCHAR(10) NOT NULL CHECK (condition IN ('>', '<', '>=', '<=', '==', '!=')),
    threshold DOUBLE PRECISION NOT NULL,
    duration_minutes INT DEFAULT 5,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    channels JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_alert_rules_profile ON alert_rules(profile_id);
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_alert_rules_metric ON alert_rules(metric_name);

-- Alerts (triggered alert instances)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id),
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metric_value DOUBLE PRECISION,
    triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_by UUID REFERENCES users(id),
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved'))
);

CREATE INDEX idx_alerts_rule ON alerts(rule_id, triggered_at DESC);
CREATE INDEX idx_alerts_profile_status ON alerts(profile_id, status);
CREATE INDEX idx_alerts_triggered ON alerts(triggered_at DESC);

-- ==============================================
-- SCHEMA: Reporting
-- ==============================================

-- Report templates
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('excel', 'json', 'yaml', 'csv')),
    config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_report_templates_profile ON report_templates(profile_id);
CREATE INDEX idx_report_templates_type ON report_templates(template_type);

-- Report requests
CREATE TABLE report_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    profile_id UUID NOT NULL REFERENCES profiles(id),
    template_id UUID REFERENCES report_templates(id),
    report_type VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    download_url TEXT,
    file_size_bytes BIGINT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_report_requests_user ON report_requests(user_id, created_at DESC);
CREATE INDEX idx_report_requests_profile ON report_requests(profile_id, created_at DESC);
CREATE INDEX idx_report_requests_status ON report_requests(status);

-- ==============================================
-- SCHEMA: Dashboard Configurations
-- ==============================================

-- Dashboard configurations (for drag-and-drop)
CREATE TABLE dashboard_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL,
    widgets JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dashboard_user ON dashboard_configs(user_id);
CREATE INDEX idx_dashboard_profile ON dashboard_configs(profile_id);
CREATE UNIQUE INDEX idx_dashboard_user_default ON dashboard_configs(user_id) WHERE is_default = true;

-- Widget library (reusable widgets)
CREATE TABLE widget_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    widget_type VARCHAR(50) NOT NULL CHECK (widget_type IN ('metric', 'chart', 'table', 'gauge', 'list')),
    config JSONB NOT NULL,
    preview_image_url TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_widget_library_profile ON widget_library(profile_id);
CREATE INDEX idx_widget_library_type ON widget_library(widget_type);

-- ==============================================
-- SEED DATA (for development)
-- ==============================================

-- Default profile
INSERT INTO profiles (id, name, company_name, tier, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Demo Company', 'P.U.O.D. Demo', 'enterprise', true);

-- Default admin user (password: Admin@123)
INSERT INTO users (id, profile_id, email, password_hash, full_name, roles, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000001',
     'admin@puod.local',
     '$2a$11$vq8K9z8xZ6rWP1x6K9z8xevK9z8xZ6rWP1x6K9z8xevK9z8xZ6rWPO',
     'System Administrator',
     '{"admin", "user"}',
     true);

-- Default dashboard for admin
INSERT INTO dashboard_configs (user_id, profile_id, name, layout, widgets, is_default)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Default Dashboard',
    '{"columns": 3, "rows": "auto"}',
    '[
        {"id": "w1", "type": "metric", "title": "Total Queries", "position": {"x": 0, "y": 0, "w": 1, "h": 1}},
        {"id": "w2", "type": "chart", "title": "Query Performance", "position": {"x": 1, "y": 0, "w": 2, "h": 2}},
        {"id": "w3", "type": "table", "title": "Recent Alerts", "position": {"x": 0, "y": 1, "w": 1, "h": 2}}
    ]',
    true
);

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connector_configs_updated_at BEFORE UPDATE ON connector_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_configs_updated_at BEFORE UPDATE ON dashboard_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- VACUUM & ANALYZE
-- ==============================================

VACUUM ANALYZE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'P.U.O.D. database initialized successfully!';
    RAISE NOTICE 'Default admin user: admin@puod.local (password: Admin@123)';
END $$;
