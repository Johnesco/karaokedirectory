/**
 * Unit tests for js/utils/print.js — the ?print= plain-text printout (#463).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    parsePrintDate,
    printableShows,
    formatShowLine,
    formatPrintout,
    SITE_URL,
} from '../js/utils/print.js';

const TODAY = new Date(2026, 10, 22); // Sunday, November 22, 2026
const iso = (d) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('parsePrintDate', () => {
    it('reads today, yesterday and tomorrow, in any case', () => {
        assert.equal(iso(parsePrintDate('today', TODAY)), '2026-11-22');
        assert.equal(iso(parsePrintDate('Yesterday', TODAY)), '2026-11-21');
        assert.equal(iso(parsePrintDate('TOMORROW', TODAY)), '2026-11-23');
    });

    it('crosses month and year boundaries', () => {
        assert.equal(iso(parsePrintDate('tomorrow', new Date(2026, 11, 31))), '2027-1-1');
        assert.equal(iso(parsePrintDate('yesterday', new Date(2026, 2, 1))), '2026-2-28');
    });

    it('reads 8 digits as MMDDYYYY at local midnight', () => {
        const d = parsePrintDate('11272026', TODAY);
        assert.equal(iso(d), '2026-11-27');
        assert.equal(d.getHours(), 0);
        assert.equal(iso(parsePrintDate('02292028', TODAY)), '2028-2-29'); // leap year
    });

    it('refuses dates the calendar does not have, rather than rolling them over', () => {
        assert.equal(parsePrintDate('02302026', TODAY), null);
        assert.equal(parsePrintDate('13012026', TODAY), null);
        assert.equal(parsePrintDate('00102026', TODAY), null);
        assert.equal(parsePrintDate('02292026', TODAY), null); // not a leap year
    });

    it('refuses anything else', () => {
        for (const bad of [null, undefined, '', 'now', '1127026', '112720261', '2026-11-27', '11/27/2026', 'next friday']) {
            assert.equal(parsePrintDate(bad, TODAY), null, String(bad));
        }
    });

    it('does not move the today it is given', () => {
        const today = new Date(TODAY);
        parsePrintDate('tomorrow', today);
        assert.equal(iso(today), '2026-11-22');
    });
});

const venue = (over = {}) => ({
    id: 'v', name: 'The Venue', address: { city: 'Austin' }, schedule: [], ...over,
});

describe('formatShowLine', () => {
    it('writes venue, time and city for a recurring show', () => {
        const v = venue();
        const s = { frequency: 'every', day: 'Sunday', startTime: '21:00', endTime: '01:00' };
        assert.equal(formatShowLine({ venue: v, schedule: s }), '• The Venue — 9:00 PM - 1:00 AM, Austin');
    });

    it('adds the host — a per-show host replaces the venue one', () => {
        const v = venue({ host: { name: 'KJ Venue', affiliation: 'Co' } });
        const plain = { frequency: 'every', day: 'Sunday', startTime: '21:00', endTime: null };
        const own = { ...plain, host: { name: 'KJ Guest' } };
        assert.equal(formatShowLine({ venue: v, schedule: plain }), '• The Venue — 9:00 PM - Close, Austin · KJ Venue (Co)');
        assert.equal(formatShowLine({ venue: v, schedule: own }), '• The Venue — 9:00 PM - Close, Austin · KJ Guest');
    });

    it('leads a special with its name and says when it is ticketed', () => {
        const s = { frequency: 'once', date: '2026-11-22', startTime: '20:00', endTime: '23:00', eventName: 'Big Night', ticketed: true };
        assert.equal(formatShowLine({ venue: venue(), schedule: s }), '★ Big Night at The Venue — 8:00 PM - 11:00 PM, Austin (ticketed)');
    });
});

describe('printableShows', () => {
    const date = new Date(2026, 10, 22);

    it('drops a night off', () => {
        const s = { frequency: 'every', day: 'Sunday', startTime: '21:00', exclusions: [{ date: '2026-11-22' }] };
        const v = venue({ schedule: [s] });
        assert.deepEqual(printableShows([{ venue: v, schedule: s }], date, TODAY), []);
    });

    it('drops a show bannered Ended that night, keeps a live one', () => {
        const ended = { frequency: 'every', day: 'Sunday', startTime: '21:00', activePeriod: { end: '2026-11-15' } };
        const live = { frequency: 'every', day: 'Sunday', startTime: '20:00' };
        const v = venue({ schedule: [ended, live] });
        const out = printableShows([{ venue: v, schedule: ended }, { venue: v, schedule: live }], date, TODAY);
        assert.deepEqual(out.map(e => e.schedule), [live]);
    });
});

describe('formatPrintout', () => {
    const date = new Date(2026, 10, 22);

    it('puts the heading, specials, then the rest, then the count and the link', () => {
        const special = { venue: venue({ name: 'Zed' }), schedule: { frequency: 'once', startTime: '20:00', endTime: '23:00', eventName: 'Gala' } };
        const a = { venue: venue({ name: 'Alpha' }), schedule: { frequency: 'every', startTime: '21:00', endTime: '00:00' } };
        const lines = formatPrintout([special, a], date).split('\n');
        assert.equal(lines[0], 'Karaoke in Austin — Sunday, November 22, 2026');
        assert.equal(lines[1], '');
        assert.match(lines[2], /^★ Gala at Zed/);
        assert.equal(lines[3], '');
        assert.match(lines[4], /^• Alpha/);
        assert.match(lines.at(-2), /^2 shows\./);
        assert.equal(lines.at(-1), `Full schedule: ${SITE_URL}`);
    });

    it('says so when nothing is on', () => {
        const text = formatPrintout([], date);
        assert.match(text, /No karaoke listed for this night\./);
        assert.ok(text.endsWith(SITE_URL));
    });

    it('counts one show in the singular', () => {
        const a = { venue: venue(), schedule: { frequency: 'every', startTime: '21:00' } };
        assert.match(formatPrintout([a], date), /\n1 show\. /);
    });
});
