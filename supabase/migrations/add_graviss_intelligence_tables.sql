-- GravIntel: self-hosted website visitor intelligence
-- Tracks anonymous visitors, identifies them via email clicks/form fills,
-- and stores full activity timeline

CREATE TABLE IF NOT EXISTS gi_visitors (
  visitor_id   TEXT PRIMARY KEY,
  site_id      TEXT NOT NULL DEFAULT 'default',
  email        TEXT,
  name         TEXT,
  phone        TEXT,
  company      TEXT,
  title        TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  language     TEXT,
  screen_width INT,
  screen_height INT,
  city         TEXT,
  region       TEXT,
  country      TEXT,
  isp          TEXT,
  rdns_company TEXT,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_count  INT NOT NULL DEFAULT 1,
  is_hot_lead  BOOLEAN NOT NULL DEFAULT FALSE,
  lead_score   INT NOT NULL DEFAULT 0,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  crm_contact_id TEXT,
  tags         TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gi_visitors_email ON gi_visitors(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gi_visitors_site ON gi_visitors(site_id);
CREATE INDEX IF NOT EXISTS idx_gi_visitors_last_seen ON gi_visitors(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_gi_visitors_hot ON gi_visitors(is_hot_lead) WHERE is_hot_lead = TRUE;

CREATE TABLE IF NOT EXISTS gi_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id   TEXT NOT NULL REFERENCES gi_visitors(visitor_id) ON DELETE CASCADE,
  session_id   TEXT NOT NULL,
  site_id      TEXT NOT NULL DEFAULT 'default',
  event_type   TEXT NOT NULL,
  url          TEXT,
  path         TEXT,
  title        TEXT,
  referrer     TEXT,
  time_on_page INT,
  scroll_depth INT,
  target_url   TEXT,
  form_action  TEXT,
  custom_event TEXT,
  custom_properties JSONB,
  ip_address   TEXT,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gi_events_visitor ON gi_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_gi_events_session ON gi_events(session_id);
CREATE INDEX IF NOT EXISTS idx_gi_events_type ON gi_events(event_type);
CREATE INDEX IF NOT EXISTS idx_gi_events_ts ON gi_events(timestamp DESC);

-- Function to increment visit count (called from the track API)
CREATE OR REPLACE FUNCTION gi_increment_visits(vid TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE gi_visitors
  SET visit_count = visit_count + 1,
      last_seen = NOW()
  WHERE visitor_id = vid;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-score leads based on behavior
CREATE OR REPLACE FUNCTION gi_score_visitor(vid TEXT)
RETURNS INT AS $$
DECLARE
  score INT := 0;
  v RECORD;
BEGIN
  SELECT * INTO v FROM gi_visitors WHERE visitor_id = vid;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Points for visit frequency
  score := score + LEAST(v.visit_count * 5, 50);

  -- Points for being identified
  IF v.email IS NOT NULL THEN score := score + 20; END IF;
  IF v.phone IS NOT NULL THEN score := score + 10; END IF;
  IF v.company IS NOT NULL THEN score := score + 10; END IF;

  -- Points for recent activity (within 7 days)
  IF v.last_seen > NOW() - INTERVAL '7 days' THEN score := score + 15; END IF;

  -- Points for page depth (many events)
  score := score + LEAST((SELECT COUNT(*) FROM gi_events WHERE gi_events.visitor_id = vid)::INT, 30);

  -- Mark as hot lead if score >= 60
  UPDATE gi_visitors SET lead_score = score, is_hot_lead = (score >= 60) WHERE visitor_id = vid;

  RETURN score;
END;
$$ LANGUAGE plpgsql;
