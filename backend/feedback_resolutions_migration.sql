-- ============================================================
-- RoadmapAI — Feedback Closure Ledger (YOU SAID → WE DID) Phase 5
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/zgkdcykrnalcszhmtuzx/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS issue_resolutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  issue_key       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Open'
                  CHECK (status IN ('Open', 'Investigating', 'Planned', 'In Progress', 'Resolved')),
  you_said        TEXT NOT NULL,
  we_did          TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_resolutions_biz
  ON issue_resolutions(business_id, status, updated_at DESC);
