-- ============================================================================
-- Austin Karaoke Directory — JSONB redesign
-- Issue #47: Collapse 5-table normalized schema to 2-table JSONB-heavy model
-- ============================================================================
--
-- The frontend always fetches the entire venue bundle in one shot and filters
-- client-side. Joins, FKs, and per-table indexes weren't earning their keep.
--
-- This migration:
--   1. Drops the old normalized tables (schedules, venue_tags, venues, hosts, tags)
--   2. Recreates `tags` (small reference table — kept for shared definitions)
--   3. Creates `venues` with id/name/active as columns + everything else in JSONB
--   4. Recreates RLS policies (much simpler — just two tables now)
--
-- After this runs, push the freshly generated seed.sql to populate.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Drop old schema
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS schedules   CASCADE;
DROP TABLE IF EXISTS venue_tags  CASCADE;
DROP TABLE IF EXISTS venues      CASCADE;
DROP TABLE IF EXISTS hosts       CASCADE;
DROP TABLE IF EXISTS tags        CASCADE;

-- ----------------------------------------------------------------------------
-- 2. Tags — shared badge definitions
-- ----------------------------------------------------------------------------
CREATE TABLE tags (
  id          TEXT PRIMARY KEY,                 -- 'lgbtq', 'dive', '21+'
  label       TEXT NOT NULL,                    -- 'LGBTQ+', 'Dive Bar'
  color       TEXT NOT NULL DEFAULT '#9e9e9e',  -- Badge background hex
  text_color  TEXT NOT NULL DEFAULT '#fff'      -- Badge text hex
);

-- ----------------------------------------------------------------------------
-- 3. Venues — id/name/active as columns; everything else as JSONB
--
-- The `data` JSONB column holds:
--   dedicated, address{}, coordinates{}, host{}, socials{},
--   schedule[], activePeriod{}, tags[]
--
-- Top-level columns are pulled out for:
--   id     — primary key, future FK target (e.g. submissions table)
--   name   — every fetch sorts by name
--   active — RLS policy filter
-- ----------------------------------------------------------------------------
CREATE TABLE venues (
  id      TEXT PRIMARY KEY,                     -- Slug: 'the-alcove-cantina'
  name    TEXT NOT NULL,
  active  BOOLEAN NOT NULL DEFAULT true,
  data    JSONB NOT NULL
);

CREATE INDEX venues_active_idx ON venues (active);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security — public read-only on active venues + all tags
-- ----------------------------------------------------------------------------
ALTER TABLE tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tags are publicly readable"
  ON tags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Active venues are publicly readable"
  ON venues FOR SELECT
  TO anon, authenticated
  USING (active = true);

COMMIT;
