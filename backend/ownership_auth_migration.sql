-- ============================================================
-- RoadmapAI — Owner auth + reward identity hash
-- Safe to re-run in Supabase SQL Editor.
-- Ensures reward/settings tables exist before altering them.
-- ============================================================

-- Owner token: only sha256 hash stored; plaintext returned once at register
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS owner_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_businesses_owner_token
  ON businesses(owner_token_hash)
  WHERE owner_token_hash IS NOT NULL;

-- ── feedback_engagement_settings (from feedback_settings_migration.sql) ─────
-- Required by reward eligibility / feedback submit paths.
CREATE TABLE IF NOT EXISTS feedback_engagement_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,

  feedback_mode           TEXT NOT NULL DEFAULT 'product'
                          CHECK (feedback_mode IN ('reward', 'improvement', 'product')),

  reward_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  points_per_feedback     INTEGER NOT NULL DEFAULT 10
                          CHECK (points_per_feedback BETWEEN 1 AND 10000),
  cooldown_hours          INTEGER NOT NULL DEFAULT 168
                          CHECK (cooldown_hours BETWEEN 0 AND 8760),
  reward_threshold        INTEGER NOT NULL DEFAULT 100
                          CHECK (reward_threshold BETWEEN 1 AND 100000),
  reward_description      TEXT NOT NULL DEFAULT 'Loyalty points redeemable at your next visit',

  minimum_feedback_length INTEGER NOT NULL DEFAULT 10
                          CHECK (minimum_feedback_length BETWEEN 5 AND 500),
  feedback_message        TEXT NOT NULL DEFAULT 'Your feedback helps us improve our service',

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fes_business
  ON feedback_engagement_settings(business_id);

-- ── feedback_rewards ledger (from feedback_rewards_migration.sql) ───────────
-- MVP schema matching routers/feedback.py + routers/reward.py inserts/queries.
CREATE TABLE IF NOT EXISTS feedback_rewards (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  feedback_id             UUID REFERENCES feedback_submissions(id) ON DELETE SET NULL,
  user_token              TEXT NOT NULL,
  identity_hash           TEXT,
  points_awarded          INTEGER NOT NULL DEFAULT 0,
  reward_status           TEXT NOT NULL DEFAULT 'awarded'
                          CHECK (reward_status IN ('awarded', 'cooldown_skipped', 'ineligible')),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- For DBs that already had feedback_rewards without identity_hash
ALTER TABLE feedback_rewards
  ADD COLUMN IF NOT EXISTS identity_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_rewards_biz_user
  ON feedback_rewards(business_id, user_token, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rewards_cooldown
  ON feedback_rewards(business_id, user_token, reward_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rewards_identity
  ON feedback_rewards(business_id, identity_hash, reward_status, created_at DESC)
  WHERE identity_hash IS NOT NULL;

COMMENT ON COLUMN businesses.owner_token_hash IS 'sha256 of owner_token; required on protected workspace APIs via X-Owner-Token';
COMMENT ON COLUMN feedback_rewards.identity_hash IS 'email:<sha>|phone:<sha>|device:<token> for cooldown — no raw PII';
