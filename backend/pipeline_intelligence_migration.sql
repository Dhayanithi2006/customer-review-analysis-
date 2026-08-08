-- Phase 3: Feedback Intelligence Pipeline extras
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS ai_analysis_status TEXT DEFAULT 'ok';

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_tier TEXT;

COMMENT ON COLUMN sessions.ai_analysis_status IS
  'ok | unavailable | fallback | retrying — Gemini categorization status; VADER always preserved';
