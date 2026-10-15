/**
 * Day-card sections (ADR-017, #324; prototyped in spike #320).
 *
 * Every day card groups its shows into sections instead of one flat list:
 *
 *   (specials)  `frequency: "once"` — pinned on top, as today; no heading
 *   New         the show or its venue was added within the last 30 days
 *   Updated     an existing show's details changed within the last 30 days (#335)
 *   Featured    an owner-set flag on the show (test placements only for now)
 *   Verified    the show's `lastVerified` is within the last 30 days
 *   (the rest)  everything else; no heading, always last
 *
 * A show sits in exactly one section — the first it qualifies for, in the
 * order above — so the footer's venue count needs no change. Inside a section
 * the input order is kept, and `getVenueEventsForDate()` already sorts A–Z:
 * position within a section is never a rank.
 *
 * Both 30-day windows count back from TODAY, not from the card's date (owner
 * decision), so every card — the week and the extended sections alike — shows
 * the same split. The Featured window is different in kind: it is a placement
 * on particular nights, so it is tested against the card's own date.
 *
 * Pure: every helper takes its reference dates as arguments, so the rules are
 * unit-tested without a DOM (test/sections.test.mjs).
 */

import { daysSince, parseLocalDate, startOfToday, VERIFIED_WINDOW_DAYS } from './date.js';

/**
 * Both windows — New and Verified — are the one 30-day clock (#330). New uses
 * the same length by the owner's decision, not because it must.
 */
export const SECTION_WINDOW_DAYS = VERIFIED_WINDOW_DAYS;

/** Render order. `special` and `rest` carry no heading. */
export const SECTIONS = [
    { key: 'special', label: null },
    { key: 'new', label: 'New' },
    { key: 'updated', label: 'Updated' },
    { key: 'featured', label: 'Featured' },
    { key: 'verified', label: 'Verified' },
    { key: 'rest', label: null },
];

/**
 * The date a record's "new" window starts: the later of when it was created
 * and its first night (`activePeriod.start`). Either alone is enough; neither
 * means the record can never read as new — no backfill (ADR-015, ADR-016).
 *
 * An entry carrying `changed` (#329) is a changed show, not a new one: a
 * Split's new entry starts on the change date, and that start is the change,
 * not a first night. So its `activePeriod.start` is ignored here and only its
 * own `created` can make it New (#335) — otherwise it goes to Updated.
 * @param {Object} record - A venue or a schedule entry
 * @returns {string|null} YYYY-MM-DD
 */
export function newSince(record) {
    const start = record?.changed ? null : record?.activePeriod?.start;
    const dates = [record?.created, start].filter(Boolean);
    if (dates.length === 0) return null;
    return dates.sort().at(-1);
}

/**
 * Inside a rolling window counted back from `asOf`. A date still ahead counts:
 * a first night or a confirmed night that hasn't arrived is the newest kind.
 * @param {string|null} iso
 * @param {Date} asOf
 * @returns {boolean}
 */
function withinWindow(iso, asOf) {
    return !!iso && daysSince(iso, asOf) < SECTION_WINDOW_DAYS;
}

/**
 * New: the show is new, or its venue is. A new show at an established venue
 * qualifies on its own, and only that show's rows do.
 * @param {Object} venue
 * @param {Object} entry
 * @param {Date} [asOf]
 * @returns {boolean}
 */
export function isNewShow(venue, entry, asOf = startOfToday()) {
    return withinWindow(newSince(entry), asOf) || withinWindow(newSince(venue), asOf);
}

/**
 * Updated (#335): an existing show's details changed inside the window — any
 * detail change to a show that isn't new, a Split or a correction (owner
 * decision, 2026-10-15). `changed` (#329) records when.
 * @param {Object} entry
 * @param {Date} [asOf]
 * @returns {boolean}
 */
export function isUpdatedShow(entry, asOf = startOfToday()) {
    return withinWindow(entry?.changed, asOf);
}

/**
 * Verified: the night the latest evidence confirms (ADR-015) is inside the
 * window. An announcement for a night still ahead always counts.
 * @param {Object} entry
 * @param {Date} [asOf]
 * @returns {boolean}
 */
export function isVerifiedShow(entry, asOf = startOfToday()) {
    return withinWindow(entry?.lastVerified, asOf);
}

/**
 * Featured on this night: the schedule entry's `featured` (#322) is `true`,
 * or a placement window `{start?, end?}` — inclusive, either bound open —
 * that covers the card's date.
 * @param {Object} venue - Unused today; kept so every predicate has the
 *   same (venue, entry, …) shape
 * @param {Object} entry
 * @param {Date} date - The card's own date
 * @returns {boolean}
 */
export function isFeaturedShow(venue, entry, date) {
    const f = entry?.featured;
    if (f === true) return true;
    if (!f || typeof f !== 'object') return false;
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    if (f.start && day < parseLocalDate(f.start)) return false;
    if (f.end && day > parseLocalDate(f.end)) return false;
    return true;
}

/**
 * Which section one show belongs in — the first it qualifies for.
 * @param {Object} venue
 * @param {Object} entry
 * @param {Object} options
 * @param {Date} options.date - The card's date (for Featured)
 * @param {Date} [options.asOf] - Today (for New and Verified)
 * @returns {'special'|'new'|'updated'|'featured'|'verified'|'rest'}
 */
export function sectionOf(venue, entry, { date, asOf = startOfToday() }) {
    if (entry?.frequency === 'once') return 'special';
    if (isNewShow(venue, entry, asOf)) return 'new';
    if (isUpdatedShow(entry, asOf)) return 'updated';
    if (isFeaturedShow(venue, entry, date)) return 'featured';
    if (isVerifiedShow(entry, asOf)) return 'verified';
    return 'rest';
}

/**
 * Group a day's shows into sections, in render order, dropping empty ones.
 * @param {Array<{venue: Object, schedule: Object}>} events - Already sorted
 * @param {Object} options - As for sectionOf
 * @returns {Array<{key: string, label: string|null, events: Array}>}
 */
export function groupShows(events, options) {
    const buckets = new Map(SECTIONS.map(s => [s.key, []]));
    for (const event of events) {
        buckets.get(sectionOf(event.venue, event.schedule, options)).push(event);
    }
    return SECTIONS
        .map(s => ({ ...s, events: buckets.get(s.key) }))
        .filter(s => s.events.length > 0);
}
