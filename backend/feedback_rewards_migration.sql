-- ============================================================
-- RoadmapAI — Lightweight Feedback Reward Ledger Migration (Phase 3)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/zgkdcykrnalcszhmtuzx/sql/new
-- ============================================================

-- Create feedback_rewards ledger table
CREATE TABLE IF NOT EXISTS feedback_rewards (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  feedback_id             UUID REFERENCES feedback_submissions(id) ON DELETE SET NULL,
  user_token              TEXT NOT NULL,
  points_awarded          INTEGER NOT NULL DEFAULT 0,
  reward_status           TEXT NOT NULL DEFAULT 'awarded'
                          CHECK (reward_status IN ('awarded', 'cooldown_skipped', 'ineligible')),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast ledger aggregation and cooldown checks
CREATE INDEX IF NOT EXISTS idx_rewards_biz_user
  ON feedback_rewards(business_id, user_token, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rewards_cooldown
  ON feedback_rewards(business_id, user_token, reward_status, created_at DESC);
