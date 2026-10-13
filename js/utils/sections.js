/**
 * Day-card sections — `?sections=1` (spike #320).
 *
 * PROTOTYPE. Groups one day's shows into sections instead of one flat list:
 *
 *   (specials)  `frequency: "once"` — pinned on top, as today; no heading
 *   New         the show or its venue is new within the last 30 days
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
 * Same shape as the freshness lens: a flag set once at boot from the router,
 * and pure helpers that take their reference date as an argument.
 */

import { daysSince, parseLocalDate, startOfToday } from './date.js';

/** Both windows — New and Verified — are a rolling 30 days. */
export const SECTION_WINDOW_DAYS = 30;

/** Render order. `special` and `rest` carry no heading. */
export const SECTIONS = [
    { key: 'special', label: null },
    { key: 'new', label: 'New' },
    { key: 'featured', label: 'Featured' },
    { key: 'verified', label: 'Verified' },
    { key: 'rest', label: null },
];

let lensOn = false;
let featuredIds = new Set();

/**
 * Turn sections on or off. Takes plain values rather than reading the URL —
 * the router owns the URL (`readLocation().sections` / `.featured`).
 *
 * `featured` is a prototype-only stand-in for the schema field the spike
 * proposes (`featured: {start, end}` on a schedule entry): a list of venue ids
 * whose shows are treated as featured, so the section can be seen before any
 * data carries the flag.
 *
 * @param {boolean} enabled
 * @param {string[]} [featured] - Venue ids to feature (prototype only)
 * @returns {boolean} the resulting state
 */
export function initSectionsLens(enabled, featured = []) {
    lensOn = !!enabled;
    featuredIds = new Set(featured);
    return lensOn;
}

/** @returns {boolean} */
export function isSectionsLens() {
    return lensOn;
}

/**
 * The date a record's "new" window starts: the later of when it was created
 * and its first night (`activePeriod.start`). Either alone is enough; neither
 * means the record can never read as new — no backfill (ADR-015, ADR-016).
 * @param {Object} record - A venue or a schedule entry
 * @returns {string|null} YYYY-MM-DD
 */
export function newSince(record) {
    const dates = [record?.created, record?.activePeriod?.start].filter(Boolean);
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
 * Featured on this night. The proposed field is `featured: {start?, end?}` on
 * the schedule entry — a placement window, inclusive, either bound open — or
 * `true`. The prototype also honours the `?featured=` venue-id list.
 * @param {Object} venue
 * @param {Object} entry
 * @param {Date} date - The card's own date
 * @returns {boolean}
 */
export function isFeaturedShow(venue, entry, date) {
    if (featuredIds.has(venue?.id)) return true;
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
 * @returns {'special'|'new'|'featured'|'verified'|'rest'}
 */
export function sectionOf(venue, entry, { date, asOf = startOfToday() }) {
    if (entry?.frequency === 'once') return 'special';
    if (isNewShow(venue, entry, asOf)) return 'new';
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
