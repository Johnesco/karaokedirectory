/**
 * Validator cases for `created` and `featured` (#322, ADR-017).
 *
 * scripts/validate-data.js is a CLI, not a module, so these run it against a
 * mutated copy of the real js/data.json in a temp directory and read its exit
 * code and output — the same contract CI relies on.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'validate-data.js');
const REAL = JSON.parse(readFileSync(path.join(ROOT, 'js', 'data.json'), 'utf8'));

/** Run the validator on a mutated copy. `mutate(data, refs)` edits in place. */
function validate(mutate) {
    const data = structuredClone(REAL);
    const venue = data.listings.find(v => v.active !== false && v.schedule.some(s => s.frequency === 'every'));
    const entry = venue.schedule.find(s => s.frequency === 'every');
    mutate(data, { venue, entry });
    const dir = mkdtempSync(path.join(tmpdir(), 'kd-validate-'));
    const file = path.join(dir, 'data.json');
    writeFileSync(file, JSON.stringify(data));
    try {
        const r = spawnSync(process.execPath, [SCRIPT, file], { encoding: 'utf8' });
        return { code: r.status, out: r.stdout + r.stderr };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const PAST = '2020-01-01';

describe('validate-data: created', () => {
    it('accepts the real data', () => {
        assert.equal(validate(() => {}).code, 0);
    });
    it('accepts created on a venue and on a show', () => {
        const r = validate((_, { venue, entry }) => { venue.created = '2026-10-01'; entry.created = '2026-10-02'; });
        assert.equal(r.code, 0, r.out);
    });
    it('fails a malformed created', () => {
        assert.equal(validate((_, { entry }) => { entry.created = '10/02/2026'; }).code, 1);
    });
    it('warns when a show was created after its last night', () => {
        const r = validate((_, { entry }) => { entry.created = '2026-10-02'; entry.activePeriod = { end: '2026-10-01' }; });
        assert.equal(r.code, 0, r.out);
        assert.match(r.out, /was created 2026-10-02, after its activePeriod ends 2026-10-01/);
    });
});

describe('validate-data: featured', () => {
    it('accepts true and an open-ended window', () => {
        assert.equal(validate((_, { entry }) => { entry.featured = true; }).code, 0);
        assert.equal(validate((_, { entry }) => { entry.featured = { start: '2026-10-01' }; }).code, 0);
    });
    it('fails an empty window, false, and unknown keys', () => {
        assert.equal(validate((_, { entry }) => { entry.featured = {}; }).code, 1);
        assert.equal(validate((_, { entry }) => { entry.featured = false; }).code, 1);
        assert.equal(validate((_, { entry }) => { entry.featured = { from: '2026-10-01' }; }).code, 1);
    });
    it('fails a window that ends before it starts', () => {
        const r = validate((_, { entry }) => { entry.featured = { start: '2026-10-20', end: '2026-10-10' }; });
        assert.equal(r.code, 1);
        assert.match(r.out, /featured starts 2026-10-20, after it ends 2026-10-10/);
    });
    it('fails featured on a one-time event', () => {
        const once = { frequency: 'once', date: '2026-12-31', startTime: '21:00' };
        // Control: the same event without the flag is valid, so the failure below is the flag's.
        assert.equal(validate((_, { venue }) => { venue.schedule.push({ ...once }); }).code, 0);
        assert.equal(validate((_, { venue }) => { venue.schedule.push({ ...once, featured: true }); }).code, 1);
    });
    it('warns on a placement that has ended', () => {
        const r = validate((_, { entry }) => { entry.featured = { end: PAST }; });
        assert.equal(r.code, 0, r.out);
        assert.match(r.out, /featured placement ended 2020-01-01/);
    });
});

describe('validate-data: one verification clock (#330)', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    /** The most recent date `daysBack` or more days ago that falls on `day`. */
    const nightAtLeast = (day, daysBack) => {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - daysBack);
        while (WEEKDAYS[d.getDay()] !== day) d.setDate(d.getDate() - 1);
        return d;
    };
    const ago = (d) => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((t - d) / 86400000); };

    it('mirrors VERIFIED_WINDOW_DAYS from js/utils/date.js', async () => {
        const { VERIFIED_WINDOW_DAYS } = await import('../js/utils/date.js');
        const src = readFileSync(SCRIPT, 'utf8');
        const m = src.match(/const STALE_VERIFIED_DAYS = (\d+);/);
        assert.ok(m, 'STALE_VERIFIED_DAYS not found in validate-data.js');
        assert.equal(Number(m[1]), VERIFIED_WINDOW_DAYS);
    });

    it('warns at 30 days or more, not before', () => {
        const STALE = /no longer in the site's Verified section/;
        // A night of this show's weekday inside the window (23–29 days back)…
        const day = WEEKDAYS[0];
        const inside = (() => { for (let b = 23; b <= 29; b++) { const d = nightAtLeast(day, b); if (ago(d) <= 29) return d; } })();
        // …and one at 30 or more days back.
        const outside = nightAtLeast(day, 30);
        const r1 = validate((_, { entry }) => {
            entry.day = day; delete entry.activePeriod; delete entry.exclusions; entry.lastVerified = iso(inside);
        });
        const r2 = validate((_, { entry }) => {
            entry.day = day; delete entry.activePeriod; delete entry.exclusions; entry.lastVerified = iso(outside);
        });
        assert.ok(ago(inside) < 30 && ago(outside) >= 30);
        assert.doesNotMatch(r1.out.split('\n').filter(l => l.includes(iso(inside))).join('\n'), STALE);
        assert.match(r2.out, STALE);
    });
});
