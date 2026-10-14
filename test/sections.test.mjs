/**
 * Unit tests for day-card sections (spike #320 prototype, js/utils/sections.js).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    newSince, isNewShow, isVerifiedShow, isFeaturedShow, sectionOf, groupShows,
    initSectionsLens, SECTION_WINDOW_DAYS,
} from '../js/utils/sections.js';

const TODAY = new Date(2026, 9, 12); // Mon Oct 12, 2026
const show = (over = {}) => ({ frequency: 'every', day: 'Monday', startTime: '21:00', ...over });
const venue = (over = {}) => ({ id: 'v', name: 'V', schedule: [], ...over });

beforeEach(() => initSectionsLens(true, []));

describe('newSince', () => {
    it('is null when neither date is recorded', () => {
        assert.equal(newSince(show()), null);
    });
    it('takes whichever date exists', () => {
        assert.equal(newSince(show({ created: '2026-10-01' })), '2026-10-01');
        assert.equal(newSince(show({ activePeriod: { start: '2026-10-05' } })), '2026-10-05');
    });
    it('takes the later of created and first night', () => {
        assert.equal(newSince(show({ created: '2026-10-01', activePeriod: { start: '2026-10-20' } })), '2026-10-20');
        assert.equal(newSince(show({ created: '2026-10-09', activePeriod: { start: '2026-09-01' } })), '2026-10-09');
    });
});

describe('isNewShow', () => {
    it('counts a show inside the rolling 30 days, from today', () => {
        assert.equal(isNewShow(venue(), show({ created: '2026-09-13' }), TODAY), true);  // 29 days
        assert.equal(isNewShow(venue(), show({ created: '2026-09-12' }), TODAY), false); // 30 days
        assert.equal(SECTION_WINDOW_DAYS, 30);
    });
    it('counts a first night still ahead', () => {
        assert.equal(isNewShow(venue(), show({ activePeriod: { start: '2026-11-02' } }), TODAY), true);
    });
    it('a new venue makes its shows new', () => {
        assert.equal(isNewShow(venue({ created: '2026-10-10' }), show(), TODAY), true);
    });
    it('a new show at an old venue is new on its own', () => {
        const old = venue({ created: '2024-01-01' });
        assert.equal(isNewShow(old, show({ created: '2026-10-10' }), TODAY), true);
        assert.equal(isNewShow(old, show(), TODAY), false);
    });
    it('an undated show is never new', () => {
        assert.equal(isNewShow(venue(), show(), TODAY), false);
    });
});

describe('isVerifiedShow', () => {
    it('counts a confirmation inside the window, and one still ahead', () => {
        assert.equal(isVerifiedShow(show({ lastVerified: '2026-09-13' }), TODAY), true);
        assert.equal(isVerifiedShow(show({ lastVerified: '2026-10-30' }), TODAY), true);
    });
    it('drops a confirmation 30 or more days old, and an absent one', () => {
        assert.equal(isVerifiedShow(show({ lastVerified: '2026-09-12' }), TODAY), false);
        assert.equal(isVerifiedShow(show(), TODAY), false);
    });
});

describe('isFeaturedShow', () => {
    const night = new Date(2026, 9, 19);
    it('honours a placement window, inclusive, against the card date', () => {
        assert.equal(isFeaturedShow(venue(), show({ featured: { start: '2026-10-19', end: '2026-10-19' } }), night), true);
        assert.equal(isFeaturedShow(venue(), show({ featured: { start: '2026-10-20' } }), night), false);
        assert.equal(isFeaturedShow(venue(), show({ featured: { end: '2026-10-18' } }), night), false);
    });
    it('honours the prototype venue-id list', () => {
        initSectionsLens(true, ['v']);
        assert.equal(isFeaturedShow(venue(), show(), night), true);
    });
});

describe('sectionOf', () => {
    const opts = { date: TODAY, asOf: TODAY };
    it('pins specials above everything, even when new', () => {
        assert.equal(sectionOf(venue({ created: '2026-10-10' }), show({ frequency: 'once', date: '2026-10-12' }), opts), 'special');
    });
    it('puts a show in the first section it qualifies for', () => {
        const all = show({ created: '2026-10-10', featured: true, lastVerified: '2026-10-12' });
        assert.equal(sectionOf(venue(), all, opts), 'new');
        assert.equal(sectionOf(venue(), show({ featured: true, lastVerified: '2026-10-12' }), opts), 'featured');
        assert.equal(sectionOf(venue(), show({ lastVerified: '2026-10-12' }), opts), 'verified');
        assert.equal(sectionOf(venue(), show(), opts), 'rest');
    });
});

describe('groupShows', () => {
    it('keeps input order inside a section and drops empty sections', () => {
        const ev = (name, s) => ({ venue: venue({ id: name, name }), schedule: s });
        const groups = groupShows([
            ev('A', show()),
            ev('B', show({ lastVerified: '2026-10-12' })),
            ev('C', show()),
            ev('D', show({ frequency: 'once', date: '2026-10-12' })),
        ], { date: TODAY, asOf: TODAY });
        assert.deepEqual(groups.map(g => g.key), ['special', 'verified', 'rest']);
        assert.deepEqual(groups.find(g => g.key === 'rest').events.map(e => e.venue.name), ['A', 'C']);
        assert.deepEqual(groups.map(g => g.label), [null, 'Verified', null]);
    });
});
