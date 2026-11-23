/**
 * Plain-text printout of one night's shows (#463).
 *
 * `?print=<day>` turns the page into a text listing ready to paste into a
 * social media post. This module is the pure half: reading the `<day>` value
 * and writing the text. app.js does the DOM.
 *
 * The listing follows the calendar's own rules, so the post and the site never
 * disagree: the shows come from getVenueEventsForDate() (specials first, then
 * alphabetical — Display Philosophy #1), minus what the card for that night
 * would mark as not happening: a night off (exclusion) or an "Ended" banner.
 * The New / Updated / Featured / Verified sections are deliberately not
 * carried over: they are on-site groupings, not something a post needs.
 */

import {
    formatTimeRange,
    getScheduleExclusion,
    isEndedOn,
    startOfToday,
} from './date.js';
import { resolveHostFor, formatHostDisplay } from './render.js';

/** The words `?print=` accepts, as day offsets from today. */
const RELATIVE_DAYS = { yesterday: -1, today: 0, tomorrow: 1 };

/** Shown when `?print=` carries something it cannot read. */
export const PRINT_FORMAT_HINT =
    'Use ?print=today, ?print=yesterday, ?print=tomorrow, or an 8-digit date as MMDDYYYY (e.g. ?print=11272026).';

/** Where the post sends readers for the rest. */
export const SITE_URL = 'https://karaokedirectory.com';

/**
 * Read a `?print=` value into a date.
 *
 * `today` / `yesterday` / `tomorrow` (any case) count from `today`. Eight
 * digits are MMDDYYYY and must be a real calendar date: `02302026` is refused
 * rather than rolled over into March, which is what `new Date()` would do.
 *
 * @param {string|null|undefined} value - The raw query value
 * @param {Date} [today] - The date "today" means (local midnight)
 * @returns {Date|null} Local midnight on that date, or null when unreadable
 */
export function parsePrintDate(value, today = startOfToday()) {
    const v = String(value ?? '').trim().toLowerCase();

    if (v in RELATIVE_DAYS) {
        const d = new Date(today);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + RELATIVE_DAYS[v]);
        return d;
    }

    const m = /^(\d{2})(\d{2})(\d{4})$/.exec(v);
    if (!m) return null;

    const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(year, month - 1, day);
    // Reject anything the Date constructor had to roll over (month 13, Feb 30).
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
}

/**
 * The shows that actually run on a night: drops nights off and Ended cards.
 * @param {Array<{venue: Object, schedule: Object}>} events - From getVenueEventsForDate
 * @param {Date} date
 * @param {Date} [asOf] - Today, for the Ended check
 * @returns {Array<{venue: Object, schedule: Object}>}
 */
export function printableShows(events, date, asOf = startOfToday()) {
    return events.filter(({ venue, schedule }) =>
        !getScheduleExclusion(schedule, date)
        && !isEndedOn(schedule, venue.schedule, date, asOf)
    );
}

/**
 * One show as one line:
 *   `• Venue — 9:00 PM - 1:00 AM, Round Rock · KJ Name (Company)`
 * A special leads with its name: `★ Event Name at Venue — …`.
 * @param {{venue: Object, schedule: Object}} show
 * @returns {string}
 */
export function formatShowLine({ venue, schedule }) {
    const special = schedule.frequency === 'once';
    const what = special
        ? `★ ${schedule.eventName || 'Special Event'} at ${venue.name}`
        : `• ${venue.name}`;

    let line = `${what} — ${formatTimeRange(schedule.startTime, schedule.endTime)}`;
    const city = venue.address?.city;
    if (city) line += `, ${city}`;

    const host = formatHostDisplay(resolveHostFor(venue, schedule));
    if (host) line += ` · ${host}`;
    if (schedule.ticketed) line += ' (ticketed)';
    return line;
}

/**
 * The whole post for one night.
 * @param {Array<{venue: Object, schedule: Object}>} shows - Already filtered (printableShows)
 * @param {Date} date
 * @returns {string}
 */
export function formatPrintout(shows, date) {
    const heading = `Karaoke in Austin — ${date.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })}`;

    if (shows.length === 0) {
        return [heading, '', 'No karaoke listed for this night.', '', `Full schedule: ${SITE_URL}`].join('\n');
    }

    const specials = shows.filter(s => s.schedule.frequency === 'once');
    const regulars = shows.filter(s => s.schedule.frequency !== 'once');

    const lines = [heading, ''];
    if (specials.length) {
        lines.push(...specials.map(formatShowLine));
        if (regulars.length) lines.push('');
    }
    lines.push(...regulars.map(formatShowLine));
    lines.push(
        '',
        `${shows.length} show${shows.length === 1 ? '' : 's'}. Times change, so check with the venue before you go.`,
        `Full schedule: ${SITE_URL}`,
    );
    return lines.join('\n');
}
