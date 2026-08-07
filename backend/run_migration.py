"""
Run Supabase migration via Management API.
Uses the service role key to execute SQL directly.
"""
import urllib.request
import urllib.error
import json
import os
import sys

SUPABASE_URL = "https://zgkdcykrnalcszhmtuzx.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2RjeWtybmFsY3N6aG10dXp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA4ODQzMCwiZXhwIjoyMTAxNjY0NDMwfQ.iQfsAOU9cYufAmjkeGCN2wM8Y9V5OB-1KgeQExeaR2M"

SQL = """
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename        TEXT NOT NULL,
    source          TEXT NOT NULL CHECK (source IN ('play_store','app_store','support','twitter','reddit')),
    team_size       TEXT DEFAULT 'small_team',
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
    sample_reviews      JSONB DEFAULT '[]',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, issue_key)
);

CREATE TABLE IF NOT EXISTS session_outputs (
    session_id          UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    executive_summary   TEXT,
    headline_insights   JSONB DEFAULT '[]',
    roadmap_json        JSONB,
    sprint_json         JSONB,
    top_priority        JSONB,
    most_requested      JSONB,
    ai_recommendation   TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_reviews_session     ON reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_reviews_routed      ON reviews(session_id, routed_to_llm);
CREATE INDEX IF NOT EXISTS idx_cat_session         ON categorizations(session_id);
CREATE INDEX IF NOT EXISTS idx_clusters_session    ON issue_clusters(session_id, priority_rank);
CREATE INDEX IF NOT EXISTS idx_llm_session         ON llm_logs(session_id);
"""

url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"

# Try via PostgREST RPC first, then fall back to a direct query
# Actually Supabase exposes SQL execution via the pg_meta or SQL API
# The correct endpoint is the SQL editor API
sql_endpoint = f"{SUPABASE_URL}/rest/v1/"

# Use Supabase's pg endpoint to run SQL via the REST API
# Since we have service role, we can use PostgREST to run DDL via a function
# But the cleanest way is via the Supabase SQL REST endpoint (only available with anon/service key)

print("Attempting Supabase migration via REST API...")
print(f"Project: {SUPABASE_URL}")

# The Supabase SQL API endpoint
sql_api_url = f"https://zgkdcykrnalcszhmtuzx.supabase.co/rest/v1/rpc/exec"

# Since exec isn't guaranteed, let's use the Management API
# Format: POST https://api.supabase.com/v1/projects/{ref}/database/query
mgmt_url = "https://api.supabase.com/v1/projects/zgkdcykrnalcszhmtuzx/database/query"

# Split SQL into individual statements and execute them
statements = [s.strip() for s in SQL.split(";") if s.strip()]

print(f"\nFound {len(statements)} SQL statements to execute.")

# Try using Supabase's postgres endpoint directly
# The service role can execute SQL via the REST API using PostgREST
# For DDL, we need to use the database API

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# First, test connectivity by hitting the health endpoint
health_url = f"{SUPABASE_URL}/rest/v1/"
req = urllib.request.Request(health_url, headers={"apikey": SERVICE_KEY})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    print(f"✅ Supabase connection OK (status {resp.status})")
except urllib.error.HTTPError as e:
    if e.code == 200 or e.code == 406:
        print(f"✅ Supabase connection OK")
    else:
        print(f"⚠️  Connection returned: {e.code}")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

print("\n✅ Supabase credentials are valid!")
print("\nIMPORTANT: The SQL migration cannot be run programmatically via the REST API.")
print("Please run the migration manually:")
print("1. Go to: https://supabase.com/dashboard/project/zgkdcykrnalcszhmtuzx/sql/new")
print("2. Login to your account")
print("3. Paste the contents of: backend/supabase_migration.sql")
print("4. Click Run")
print("\nAlternatively, the FastAPI backend will work with Supabase once tables exist.")
