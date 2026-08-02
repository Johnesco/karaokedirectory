-- ============================================================================
-- Austin Karaoke Directory — Initial Schema
-- Spike #44: Supabase migration proof of concept
-- ============================================================================

-- ============================================================================
-- 1. TAGS — Reference table for venue tag definitions
-- ============================================================================
CREATE TABLE tags (
  id          TEXT PRIMARY KEY,            -- e.g. 'lgbtq', 'dive', '21+'
  label       TEXT NOT NULL,               -- Human-readable: 'LGBTQ+', 'Dive Bar'
  color       TEXT NOT NULL DEFAULT '#9e9e9e',  -- Badge background hex
  text_color  TEXT NOT NULL DEFAULT '#fff'      -- Badge text hex
);

-- ============================================================================
-- 2. HOSTS — KJ / hosting company entities
--    Normalized because multiple venues share the same host (e.g. "Starling Karaoke").
--    In Phase 4, hosts link to auth.users for self-service management.
-- ============================================================================
CREATE TABLE hosts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,                        -- KJ name (e.g. 'KJ Average Joe')
  company     TEXT,                        -- Company name (e.g. 'Starling Karaoke')
  website     TEXT,                        -- Host/company website
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- At least one of name or company must be provided
  CONSTRAINT hosts_name_or_company CHECK (name IS NOT NULL OR company IS NOT NULL)
);

-- ============================================================================
-- 3. VENUES — Core venue table
--    Address and socials are flattened (1:1 relationship, no need for joins).
--    Coordinates stored as simple numeric — PostGIS is overkill at ~70 venues.
-- ============================================================================
CREATE TABLE venues (
  id                  TEXT PRIMARY KEY,            -- Slug: 'the-alcove-cantina'
  name                TEXT NOT NULL,
  active              BOOLEAN NOT NULL DEFAULT true,
  dedicated           BOOLEAN NOT NULL DEFAULT false,

  -- Address (flattened)
  street              TEXT,
  city                TEXT,
  state               TEXT DEFAULT 'TX',
  zip                 TEXT,
  neighborhood        TEXT,

  -- Coordinates
  lat                 NUMERIC,
  lng                 NUMERIC,

  -- Active period (optional window when venue appears)
  active_period_start DATE,
  active_period_end   DATE,

  -- Host (nullable FK — not every venue has a known host)
  host_id             UUID REFERENCES hosts(id) ON DELETE SET NULL,

  -- Socials (flattened — known set of platforms)
  website             TEXT,
  facebook            TEXT,
  instagram           TEXT,
  twitter             TEXT,
  tiktok              TEXT,
  youtube             TEXT,
  bluesky             TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. VENUE_TAGS — Many-to-many junction
-- ============================================================================
CREATE TABLE venue_tags (
  venue_id    TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, tag_id)
);

-- ============================================================================
-- 5. SCHEDULES — One row per schedule entry on a venue
--    Supports recurring ('every', 'first', 'second', etc.) and one-time ('once').
-- ============================================================================
CREATE TABLE schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- Frequency: 'every', 'first', 'second', 'third', 'fourth', 'last', 'once'
  frequency   TEXT NOT NULL,

  -- For recurring: day of week ('Monday' .. 'Sunday'); NULL for 'once'
  day         TEXT,

  -- For one-time: specific date; NULL for recurring
  date        DATE,

  start_time  TIME NOT NULL,
  end_time    TIME,                        -- Nullable: some venues only advertise start time

  -- Optional event details (primarily for 'once' events)
  event_name  TEXT,
  event_url   TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validation: recurring events need a day, one-time events need a date
  CONSTRAINT schedules_recurring_has_day CHECK (
    frequency = 'once' OR day IS NOT NULL
  ),
  CONSTRAINT schedules_once_has_date CHECK (
    frequency != 'once' OR date IS NOT NULL
  ),
  CONSTRAINT schedules_valid_frequency CHECK (
    frequency IN ('every', 'first', 'second', 'third', 'fourth', 'last', 'once')
  ),
  CONSTRAINT schedules_valid_day CHECK (
    day IS NULL OR day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
  )
);

-- ============================================================================
-- 6. INDEXES
-- ============================================================================
CREATE INDEX idx_venues_active ON venues(active) WHERE active = true;
CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_schedules_venue ON schedules(venue_id);
CREATE INDEX idx_schedules_day ON schedules(day) WHERE day IS NOT NULL;
CREATE INDEX idx_schedules_date ON schedules(date) WHERE date IS NOT NULL;
CREATE INDEX idx_venue_tags_tag ON venue_tags(tag_id);

-- ============================================================================
-- 7. UPDATED_AT TRIGGER — auto-update timestamps on row changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER hosts_updated_at
  BEFORE UPDATE ON hosts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 8. FUTURE TABLES (Phase 4 — Community Accounts)
--    Included here as commented-out SQL for reference during the spike.
--    These will get their own migration when Phase 4 begins.
-- ============================================================================

/*
-- User profiles linked to Supabase Auth
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'fan' CHECK (role IN ('fan', 'kj', 'venue', 'admin')),
  display_name  TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link hosts to user accounts (Phase 4)
ALTER TABLE hosts ADD COLUMN user_id UUID REFERENCES profiles(id);

-- Link venues to user accounts (Phase 4 — venue owners)
ALTER TABLE venues ADD COLUMN owner_id UUID REFERENCES profiles(id);

-- Moderation queue for community submissions
CREATE TABLE submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by    UUID NOT NULL REFERENCES profiles(id),
  submission_type TEXT NOT NULL CHECK (submission_type IN ('new_venue', 'update_venue', 'new_show', 'tip')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  data            JSONB NOT NULL,               -- The proposed changes
  notes           TEXT,                          -- Submitter notes
  review_notes    TEXT,                          -- Admin review notes
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submissions_status ON submissions(status) WHERE status = 'pending';
CREATE INDEX idx_submissions_user ON submissions(submitted_by);
*/
