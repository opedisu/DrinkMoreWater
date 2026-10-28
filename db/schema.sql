-- DrinkMoreWater schema. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL DEFAULT '',
    timezone        TEXT NOT NULL DEFAULT 'UTC',
    unit            TEXT NOT NULL DEFAULT 'ml',          -- 'ml' | 'oz'
    goal_ml         INTEGER NOT NULL DEFAULT 2500,
    weight_kg       NUMERIC(5,1),
    activity_level  TEXT NOT NULL DEFAULT 'moderate',    -- 'low' | 'moderate' | 'high'
    hot_climate     BOOLEAN NOT NULL DEFAULT TRUE,
    reminders_on    BOOLEAN NOT NULL DEFAULT TRUE,
    smart_pacing    BOOLEAN NOT NULL DEFAULT TRUE,
    wake_minute     INTEGER NOT NULL DEFAULT 420,        -- minutes from local midnight (07:00)
    sleep_minute    INTEGER NOT NULL DEFAULT 1380,       -- 23:00
    interval_minutes INTEGER NOT NULL DEFAULT 90,
    buddy_code      TEXT NOT NULL UNIQUE,
    streak_current  INTEGER NOT NULL DEFAULT 0,
    streak_best     INTEGER NOT NULL DEFAULT 0,
    xp              INTEGER NOT NULL DEFAULT 0,
    last_goal_date  DATE,                                -- last local date the goal was met
    last_remind_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_tokens (
    token_hash  TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS login_tokens_email_idx ON login_tokens (email);

CREATE TABLE IF NOT EXISTS intakes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    amount_ml   INTEGER NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 3000),
    local_date  DATE NOT NULL,
    drink       TEXT NOT NULL DEFAULT 'water',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS intakes_user_date_idx ON intakes (user_id, local_date DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    user_agent  TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS badges (
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, code)
);

-- A one-directional "I'm cheering you on" link. Both sides linking each
-- other makes it mutual.
CREATE TABLE IF NOT EXISTS buddies (
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    buddy_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, buddy_id),
    CHECK (user_id <> buddy_id)
);
CREATE INDEX IF NOT EXISTS buddies_buddy_idx ON buddies (buddy_id);

-- Rate limiter for magic links and buddy nudges.
CREATE TABLE IF NOT EXISTS rate_limits (
    bucket      TEXT PRIMARY KEY,
    count       INTEGER NOT NULL DEFAULT 0,
    window_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Additive migrations. Each statement is safe to run repeatedly.
-- ---------------------------------------------------------------------------

-- Lets a user invalidate every session they have ever issued ("sign out
-- everywhere"), which a stateless cookie cannot otherwise support.
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Someone you have removed as a follower cannot follow you again.
CREATE TABLE IF NOT EXISTS buddy_blocks (
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, blocked_id),
    CHECK (user_id <> blocked_id)
);

-- New accounts get a calmer default than the original 90 minutes.
ALTER TABLE users ALTER COLUMN interval_minutes SET DEFAULT 120;

-- Small key/value store for operational state, currently just the timestamp
-- of the last reminder sweep so /api/health can prove the scheduler is alive.
CREATE TABLE IF NOT EXISTS system_state (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A streak survives one missed day per week. This records when that repair
-- was last spent; NULL means never.
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_grace_at DATE;

-- The local date the weekly digest was last sent, so a sweep that runs every
-- fifteen minutes still only sends one per week.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_on DATE;
