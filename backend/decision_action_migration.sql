-- Phase 5: Decision-to-Action extras
ALTER TABLE session_outputs
  ADD COLUMN IF NOT EXISTS ai_pm_briefing JSONB;
