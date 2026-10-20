CREATE TABLE IF NOT EXISTS bot_applications (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_bots (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES bot_applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE,
    username TEXT NOT NULL,
    display_name TEXT NULL,
    intents INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_tokens (
    id UUID PRIMARY KEY,
    bot_id UUID NOT NULL REFERENCES bot_bots(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_installs (
    id UUID PRIMARY KEY,
    bot_id UUID NOT NULL REFERENCES bot_bots(id) ON DELETE CASCADE,
    server_id UUID NOT NULL,
    permissions BIGINT NOT NULL DEFAULT 0,
    installed_by UUID NOT NULL,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bot_id, server_id)
);

CREATE TABLE IF NOT EXISTS bot_webhooks (
    bot_id UUID PRIMARY KEY REFERENCES bot_bots(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_updates (
    id BIGSERIAL PRIMARY KEY,
    bot_id UUID NOT NULL REFERENCES bot_bots(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ NULL,
    poll_claimed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS bot_updates_bot_id_id_idx ON bot_updates (bot_id, id);
CREATE INDEX IF NOT EXISTS bot_installs_server_id_idx ON bot_installs (server_id);
