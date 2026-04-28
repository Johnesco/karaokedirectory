-- ============================================================================
-- Austin Karaoke Directory — Row Level Security Policies
-- Spike #44: Role-based access control
-- ============================================================================
--
-- Current roles (Phase 1 — spike):
--   anon  = unauthenticated public visitors (read-only)
--
-- Future roles (Phase 4 — community accounts):
--   fan   = authenticated, can submit tips
--   kj    = authenticated, can manage own shows
--   venue = authenticated, can manage own listing
--   admin = authenticated, full CRUD + moderation
--
-- For Phase 1, we only need public read access. The future policies
-- are included as commented-out SQL for reference.
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PHASE 1: Public read-only access via anon key
-- The public site queries Supabase with the anon key. These policies
-- allow reading active venues and their related data. No writes allowed.
-- ============================================================================

-- Tags: everyone can read (reference data)
CREATE POLICY "Tags are publicly readable"
  ON tags FOR SELECT
  TO anon, authenticated
  USING (true);

-- Hosts: everyone can read
CREATE POLICY "Hosts are publicly readable"
  ON hosts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Venues: public can read active venues only
CREATE POLICY "Active venues are publicly readable"
  ON venues FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Venue tags: public can read tags for active venues
CREATE POLICY "Venue tags are publicly readable"
  ON venue_tags FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venues WHERE venues.id = venue_tags.venue_id AND venues.active = true
    )
  );

-- Schedules: public can read schedules for active venues
CREATE POLICY "Schedules are publicly readable"
  ON schedules FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venues WHERE venues.id = schedules.venue_id AND venues.active = true
    )
  );

-- ============================================================================
-- PHASE 4 POLICIES (commented out — activate when profiles table exists)
-- ============================================================================

/*
-- Helper function: get the current user's role from profiles
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- ADMIN: full CRUD on all tables ----

CREATE POLICY "Admins can read all venues (including inactive)"
  ON venues FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert venues"
  ON venues FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update venues"
  ON venues FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete venues"
  ON venues FOR DELETE
  TO authenticated
  USING (is_admin());

-- Repeat for schedules, hosts, tags, venue_tags...

-- ---- VENUE OWNERS: manage their own listing ----

CREATE POLICY "Venue owners can update their venue"
  ON venues FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Venue owners can manage their schedules"
  ON schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.id = schedules.venue_id AND venues.owner_id = auth.uid()
    )
  );

-- ---- KJs: manage shows they host ----

CREATE POLICY "KJs can manage their host record"
  ON hosts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ---- SUBMISSIONS: any authenticated user can submit ----

CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users can view their own submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update submissions (approve/reject)"
  ON submissions FOR UPDATE
  TO authenticated
  USING (is_admin());
*/
