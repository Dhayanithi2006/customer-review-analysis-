-- ============================================================
-- RoadmapAI — Telegram feedback source support
-- Run in Supabase SQL editor after existing migrations.
-- ============================================================

-- Track collection channel on the shared feedback buffer (QR / web / telegram).
ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr_form';

-- Allow telegram as a session source (same pipeline; no separate tables).
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_source_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_source_check
  CHECK (source IN (
    'play_store','app_store','support','twitter','reddit',
    'qr_form','web_form','csv','telegram'
  ));

CREATE INDEX IF NOT EXISTS idx_feedback_sub_source
  ON feedback_submissions(business_id, source);
