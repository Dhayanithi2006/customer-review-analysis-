-- Persist Decision Score pillars on issue clusters (display-only transparency).
-- Formula remains backend-only; this stores the breakdown for UI.

ALTER TABLE issue_clusters
  ADD COLUMN IF NOT EXISTS decision_pillars JSONB DEFAULT NULL;
