-- ============================================================
-- RoadmapAI — Supabase SQL Migration
-- Run this in the Supabase SQL editor to create all tables
-- ============================================================

-- Sessions: one upload = one analysis session
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename        TEXT NOT NULL,
    source          TEXT NOT NULL CHECK (source IN ('play_store','app_store','support','twitter','reddit')),
    team_size       TEXT DEFAULT 'small_team',   -- solo | 2_5 | 5_10_plus | small_team (default)
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','cleaning','categorizing','clustering',
                                      'prioritizing','summarizing','roadmapping','complete','failed')),
    current_step    INTEGER DEFAULT 0,
    total_reviews   INTEGER,
    processed_reviews INTEGER DEFAULT 0,
    actionable_reviews INTEGER DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews: raw + cleaned data per review
CREATE TABLE IF NOT EXISTS reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    raw_text        TEXT NOT NULL,
    cleaned_text    TEXT,
    rating          INTEGER,
    review_date     DATE,
    source          TEXT,
    is_duplicate    BOOLEAN DEFAULT FALSE,
    is_spam         BOOLEAN DEFAULT FALSE,
    sentiment_label TEXT CHECK (sentiment_label IN ('positive','negative','neutral')),
    sentiment_score REAL,
    routed_to_llm   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Categorizations: Gemini output per review
CREATE TABLE IF NOT EXISTS categorizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID REFERENCES reviews(id) ON DELETE CASCADE,
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    issue_key       TEXT NOT NULL,
    category        TEXT NOT NULL,
    severity        INTEGER CHECK (severity BETWEEN 1 AND 10),
    confidence      INTEGER CHECK (confidence BETWEEN 0 AND 100),
    summary         TEXT,
    business_area   TEXT,
    raw_llm_output  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Issue clusters: aggregated view per unique issue_key
CREATE TABLE IF NOT EXISTS issue_clusters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID REFERENCES sessions(id) ON DELETE CASCADE,
    issue_key           TEXT NOT NULL,
    category            TEXT NOT NULL,
    business_area       TEXT,
    description         TEXT,
    review_count        INTEGER DEFAULT 0,
    avg_severity        REAL,
    avg_confidence      REAL,
    avg_sentiment       REAL,
    premium_user_count  INTEGER DEFAULT 0,
    priority_score      REAL,
    priority_rank       INTEGER,
    revenue_at_risk     REAL,
    platforms           JSONB DEFAULT '[]',
    sample_reviews      JSONB DEFAULT '[]',   -- top 5 review texts for Evidence Panel
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, issue_key)
);

-- Session outputs: Gemini-generated summaries, roadmap, sprint
CREATE TABLE IF NOT EXISTS session_outputs (
    session_id          UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    executive_summary   TEXT,
    headline_insights   JSONB DEFAULT '[]',   -- array of 3 short strings
    roadmap_json        JSONB,
    sprint_json         JSONB,
    top_priority        JSONB,
    most_requested      JSONB,
    ai_recommendation   TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- LLM audit log: every Gemini call recorded
CREATE TABLE IF NOT EXISTS llm_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    call_type       TEXT CHECK (call_type IN ('categorize','summary','roadmap','meeting')),
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    cost_usd        REAL,
    latency_ms      INTEGER,
    status          TEXT CHECK (status IN ('success','retry','failed')),
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_reviews_session     ON reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_reviews_routed      ON reviews(session_id, routed_to_llm);
CREATE INDEX IF NOT EXISTS idx_cat_session         ON categorizations(session_id);
CREATE INDEX IF NOT EXISTS idx_clusters_session    ON issue_clusters(session_id, priority_rank);
CREATE INDEX IF NOT EXISTS idx_llm_session         ON llm_logs(session_id);
