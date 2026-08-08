-- ============================================================
-- RoadmapAI — Closed-Loop Feedback Resolution Engine Migration
-- ============================================================

-- 1. Add follow-up eligibility tracking to reviews and submissions
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS follow_up_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS follow_up_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE feedback_submissions ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE;

-- 2. issue_resolutions table additions for Closed-Loop Lifecycle
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS action_taken TEXT;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMPTZ;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS improvement_percentage REAL;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS contacted_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS response_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS improved_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS somewhat_improved_count INTEGER DEFAULT 0;
ALTER TABLE issue_resolutions ADD COLUMN IF NOT EXISTS not_improved_count INTEGER DEFAULT 0;

-- 3. Follow-up Tokens table (Single-use secure tokens)
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

-- 4. Follow-up Responses table
CREATE TABLE IF NOT EXISTS follow_up_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    issue_key       TEXT NOT NULL,
    feedback_id     UUID,
    response        TEXT NOT NULL CHECK (response IN ('improved', 'somewhat_improved', 'not_improved')),
    comment         TEXT,
    submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fur_biz_issue ON follow_up_responses(business_id, issue_key);
