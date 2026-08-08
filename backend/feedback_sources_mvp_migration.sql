-- Phase 2 MVP feedback sources: qr | direct | csv | sample
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_source_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_source_check
  CHECK (source IN (
    'play_store','app_store','support','twitter','reddit',
    'qr_form','web_form','csv','telegram',
    'qr','direct','sample'
  ));

ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'direct';
