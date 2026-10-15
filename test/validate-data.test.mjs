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

describe('validate-data: changed', () => {
    it('accepts a change on the first night (a Split) and a later correction', () => {
        const split = validate((_, { entry }) => { entry.changed = '2026-11-06'; entry.activePeriod = { start: '2026-11-06' }; });
        assert.equal(split.code, 0, split.out);
        assert.doesNotMatch(split.out, /cannot change before it starts/);
        const corrected = validate((_, { entry }) => { entry.changed = '2026-12-01'; entry.activePeriod = { start: '2026-11-06' }; });
        assert.doesNotMatch(corrected.out, /cannot change before it starts/);
        const noStart = validate((_, { entry }) => { entry.changed = '2026-10-15'; delete entry.activePeriod; });
        assert.equal(noStart.code, 0, noStart.out);
        assert.doesNotMatch(noStart.out, /cannot change before it starts/);
    });
    it('warns when a show changed before its first night', () => {
        const r = validate((_, { entry }) => { entry.changed = '2026-11-01'; entry.activePeriod = { start: '2026-11-06' }; });
        assert.equal(r.code, 0, r.out);
        assert.match(r.out, /changed 2026-11-01, before its first night 2026-11-06/);
    });
    it('fails a malformed date, and changed on a one-time event', () => {
        assert.equal(validate((_, { entry }) => { entry.changed = 'Nov 6'; }).code, 1);
        const once = { frequency: 'once', date: '2026-12-31', startTime: '21:00', changed: '2026-12-31' };
        assert.equal(validate((_, { venue }) => { venue.schedule.push(once); }).code, 1);
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
