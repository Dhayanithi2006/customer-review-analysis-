-- ============================================================
-- RoadmapAI Phase 1 — Business-centric architecture (FIXED)
-- Self-contained: creates missing tables, then links them.
-- Safe to re-run.
--
-- Conceptual map:
--   businesses            → businesses
--   feedback              → feedback_submissions (+ reviews via session)
--   analysis_sessions     → sessions (+ analysis_versions)
--   issues                → issue_clusters
--   actions               → issue_resolutions
--   follow_up_responses   → follow_up_responses
-- ============================================================

-- ── 1. businesses ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name         TEXT NOT NULL,
  industry              TEXT NOT NULL,
  email                 TEXT NOT NULL,
  feedback_url          TEXT,
  dashboard_url         TEXT,
  qr_code               TEXT,
  feedback_method       TEXT,
  monthly_customers     INTEGER,
  avg_revenue_per_user  REAL,
  premium_pct           REAL,
  currency              TEXT DEFAULT 'INR',
  engagement_mode       TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_email
  ON businesses(email);

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS engagement_mode TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── 2. sessions.business_id ─────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_business
  ON sessions(business_id, created_at DESC);

-- Allow common session sources (QR/CSV/etc.)
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_source_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_source_check
  CHECK (source IN (
    'play_store','app_store','support','twitter','reddit',
    'qr_form','web_form','csv','telegram'
  ));

-- ── 3. analysis_versions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  label         TEXT,
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, version)
);

CREATE INDEX IF NOT EXISTS idx_analysis_versions_business
  ON analysis_versions(business_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_versions_session
  ON analysis_versions(session_id);

-- ── 4. feedback_submissions (create if missing) ─────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES sessions(id),
  raw_text        TEXT NOT NULL,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  customer_name   TEXT,
  customer_email  TEXT,
  engagement_mode TEXT NOT NULL DEFAULT 'improvement',
  feedback_tag    TEXT,
  reward_claimed  BOOLEAN DEFAULT FALSE,
  source          TEXT DEFAULT 'qr_form',
  follow_up_eligible BOOLEAN DEFAULT FALSE,
  follow_up_sent  BOOLEAN DEFAULT FALSE,
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr_form';
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS follow_up_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_feedback_sub_business
  ON feedback_submissions(business_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_sub_unprocessed
  ON feedback_submissions(business_id)
  WHERE session_id IS NULL;

UPDATE feedback_submissions
SET created_at = COALESCE(created_at, submitted_at, NOW())
WHERE created_at IS NULL;

-- ── 5. issue_clusters.business_id ───────────────────────────────────────────
ALTER TABLE issue_clusters
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE issue_clusters
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE issue_clusters
  ADD COLUMN IF NOT EXISTS decision_pillars JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_clusters_business
  ON issue_clusters(business_id, priority_rank);

UPDATE issue_clusters ic
SET business_id = s.business_id
FROM sessions s
WHERE ic.session_id = s.id
  AND ic.business_id IS NULL
  AND s.business_id IS NOT NULL;

-- ── 6. issue_resolutions (actions + status) — CREATE IF MISSING ─────────────
CREATE TABLE IF NOT EXISTS issue_resolutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  issue_key       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'IDENTIFIED',
  you_said        TEXT NOT NULL DEFAULT '',
  we_did          TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  action_taken    TEXT,
  action_taken_at TIMESTAMPTZ,
  follow_up_sent_at TIMESTAMPTZ,
  improvement_percentage REAL,
  contacted_count INTEGER DEFAULT 0,
  response_count  INTEGER DEFAULT 0,
  improved_count  INTEGER DEFAULT 0,
  somewhat_improved_count INTEGER DEFAULT 0,
  not_improved_count INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- Closed-loop columns if table already existed without them
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS action_taken TEXT;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMPTZ;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS improvement_percentage REAL;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS contacted_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS response_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS improved_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS somewhat_improved_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS not_improved_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE issue_resolutions DROP CONSTRAINT IF EXISTS issue_resolutions_status_check;
ALTER TABLE issue_resolutions ADD CONSTRAINT issue_resolutions_status_check
  CHECK (status IN (
    'Open', 'Investigating', 'Planned', 'In Progress', 'Resolved',
    'IDENTIFIED', 'ACTION_PLANNED', 'ACTION_TAKEN', 'FOLLOW_UP_SENT', 'IMPROVED', 'REOPENED'
  ));

CREATE INDEX IF NOT EXISTS idx_resolutions_biz
  ON issue_resolutions(business_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_resolutions_biz_issue
  ON issue_resolutions(business_id, issue_key);

-- ── 7. follow-up tables — CREATE IF MISSING ─────────────────────────────────
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS follow_up_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS follow_up_tokens (
  token           TEXT PRIMARY KEY,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  issue_key       TEXT NOT NULL,
  feedback_id     UUID,
  email           TEXT NOT NULL,
  is_used         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  used_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fut_biz_issue ON follow_up_tokens(business_id, issue_key);
CREATE INDEX IF NOT EXISTS idx_fut_used ON follow_up_tokens(token, is_used);

CREATE TABLE IF NOT EXISTS follow_up_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  issue_key       TEXT NOT NULL,
  feedback_id     UUID,
  response        TEXT NOT NULL CHECK (response IN ('improved', 'somewhat_improved', 'not_improved')),
  comment         TEXT,
  submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fur_biz_issue
  ON follow_up_responses(business_id, issue_key);

-- ── 8. Documentation comments ───────────────────────────────────────────────
COMMENT ON TABLE businesses IS 'Phase1 entity: business — workspace root keyed by business_id';
COMMENT ON TABLE sessions IS 'Phase1 entity: analysis_sessions — every analysis should set business_id';
COMMENT ON TABLE analysis_versions IS 'Phase1 link: business → analysis_sessions history';
COMMENT ON TABLE feedback_submissions IS 'Phase1 entity: feedback — buffered public/QR submissions';
COMMENT ON TABLE reviews IS 'Phase1 entity: feedback (ingested) — session-scoped review rows';
COMMENT ON TABLE issue_clusters IS 'Phase1 entity: issues — clustered issues for an analysis session';
COMMENT ON TABLE issue_resolutions IS 'Phase1 entity: actions + issue status ledger per business';
COMMENT ON TABLE follow_up_responses IS 'Phase1 entity: follow_up_responses — customer replies per issue';
