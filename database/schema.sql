BEGIN;

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
    department TEXT,
    position TEXT,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_staff_requires_position
        CHECK (role <> 'staff' OR position IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS readers (
    reader_id TEXT PRIMARY KEY,
    location_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
    tag_id TEXT PRIMARY KEY,
    equipment_name TEXT NOT NULL,
    equipment_type TEXT,
    serial_number TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tag_state_history (
    history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tag_id TEXT NOT NULL REFERENCES tags(tag_id) ON UPDATE CASCADE,
    reader_id TEXT NOT NULL REFERENCES readers(reader_id) ON UPDATE CASCADE,
    rssi INTEGER,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- usage_history is modeled as a denormalized snapshot table.
-- The current frontend only reads it, so preserving this shape is enough to
-- recreate the app without carrying over old records.
CREATE TABLE IF NOT EXISTS usage_history (
    usage_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT,
    user_name TEXT,
    user_position TEXT,
    user_department TEXT,
    tag_id TEXT,
    equipment_name TEXT,
    checkout_reader_id TEXT,
    checkout_location TEXT,
    checkout_at TIMESTAMPTZ,
    return_reader_id TEXT,
    return_location TEXT,
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tag_state_history_tag_decided_at
    ON tag_state_history (tag_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_tag_state_history_decided_at
    ON tag_state_history (decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_history_checkout_at
    ON usage_history (checkout_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_history_user_id
    ON usage_history (user_id);

CREATE INDEX IF NOT EXISTS idx_usage_history_tag_id
    ON usage_history (tag_id);

COMMIT;
