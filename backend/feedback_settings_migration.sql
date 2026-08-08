-- ============================================================
-- RoadmapAI — Feedback Engagement Settings Migration
-- Run in: https://supabase.com/dashboard/project/zgkdcykrnalcszhmtuzx/sql/new
-- ============================================================

-- feedback_engagement_settings: per-business configuration table
-- One row per business. Auto-created with industry defaults on first GET.
CREATE TABLE IF NOT EXISTS feedback_engagement_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,

  -- Core mode (configurable by business owner, default derived from industry)
  feedback_mode           TEXT NOT NULL DEFAULT 'product'
                          CHECK (feedback_mode IN ('reward', 'improvement', 'product')),

  -- Reward mode fields
  reward_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  points_per_feedback     INTEGER NOT NULL DEFAULT 10
                          CHECK (points_per_feedback BETWEEN 1 AND 10000),
  cooldown_hours          INTEGER NOT NULL DEFAULT 168
                          CHECK (cooldown_hours BETWEEN 0 AND 8760),
  reward_threshold        INTEGER NOT NULL DEFAULT 100
                          CHECK (reward_threshold BETWEEN 1 AND 100000),
  reward_description      TEXT NOT NULL DEFAULT 'Loyalty points redeemable at your next visit',

  -- Common fields (all modes)
  minimum_feedback_length INTEGER NOT NULL DEFAULT 10
                          CHECK (minimum_feedback_length BETWEEN 5 AND 500),
  feedback_message        TEXT NOT NULL DEFAULT 'Your feedback helps us improve our service',

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fes_business
  ON feedback_engagement_settings(business_id);
