"""
RoadmapAI — Supabase Migration Script
Run this ONCE to create all database tables.

Usage:
  backend\\venv\\Scripts\\python.exe backend\\migrate.py

You need the DB password from:
Supabase Dashboard -> Project Settings -> Database -> Database password
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
PROJECT_REF = "zgkdcykrnalcszhmtuzx"

if not DB_PASSWORD:
    print("=" * 60)
    print("ERROR: DB_PASSWORD not set.")
    print()
    print("Get your database password from:")
    print("  Supabase Dashboard -> Project Settings -> Database")
    print("  -> Database password (or click 'Reset database password')")
    print()
    print("Then run:")
    print("  set DB_PASSWORD=your_password_here")
    print("  backend\\venv\\Scripts\\python.exe backend\\migrate.py")
    print("=" * 60)
    sys.exit(1)

import psycopg2

# Supabase connection string
# Use Session mode (port 5432) for DDL statements
CONN_STRING = (
    f"postgresql://postgres.{PROJECT_REF}:{DB_PASSWORD}"
    f"@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
)

print(f"Connecting to Supabase project {PROJECT_REF}...")

SQL = open(os.path.join(os.path.dirname(__file__), "supabase_migration.sql"), encoding="utf-8").read()

try:
    conn = psycopg2.connect(CONN_STRING)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("Running migration...")
    cur.execute(SQL)
    
    print()
    print("=" * 60)
    print("SUCCESS! All tables created.")
    print("=" * 60)
    print()
    print("Tables created:")
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
    for row in cur.fetchall():
        print(f"  - {row[0]}")
    
    cur.close()
    conn.close()

except psycopg2.OperationalError as e:
    print(f"Connection failed: {e}")
    print()
    print("Make sure the DB_PASSWORD is correct.")
    sys.exit(1)
except Exception as e:
    print(f"Migration failed: {e}")
    sys.exit(1)
