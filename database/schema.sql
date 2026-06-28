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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_staff_requires_position
        CHECK (role <> 'staff' OR position IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS readers (
    reader_id TEXT PRIMARY KEY,
    location_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
    tag_id TEXT PRIMARY KEY,
    equipment_name TEXT NOT NULL,
    equipment_type TEXT,
    serial_number TEXT UNIQUE,
    nfc_tag_uid TEXT,
    asset_status TEXT NOT NULL DEFAULT 'available',
    current_holder_user_id BIGINT REFERENCES users(user_id) ON UPDATE CASCADE,
    current_usage_id BIGINT,
    last_checkout_at TIMESTAMPTZ,
    last_returned_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tags_asset_status_valid
        CHECK (asset_status IN ('available', 'checked_out', 'maintenance', 'inactive')),
    CONSTRAINT tags_checkout_state_consistent
        CHECK (
            (asset_status = 'checked_out'
                AND current_holder_user_id IS NOT NULL
                AND current_usage_id IS NOT NULL
                AND last_checkout_at IS NOT NULL)
            OR
            (asset_status <> 'checked_out'
                AND current_holder_user_id IS NULL
                AND current_usage_id IS NULL)
        )
);

CREATE TABLE IF NOT EXISTS tag_state_history (
    history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tag_id TEXT NOT NULL REFERENCES tags(tag_id) ON UPDATE CASCADE,
    reader_id TEXT NOT NULL REFERENCES readers(reader_id) ON UPDATE CASCADE,
    rssi INTEGER,
    observed_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'rtls',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tag_state_history_source_valid
        CHECK (source IN ('rtls', 'manual'))
);

-- usage_history keeps the denormalized fields that the current frontend reads,
-- and adds explicit state columns for the NFC checkout/return workflow.
CREATE TABLE IF NOT EXISTS usage_history (
    usage_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usage_status TEXT NOT NULL DEFAULT 'checked_out',
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE,
    user_name TEXT NOT NULL,
    user_position TEXT,
    user_department TEXT,
    returned_by_user_id BIGINT REFERENCES users(user_id) ON UPDATE CASCADE,
    returned_by_name TEXT,
    returned_by_position TEXT,
    returned_by_department TEXT,
    tag_id TEXT NOT NULL REFERENCES tags(tag_id) ON UPDATE CASCADE,
    equipment_name TEXT NOT NULL,
    equipment_type TEXT,
    equipment_serial_number TEXT,
    equipment_nfc_uid TEXT,
    checkout_method TEXT NOT NULL DEFAULT 'nfc',
    checkout_reader_id TEXT REFERENCES readers(reader_id) ON UPDATE CASCADE,
    checkout_location TEXT,
    checkout_at TIMESTAMPTZ NOT NULL,
    return_method TEXT,
    return_reader_id TEXT REFERENCES readers(reader_id) ON UPDATE CASCADE,
    return_location TEXT,
    returned_at TIMESTAMPTZ,
    note TEXT,
    blockchain_tx_hash TEXT,
    blockchain_block_number BIGINT,
    blockchain_block_hash TEXT,
    blockchain_transaction_index INTEGER,
    blockchain_recorded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT usage_history_status_valid
        CHECK (usage_status IN ('checked_out', 'returned')),
    CONSTRAINT usage_history_checkout_method_valid
        CHECK (checkout_method IN ('nfc', 'manual', 'test')),
    CONSTRAINT usage_history_return_method_valid
        CHECK (return_method IS NULL OR return_method IN ('nfc', 'manual', 'test')),
    CONSTRAINT usage_history_return_time_valid
        CHECK (returned_at IS NULL OR returned_at >= checkout_at),
    CONSTRAINT usage_history_return_state_consistent
        CHECK (
            (usage_status = 'checked_out'
                AND returned_at IS NULL
                AND return_method IS NULL)
            OR
            (usage_status = 'returned'
                AND returned_at IS NOT NULL
                AND return_method IS NOT NULL)
        )
);

CREATE TABLE IF NOT EXISTS usage_nfc_events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usage_id BIGINT REFERENCES usage_history(usage_id) ON DELETE SET NULL,
    tag_id TEXT NOT NULL REFERENCES tags(tag_id) ON UPDATE CASCADE,
    user_id BIGINT REFERENCES users(user_id) ON UPDATE CASCADE,
    equipment_nfc_uid TEXT,
    action TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'accepted',
    reader_id TEXT REFERENCES readers(reader_id) ON UPDATE CASCADE,
    location_name TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT usage_nfc_events_action_valid
        CHECK (action IN ('checkout', 'return')),
    CONSTRAINT usage_nfc_events_result_valid
        CHECK (result IN ('accepted', 'rejected', 'ignored'))
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE readers
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE tags
    ADD COLUMN IF NOT EXISTS nfc_tag_uid TEXT,
    ADD COLUMN IF NOT EXISTS asset_status TEXT NOT NULL DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS current_holder_user_id BIGINT REFERENCES users(user_id) ON UPDATE CASCADE,
    ADD COLUMN IF NOT EXISTS current_usage_id BIGINT,
    ADD COLUMN IF NOT EXISTS last_checkout_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_returned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE tag_state_history
    ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'rtls',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE usage_history
    ADD COLUMN IF NOT EXISTS usage_status TEXT NOT NULL DEFAULT 'checked_out',
    ADD COLUMN IF NOT EXISTS returned_by_user_id BIGINT REFERENCES users(user_id) ON UPDATE CASCADE,
    ADD COLUMN IF NOT EXISTS returned_by_name TEXT,
    ADD COLUMN IF NOT EXISTS returned_by_position TEXT,
    ADD COLUMN IF NOT EXISTS returned_by_department TEXT,
    ADD COLUMN IF NOT EXISTS equipment_type TEXT,
    ADD COLUMN IF NOT EXISTS equipment_serial_number TEXT,
    ADD COLUMN IF NOT EXISTS equipment_nfc_uid TEXT,
    ADD COLUMN IF NOT EXISTS checkout_method TEXT NOT NULL DEFAULT 'nfc',
    ADD COLUMN IF NOT EXISTS return_method TEXT,
    ADD COLUMN IF NOT EXISTS note TEXT,
    ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT,
    ADD COLUMN IF NOT EXISTS blockchain_block_number BIGINT,
    ADD COLUMN IF NOT EXISTS blockchain_block_hash TEXT,
    ADD COLUMN IF NOT EXISTS blockchain_transaction_index INTEGER,
    ADD COLUMN IF NOT EXISTS blockchain_recorded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE usage_history
SET usage_status = CASE
    WHEN returned_at IS NULL THEN 'checked_out'
    ELSE 'returned'
END
WHERE usage_status IS DISTINCT FROM CASE
    WHEN returned_at IS NULL THEN 'checked_out'
    ELSE 'returned'
END;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_history' AND column_name = 'user_id')
        AND NOT EXISTS (SELECT 1 FROM usage_history WHERE user_id IS NULL) THEN
        ALTER TABLE usage_history ALTER COLUMN user_id SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_history' AND column_name = 'user_name')
        AND NOT EXISTS (SELECT 1 FROM usage_history WHERE user_name IS NULL) THEN
        ALTER TABLE usage_history ALTER COLUMN user_name SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_history' AND column_name = 'tag_id')
        AND NOT EXISTS (SELECT 1 FROM usage_history WHERE tag_id IS NULL) THEN
        ALTER TABLE usage_history ALTER COLUMN tag_id SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_history' AND column_name = 'equipment_name')
        AND NOT EXISTS (SELECT 1 FROM usage_history WHERE equipment_name IS NULL) THEN
        ALTER TABLE usage_history ALTER COLUMN equipment_name SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usage_history' AND column_name = 'checkout_at')
        AND NOT EXISTS (SELECT 1 FROM usage_history WHERE checkout_at IS NULL) THEN
        ALTER TABLE usage_history ALTER COLUMN checkout_at SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tags_asset_status_valid'
    ) THEN
        ALTER TABLE tags
            ADD CONSTRAINT tags_asset_status_valid
            CHECK (asset_status IN ('available', 'checked_out', 'maintenance', 'inactive'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tags_checkout_state_consistent'
    ) THEN
        ALTER TABLE tags
            ADD CONSTRAINT tags_checkout_state_consistent
            CHECK (
                (asset_status = 'checked_out'
                    AND current_holder_user_id IS NOT NULL
                    AND current_usage_id IS NOT NULL
                    AND last_checkout_at IS NOT NULL)
                OR
                (asset_status <> 'checked_out'
                    AND current_holder_user_id IS NULL
                    AND current_usage_id IS NULL)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tags_current_usage_id_fkey'
    ) THEN
        ALTER TABLE tags
            ADD CONSTRAINT tags_current_usage_id_fkey
            FOREIGN KEY (current_usage_id) REFERENCES usage_history(usage_id)
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tag_state_history_source_valid'
    ) THEN
        ALTER TABLE tag_state_history
            ADD CONSTRAINT tag_state_history_source_valid
            CHECK (source IN ('rtls', 'manual'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_status_valid'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_status_valid
            CHECK (usage_status IN ('checked_out', 'returned'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_user_id_fkey'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(user_id)
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_tag_id_fkey'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_tag_id_fkey
            FOREIGN KEY (tag_id) REFERENCES tags(tag_id)
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_checkout_reader_id_fkey'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_checkout_reader_id_fkey
            FOREIGN KEY (checkout_reader_id) REFERENCES readers(reader_id)
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_return_reader_id_fkey'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_return_reader_id_fkey
            FOREIGN KEY (return_reader_id) REFERENCES readers(reader_id)
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_checkout_method_valid'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_checkout_method_valid
            CHECK (checkout_method IN ('nfc', 'manual', 'test'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_return_method_valid'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_return_method_valid
            CHECK (return_method IS NULL OR return_method IN ('nfc', 'manual', 'test'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_return_time_valid'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_return_time_valid
            CHECK (returned_at IS NULL OR returned_at >= checkout_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usage_history_return_state_consistent'
    ) THEN
        ALTER TABLE usage_history
            ADD CONSTRAINT usage_history_return_state_consistent
            CHECK (
                (usage_status = 'checked_out'
                    AND returned_at IS NULL
                    AND return_method IS NULL)
                OR
                (usage_status = 'returned'
                    AND returned_at IS NOT NULL
                    AND return_method IS NOT NULL)
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_nfc_tag_uid동
    ON tags (nfc_tag_uid)
    WHERE nfc_tag_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tags_asset_status
    ON tags (asset_status);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_history_open_usage_per_tag
    ON usage_history (tag_id)
    WHERE usage_status = 'checked_out';


COMMIT;
