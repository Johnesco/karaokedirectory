/**
 * Unit tests for scripts/check-curator-drift.js (#277).
 *
 * The script is a CLI with side effects (it reads two files and exits), so
 * these spawn it against temp fixtures rather than importing it.
 *
 * What is being pinned is the difference the three-way base makes. Without a
 * base the check cannot tell "I edited this" from "someone else edited this",
 * so it calls every difference fatal — which made ORDINARY EDITING block a
 * publish. With a base it only shouts about values that changed underneath us.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'scripts', 'check-curator-drift.js');

const venue = (over = {}) => ({
  id: 'bar-one', name: 'Bar One', address: { street: '1 Main St', city: 'Austin', state: 'TX', zip: '78701' },
  schedule: [{ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00' }],
  ...over,
});
const doc = (listings) => ({ tagDefinitions: {}, cities: {}, kjs: {}, companies: {}, listings });

/** Write repo / master / optional base into a temp dir and run the script. */
function run({ repo, master, base }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-drift-'));
  const repoFile = path.join(dir, 'data.json');
  const masterFile = path.join(dir, 'data-curated.js');
  fs.writeFileSync(repoFile, JSON.stringify(repo, null, 2));
  fs.writeFileSync(masterFile, 'window.curatorData = ' + JSON.stringify(master, null, 2) + ';\n');
  const env = { ...process.env, REPO_DATA: repoFile };
  if (base) {
    const baseFile = path.join(dir, 'last-published.json');
    fs.writeFileSync(baseFile, JSON.stringify(base, null, 2));
    env.CURATOR_BASE = baseFile;
  } else {
    env.CURATOR_BASE = path.join(dir, 'no-such-base.json');
  }
  const r = spawnSync(process.execPath, [SCRIPT, masterFile], { encoding: 'utf8', env });
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

describe('check-curator-drift — strict mode (no record of a previous publish)', () => {
  it('passes when the two agree', () => {
    const d = doc([venue()]);
    const r = run({ repo: d, master: JSON.parse(JSON.stringify(d)) });
    assert.equal(r.status, 0);
    assert.match(r.out, /strict/);
    assert.match(r.out, /Safe to export/);
  });

  it('calls an ordinary venue edit fatal — the behaviour that blocked publishing', () => {
    const r = run({ repo: doc([venue()]), master: doc([venue({ name: 'Bar One Cantina' })]) });
    assert.equal(r.status, 1);
    assert.match(r.out, /WOULD DESTROY/);
    assert.match(r.out, /Bar One Cantina/);
  });

  it('calls an edited show fatal too, since an entry has no id to match on', () => {
    const edited = venue();
    edited.schedule = [{ frequency: 'every', day: 'Friday', startTime: '22:00', endTime: '01:00' }];
    const r = run({ repo: doc([venue()]), master: doc([edited]) });
    assert.equal(r.status, 1);
    assert.match(r.out, /schedule entry missing from master/);
  });

  it('always treats a confirmation as pending, never as a loss', () => {
    const confirmed = venue();
    confirmed.schedule = [{ ...confirmed.schedule[0], lastVerified: '2026-10-02' }];
    const r = run({ repo: doc([venue()]), master: doc([confirmed]) });
    assert.equal(r.status, 0);
    assert.match(r.out, /confirmed for 2026-10-02 in master, not yet exported/);
  });
});

describe('check-curator-drift — three-way mode', () => {
  it('reports our own venue edit as pending, not as content at risk', () => {
    const published = doc([venue()]);
    const r = run({ repo: published, master: doc([venue({ name: 'Bar One Cantina' })]), base: published });
    assert.equal(r.status, 0);
    assert.match(r.out, /three-way/);
    assert.match(r.out, /edited since our last publish/);
    assert.doesNotMatch(r.out, /WOULD DESTROY/);
  });

  it('reports our own show edit as pending', () => {
    const published = doc([venue()]);
    const edited = venue();
    edited.schedule = [{ frequency: 'every', day: 'Friday', startTime: '22:00', endTime: '01:00' }];
    const r = run({ repo: published, master: doc([edited]), base: published });
    assert.equal(r.status, 0);
    assert.match(r.out, /schedule entry edited or removed in master/);
  });

  it('reports our own venue deletion as pending', () => {
    const published = doc([venue(), venue({ id: 'bar-two', name: 'Bar Two' })]);
    const r = run({ repo: published, master: doc([venue()]), base: published });
    assert.equal(r.status, 0);
    assert.match(r.out, /removed in master/);
  });

  it('lets us correct a date backwards — fixing a stamp that named the wrong night', () => {
    // Strict mode calls an earlier master date "export would revert it". But a
    // curator correcting a mis-stamped night is exactly that shape, and it is
    // not destroying anything: the repo still holds what we published.
    const published = doc([venue({ schedule: [{ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00', lastVerified: '2026-09-10' }] })]);
    const corrected = doc([venue({ schedule: [{ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00', lastVerified: '2026-09-04' }] })]);
    const strict = run({ repo: published, master: corrected });
    assert.equal(strict.status, 1, 'strict mode treats a backwards correction as a loss');

    const threeWay = run({ repo: published, master: corrected, base: published });
    assert.equal(threeWay.status, 0);
    assert.match(threeWay.out, /changed in master, 2026-09-10 → 2026-09-04/);
  });

  it('STILL fails when someone else changed the live file after our publish', () => {
    // base and master agree; the repo has moved on underneath us.
    const published = doc([venue()]);
    const r = run({ repo: doc([venue({ phone: '512-555-0199' })]), master: doc([venue()]), base: published });
    assert.equal(r.status, 1);
    assert.match(r.out, /WOULD DESTROY/);
    assert.match(r.out, /phone/);
  });

  it('STILL fails when someone else added a venue we never published', () => {
    const published = doc([venue()]);
    const r = run({ repo: doc([venue(), venue({ id: 'bar-three', name: 'Bar Three' })]), master: doc([venue()]), base: published });
    assert.equal(r.status, 1);
    assert.match(r.out, /bar-three/);
  });

  it('ignores an unreadable base rather than refusing to run', () => {
    const d = doc([venue()]);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-drift-'));
    const repoFile = path.join(dir, 'data.json');
    const masterFile = path.join(dir, 'data-curated.js');
    const baseFile = path.join(dir, 'last-published.json');
    fs.writeFileSync(repoFile, JSON.stringify(d));
    fs.writeFileSync(masterFile, 'window.curatorData = ' + JSON.stringify(d) + ';\n');
    fs.writeFileSync(baseFile, 'not json at all');
    const r = spawnSync(process.execPath, [SCRIPT, masterFile], {
      encoding: 'utf8',
      env: { ...process.env, REPO_DATA: repoFile, CURATOR_BASE: baseFile },
    });
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
    assert.equal(r.status, 0);
    assert.match(r.stdout + r.stderr, /ignoring unreadable/);
    assert.match(r.stdout, /strict/);
  });
});
