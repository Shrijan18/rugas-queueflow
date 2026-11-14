-- ==============================================================================
-- QueueFlow - PostgreSQL Database Schema
-- Production-grade schema with relational constraints, partial indexes, and cascades.
-- ==============================================================================

-- 1. Managers Table
CREATE TABLE IF NOT EXISTS managers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Queues Table
CREATE TABLE IF NOT EXISTS queues (
    id SERIAL PRIMARY KEY,
    manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    prefix VARCHAR(10) DEFAULT 'Q',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tokens Table
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    token_number VARCHAR(50) NOT NULL,
    person_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),
    position INTEGER, -- 1-indexed queue order for WAITING tokens; null or set
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'SERVING', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    called_at TIMESTAMP WITH TIME ZONE,
    service_started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Partial index: strictly enforce at most ONE token in SERVING state per queue
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_serving_per_queue 
    ON tokens (queue_id) 
    WHERE status = 'SERVING';

-- Unique token number per queue
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_token_per_queue 
    ON tokens (queue_id, token_number);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_tokens_queue_status_position 
    ON tokens (queue_id, status, position);

CREATE INDEX IF NOT EXISTS idx_tokens_created_at 
    ON tokens (created_at);

CREATE INDEX IF NOT EXISTS idx_queues_manager_id 
    ON queues (manager_id);

-- 4. Queue Activity Table
CREATE TABLE IF NOT EXISTS queue_activity (
    id SERIAL PRIMARY KEY,
    queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_activity_queue_id 
    ON queue_activity (queue_id);

CREATE INDEX IF NOT EXISTS idx_queue_activity_created_at 
    ON queue_activity (created_at);

-- 5. Queue Snapshots Table
CREATE TABLE IF NOT EXISTS queue_snapshots (
    id SERIAL PRIMARY KEY,
    queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    waiting_count INTEGER NOT NULL DEFAULT 0,
    serving_count INTEGER NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_snapshots_queue_id 
    ON queue_snapshots (queue_id);

CREATE INDEX IF NOT EXISTS idx_queue_snapshots_recorded_at 
    ON queue_snapshots (recorded_at);
