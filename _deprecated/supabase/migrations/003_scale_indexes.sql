-- ============================================================================
-- Austin Karaoke Directory — Scale-readiness indexes
-- Spike #44: Prepares for growth beyond current ~77 venues
-- ============================================================================

-- Composite index for recurring schedule lookups ("What's on Wednesdays?")
CREATE INDEX idx_schedules_freq_day ON schedules(frequency, day) WHERE frequency != 'once';

-- One-time event date range lookups ("What special events are this month?")
CREATE INDEX idx_schedules_once_date ON schedules(date) WHERE frequency = 'once';
