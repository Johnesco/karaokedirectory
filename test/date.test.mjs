/**
 * Unit tests for js/utils/date.js — schedule matching and date handling.
 *
 * Node's built-in runner: `npm run test:unit`. No devDependency, no build step
 * (ADR-002). date.js imports nothing and touches no DOM, so it loads in Node
 * unchanged.
 *
 * Why this module: schedule matching IS the product. A regression here sends
 * someone to a bar on the wrong night, and the e2e suite cannot reach branches
 * like `fifth` or the fourth-vs-last distinction unless data.json happens to
 * contain such an entry inside the rendered window.
 *
 * Dates are constructed with `new Date(y, m, d)` (local midnight) so these
 * assertions hold in any timezone.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDayName,
  scheduleMatchesDate,
  getScheduleExclusion,
  getVenueExclusionForDate,
  isPastOnceEvent,
  parseLocalDate,
  isDateInRange,
  formatTime12,
  formatTime24,
  formatTimeRange,
  getWeekRange,
  startOfToday,
  formatDateMonthDay,
  daysSince,
  freshnessOf,
  FRESHNESS_HORIZON_DAYS,
  toLocalISO,
  isAnnouncedOn,
} from '../js/utils/date.js';

// January 2026 has five Fridays: 2, 9, 16, 23, 30.
// February 2026 has four:        6, 13, 20, 27.
// That pair is what separates "fourth" from "last".
const JAN = (d) => new Date(2026, 0, d);
const FEB = (d) => new Date(2026, 1, d);

describe('date fixtures are what the tests assume', () => {
  it('January 2026 Fridays are 2, 9, 16, 23, 30', () => {
    for (const d of [2, 9, 16, 23, 30]) {
      assert.equal(getDayName(JAN(d)), 'friday', `Jan ${d} should be a Friday`);
    }
    // and Jan has no sixth Friday
    assert.notEqual(getDayName(JAN(31)), 'friday');
  });

  it('February 2026 Fridays are 6, 13, 20, 27 — only four', () => {
    for (const d of [6, 13, 20, 27]) {
      assert.equal(getDayName(FEB(d)), 'friday', `Feb ${d} should be a Friday`);
    }
    assert.equal(FEB(28).getDate(), 28);
    assert.notEqual(getDayName(FEB(28)), 'friday');
  });
});

describe('getWeekRange / startOfToday — the map date filter spans (#215)', () => {
  // Jan 2026: the 4th is a Sunday, the 10th the Saturday that closes that week.
  it('spans Sunday 00:00 to Saturday 23:59 around a midweek date', () => {
    const { start, end } = getWeekRange(new Date(2026, 0, 7, 15, 30));
    assert.equal(getDayName(start), 'sunday');
    assert.equal(start.getDate(), 4);
    assert.equal(getDayName(end), 'saturday');
    assert.equal(end.getDate(), 10);
    assert.equal(start.getHours(), 0);
    assert.equal(end.getHours(), 23);
  });

  it('includes days already past — a week is the whole week', () => {
    // Asked on Thursday, Sunday is still in range. This is the behaviour the
    // "This Week" button promises, as opposed to "the next seven days".
    const { start } = getWeekRange(JAN(8));
    assert.equal(start.getDate(), 4);
  });

  it('a Sunday is its own week start; a Saturday closes its own week', () => {
    assert.equal(getWeekRange(JAN(4)).start.getDate(), 4);
    assert.equal(getWeekRange(JAN(10)).end.getDate(), 10);
    assert.equal(getWeekRange(JAN(11)).start.getDate(), 11);
  });

  it('startOfToday strips the time of day', () => {
    const d = startOfToday();
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
    assert.equal(d.getSeconds(), 0);
    assert.equal(d.getMilliseconds(), 0);
    assert.equal(d.toDateString(), new Date().toDateString());
  });
});

describe('scheduleMatchesDate — recurring frequencies', () => {
  const every = { frequency: 'every', day: 'Friday' };
  const fourth = { frequency: 'fourth', day: 'Friday' };
  const fifth = { frequency: 'fifth', day: 'Friday' };
  const last = { frequency: 'last', day: 'Friday' };

  it('"every" matches every occurrence of the weekday', () => {
    for (const d of [2, 9, 16, 23, 30]) {
      assert.equal(scheduleMatchesDate(every, JAN(d)), true, `Jan ${d}`);
    }
  });

  it('never matches a different weekday', () => {
    assert.equal(scheduleMatchesDate(every, JAN(3)), false); // Saturday
  });

  it('day name matching is case-insensitive', () => {
    assert.equal(scheduleMatchesDate({ frequency: 'every', day: 'FRIDAY' }, JAN(2)), true);
    assert.equal(scheduleMatchesDate({ frequency: 'every', day: 'friday' }, JAN(2)), true);
  });

  it('"fourth" is the 4th occurrence, not the final one', () => {
    assert.equal(scheduleMatchesDate(fourth, JAN(23)), true);
    assert.equal(scheduleMatchesDate(fourth, JAN(30)), false);
  });

  it('"last" is the final occurrence — Jan 30, not Jan 23', () => {
    assert.equal(scheduleMatchesDate(last, JAN(30)), true);
    assert.equal(scheduleMatchesDate(last, JAN(23)), false);
  });

  it('"fourth" and "last" COINCIDE in a four-Friday month', () => {
    // The whole reason both frequencies exist. Feb 27 is both.
    assert.equal(scheduleMatchesDate(fourth, FEB(27)), true);
    assert.equal(scheduleMatchesDate(last, FEB(27)), true);
  });

  it('"fifth" matches only in a five-Friday month', () => {
    assert.equal(scheduleMatchesDate(fifth, JAN(30)), true);
    // February has no fifth Friday, so nothing in the month matches
    for (const d of [6, 13, 20, 27]) {
      assert.equal(scheduleMatchesDate(fifth, FEB(d)), false, `Feb ${d}`);
    }
  });

  it('"fifth" and "last" coincide when a fifth occurrence exists', () => {
    assert.equal(scheduleMatchesDate(fifth, JAN(30)), true);
    assert.equal(scheduleMatchesDate(last, JAN(30)), true);
  });

  it('an unknown frequency matches nothing rather than throwing', () => {
    assert.equal(scheduleMatchesDate({ frequency: 'sixth', day: 'Friday' }, JAN(30)), false);
  });
});

describe('scheduleMatchesDate — one-time events', () => {
  it('matches the exact calendar date', () => {
    const entry = { frequency: 'once', date: '2026-01-30' };
    assert.equal(scheduleMatchesDate(entry, JAN(30)), true);
    assert.equal(scheduleMatchesDate(entry, JAN(29)), false);
    assert.equal(scheduleMatchesDate(entry, JAN(31)), false);
  });

  it('single-digit months and days are zero-padded when compared', () => {
    // Guards the padStart logic: 2026-02-06, not 2026-2-6
    assert.equal(scheduleMatchesDate({ frequency: 'once', date: '2026-02-06' }, FEB(6)), true);
    assert.equal(scheduleMatchesDate({ frequency: 'once', date: '2026-2-6' }, FEB(6)), false);
  });

  it('ignores `day` entirely for one-time entries', () => {
    // A "once" entry with a contradictory weekday still matches its date
    const entry = { frequency: 'once', date: '2026-01-30', day: 'Monday' };
    assert.equal(scheduleMatchesDate(entry, JAN(30)), true);
  });
});

describe('isPastOnceEvent', () => {
  // "One-time" means the date is not on a predictable cadence, not that it
  // happens only once — a venue may hold many. Each is still spent the day
  // after it happens, which is what this reports (#169).
  it('retires an entry the day after it happens', () => {
    const e = { frequency: 'once', date: '2026-01-09' };
    assert.equal(isPastOnceEvent(e, JAN(10)), true);
    assert.equal(isPastOnceEvent(e, JAN(9)), false, 'the day itself is not past');
  });

  it("says nothing about a venue's other one-time entries", () => {
    // Several `once` rows on one venue is the normal shape for an irregular
    // night, not a data smell. Each is judged on its own date.
    const past = { frequency: 'once', date: '2026-01-09' };
    const future = { frequency: 'once', date: '2026-02-06' };
    assert.equal(isPastOnceEvent(past, JAN(10)), true);
    assert.equal(isPastOnceEvent(future, JAN(10)), false);
  });

  it('never retires a weekday-recurring entry', () => {
    assert.equal(isPastOnceEvent({ frequency: 'every', day: 'friday' }, JAN(30)), false);
  });
});

describe('getScheduleExclusion', () => {
  const base = { frequency: 'every', day: 'Friday' };

  it('returns null when there are no exclusions', () => {
    assert.equal(getScheduleExclusion(base, JAN(2)), null);
    assert.equal(getScheduleExclusion({ ...base, exclusions: [] }, JAN(2)), null);
  });

  it('matches the object form and carries the reason through', () => {
    const s = { ...base, exclusions: [{ date: '2026-01-02', reason: 'Holiday' }] };
    assert.deepEqual(getScheduleExclusion(s, JAN(2)), { date: '2026-01-02', reason: 'Holiday' });
  });

  it('defaults a missing reason to null rather than undefined', () => {
    const s = { ...base, exclusions: [{ date: '2026-01-02' }] };
    assert.deepEqual(getScheduleExclusion(s, JAN(2)), { date: '2026-01-02', reason: null });
  });

  it('ignores the bare-string shorthand — the schema rejects it', () => {
    // This test used to assert the opposite, recording that the runtime took a
    // form CLAUDE.md documented and the schema refused. That combination meant
    // following the documentation failed CI (`exclusions/0 — must be object`).
    // The shorthand is gone from the code and both documents (#169), so a bare
    // string now matches nothing rather than quietly working in one layer.
    const s = { ...base, exclusions: ['2026-01-02'] };
    assert.equal(getScheduleExclusion(s, JAN(2)), null);
  });

  it('returns null on a non-excluded date', () => {
    const s = { ...base, exclusions: [{ date: '2026-01-02' }] };
    assert.equal(getScheduleExclusion(s, JAN(9)), null);
  });

  it('an exclusion does not stop the schedule from matching', () => {
    // Deliberate: the card still renders, with a "closed" indicator
    const s = { ...base, exclusions: [{ date: '2026-01-02' }] };
    assert.equal(scheduleMatchesDate(s, JAN(2)), true);
    assert.notEqual(getScheduleExclusion(s, JAN(2)), null);
  });
});

describe('getVenueExclusionForDate', () => {
  it('finds an exclusion on whichever entry matches the date', () => {
    const venue = {
      schedule: [
        { frequency: 'every', day: 'Monday' },
        { frequency: 'every', day: 'Friday', exclusions: [{ date: '2026-01-02', reason: 'Private event' }] },
      ],
    };
    assert.deepEqual(getVenueExclusionForDate(venue, JAN(2)), { date: '2026-01-02', reason: 'Private event' });
  });

  it('returns null when the excluded entry does not match that date', () => {
    const venue = {
      schedule: [{ frequency: 'every', day: 'Monday', exclusions: [{ date: '2026-01-02' }] }],
    };
    // Jan 2 is a Friday, so the Monday entry never matches
    assert.equal(getVenueExclusionForDate(venue, JAN(2)), null);
  });

  it('tolerates a venue with no schedule', () => {
    assert.equal(getVenueExclusionForDate({}, JAN(2)), null);
    assert.equal(getVenueExclusionForDate(null, JAN(2)), null);
  });
});

describe('parseLocalDate', () => {
  it('parses as local midnight, not UTC', () => {
    // `new Date("2026-05-23")` is UTC midnight, which is the 22nd anywhere
    // west of UTC. This is the bug from #60.
    const d = parseLocalDate('2026-05-23');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 4);
    assert.equal(d.getDate(), 23);
    assert.equal(d.getHours(), 0);
  });
});

describe('isDateInRange', () => {
  it('is inclusive of both endpoints', () => {
    assert.equal(isDateInRange(JAN(1), '2026-01-01', '2026-01-31'), true);
    assert.equal(isDateInRange(JAN(31), '2026-01-01', '2026-01-31'), true);
  });

  it('excludes dates outside the range', () => {
    assert.equal(isDateInRange(new Date(2025, 11, 31), '2026-01-01', '2026-01-31'), false);
    assert.equal(isDateInRange(FEB(1), '2026-01-01', '2026-01-31'), false);
  });

  it('treats a null bound as open-ended', () => {
    assert.equal(isDateInRange(JAN(1), null, '2026-01-31'), true);
    assert.equal(isDateInRange(JAN(1), '2026-01-01', null), true);
    assert.equal(isDateInRange(JAN(1), null, null), true);
  });

  it('a single-day window containing only that day matches it', () => {
    // The #60 repro: activePeriod.start === end === the day being checked.
    // Under the old UTC parsing this returned false in any timezone west of
    // UTC, hiding a venue on the one day it was supposed to appear.
    assert.equal(isDateInRange(JAN(15), '2026-01-15', '2026-01-15'), true);
    assert.equal(isDateInRange(JAN(14), '2026-01-15', '2026-01-15'), false);
    assert.equal(isDateInRange(JAN(16), '2026-01-15', '2026-01-15'), false);
  });

  it('ignores the time of day on the date being checked', () => {
    const lateEvening = new Date(2026, 0, 31, 23, 45);
    assert.equal(isDateInRange(lateEvening, '2026-01-01', '2026-01-31'), true);
  });
});

describe('isPastOnceEvent', () => {
  const asOf = JAN(15);

  it('is true for a one-time event before the reference date', () => {
    assert.equal(isPastOnceEvent({ frequency: 'once', date: '2026-01-14' }, asOf), true);
  });

  it('is false on the day itself — an event today has not passed', () => {
    assert.equal(isPastOnceEvent({ frequency: 'once', date: '2026-01-15' }, asOf), false);
  });

  it('is false for a future one-time event', () => {
    assert.equal(isPastOnceEvent({ frequency: 'once', date: '2026-01-16' }, asOf), false);
  });

  it('is false for recurring entries regardless of date', () => {
    assert.equal(isPastOnceEvent({ frequency: 'every', day: 'Friday' }, asOf), false);
  });

  it('is false for a "once" entry with no date, and for junk input', () => {
    assert.equal(isPastOnceEvent({ frequency: 'once' }, asOf), false);
    assert.equal(isPastOnceEvent(null, asOf), false);
    assert.equal(isPastOnceEvent(undefined, asOf), false);
  });
});

describe('time formatting', () => {
  it('formatTime12 converts 24-hour to 12-hour', () => {
    assert.equal(formatTime12('21:00'), '9:00 PM');
    assert.equal(formatTime12('01:00'), '1:00 AM');
    assert.equal(formatTime12('00:00'), '12:00 AM');
    assert.equal(formatTime12('12:00'), '12:00 PM');
    assert.equal(formatTime12('12:30'), '12:30 PM');
    assert.equal(formatTime12('09:05'), '9:05 AM');
  });

  it('formatTime12 returns empty string for missing input', () => {
    assert.equal(formatTime12(''), '');
    assert.equal(formatTime12(null), '');
    assert.equal(formatTime12(undefined), '');
  });

  it('formatTime24 round-trips with formatTime12', () => {
    for (const t of ['21:00', '01:00', '00:00', '12:00', '09:05']) {
      assert.equal(formatTime24(formatTime12(t)), t, `round trip ${t}`);
    }
  });

  it('formatTimeRange renders a range that crosses midnight', () => {
    // 21:00 -> 01:00 is the single most common shape in data.json
    assert.equal(formatTimeRange('21:00', '01:00'), '9:00 PM - 1:00 AM');
  });

  it('formatTimeRange shows "Close" when there is no end time', () => {
    assert.equal(formatTimeRange('21:00', null), '9:00 PM - Close');
    assert.equal(formatTimeRange('21:00', undefined), '9:00 PM - Close');
  });
});

// ---- Freshness (#246, #259) -------------------------------------------------
// `now` is injected everywhere so these hold on any day the suite runs.
describe('freshness helpers', () => {
  const SEP = (d) => new Date(2026, 8, d);   // September 2026

  it('formatDateMonthDay drops the year inside the current year and keeps it otherwise', () => {
    assert.equal(formatDateMonthDay('2026-08-28', { now: SEP(6) }), 'Aug 28');
    assert.equal(formatDateMonthDay('2025-08-28', { now: SEP(6) }), 'Aug 28, 2025');
  });

  it('daysSince counts whole days at local midnight, negative for the future', () => {
    assert.equal(daysSince('2026-09-06', SEP(6)), 0);
    assert.equal(daysSince('2026-08-28', SEP(6)), 9);
    assert.equal(daysSince('2026-09-07', SEP(6)), -1);
    // A span crossing the March DST change still counts calendar days.
    assert.equal(daysSince('2026-03-01', new Date(2026, 2, 15)), 14);
  });

  it('freshnessOf: absent is "never", inside the horizon is fresh, past it is overdue', () => {
    assert.equal(FRESHNESS_HORIZON_DAYS, 60);
    assert.deepEqual(freshnessOf({}, SEP(6)), { state: 'never', days: null, iso: '' });
    assert.deepEqual(freshnessOf({ lastVerified: '2026-08-28' }, SEP(6)), { state: 'fresh', days: 9, iso: '2026-08-28' });
    // Sep 6 minus 60 days is Jul 8: on the horizon is still fresh, one day past it is not.
    assert.equal(freshnessOf({ lastVerified: '2026-07-08' }, SEP(6)).state, 'fresh');
    assert.equal(freshnessOf({ lastVerified: '2026-07-07' }, SEP(6)).state, 'overdue');
  });

  it('toLocalISO is the local calendar day and round-trips parseLocalDate', () => {
    assert.equal(toLocalISO(SEP(6)), '2026-09-06');
    assert.equal(toLocalISO(new Date(2026, 0, 1)), '2026-01-01');
    // Late evening stays on the same local day (toISOString would already be tomorrow in UTC+ zones, or yesterday west of UTC).
    assert.equal(toLocalISO(new Date(2026, 8, 6, 23, 30)), '2026-09-06');
    assert.equal(toLocalISO(parseLocalDate('2026-12-31')), '2026-12-31');
  });
});

// ---- Announced nights (#263) ----------------------------------------------
describe('isAnnouncedOn', () => {
  const SUN = new Date(2026, 8, 6);   // 2026-09-06 is a Sunday
  const recurring = (over = {}) => ({ frequency: 'every', day: 'Sunday', startTime: '20:00', endTime: '00:00', ...over });
  const once = (over = {}) => ({ frequency: 'once', date: '2026-09-06', startTime: '20:00', endTime: '23:00', ...over });

  it('marks a recurring show only on the night it was announced for', () => {
    const e = recurring({ lastVerified: '2026-09-06', verifiedBy: 'announcement', announcedFor: '2026-09-06' });
    assert.equal(isAnnouncedOn(e, SUN), true);
    assert.equal(isAnnouncedOn(e, new Date(2026, 8, 13)), false);   // next Sunday
  });

  it('marks a one-time show on its own date when the evidence is an announcement', () => {
    assert.equal(isAnnouncedOn(once({ lastVerified: '2026-09-05', verifiedBy: 'announcement' }), SUN), true);
    assert.equal(isAnnouncedOn(once({ lastVerified: '2026-09-05', verifiedBy: 'announcement', date: '2026-09-07' }), SUN), false);
  });

  it('needs the announcement level — a later plain check clears the marker', () => {
    assert.equal(isAnnouncedOn(recurring({ lastVerified: '2026-09-06', announcedFor: '2026-09-06' }), SUN), false);
    assert.equal(isAnnouncedOn(recurring({ lastVerified: '2026-09-06', verifiedBy: 'check', announcedFor: '2026-09-06' }), SUN), false);
    assert.equal(isAnnouncedOn(once({ lastVerified: '2026-09-05' }), SUN), false);
  });

  it('is false for nothing to compare', () => {
    assert.equal(isAnnouncedOn(null, SUN), false);
    assert.equal(isAnnouncedOn(recurring({ verifiedBy: 'announcement', announcedFor: '2026-09-06' }), null), false);
  });
});
