-- ============================================================
-- RoadmapAI — Feedback Engagement Layer Migration
-- Run in: https://supabase.com/dashboard/project/zgkdcykrnalcszhmtuzx/sql/new
-- ============================================================

-- 1. Add engagement_mode column to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS engagement_mode TEXT;

-- 2. Create feedback_submissions table (public form submissions buffer)
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES sessions(id),      -- NULL until batch-processed
  raw_text        TEXT NOT NULL,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  customer_name   TEXT,
  customer_email  TEXT,
  engagement_mode TEXT NOT NULL,                     -- 'reward' | 'improvement' | 'product'
  feedback_tag    TEXT,                              -- Bug / Feature / Performance (PRODUCT mode)
  reward_claimed  BOOLEAN DEFAULT FALSE,             -- REWARD mode tracking
  submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_sub_business
  ON feedback_submissions(business_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_sub_unprocessed
  ON feedback_submissions(business_id)
  WHERE session_id IS NULL;

-- 4. Add qr_form and web_form as valid session sources
-- (Drop and recreate constraint if it exists)
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_source_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_source_check
  CHECK (source IN ('play_store','app_store','support','twitter','reddit','qr_form','web_form','csv'));
