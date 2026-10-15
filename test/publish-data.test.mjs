/**
 * Unit tests for the pure half of scripts/publish-data.js (#277).
 *
 * The script's IO half — gh, the API calls, the branch — is exercised by a
 * real dry run rather than mocked here. What is worth pinning is the part that
 * decides what the pull request SAYS, because that is what the owner reads
 * before merging: a publish that quietly removed a venue must say so.
 *
 * CommonJS module, so it loads through createRequire rather than import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { summarizeDiff, matchShows, prTitle, prBody, branchName, parseArgs, mainGuard } = require('../scripts/publish-data.js');

const show = (over = {}) => ({ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00', ...over });
const venue = (id, over = {}) => ({ id, name: over.name || id, schedule: [show()], ...over });
const data = (...listings) => ({ listings });

const EMPTY = { confirmed: [], changed: [], added: [], ended: [], removed: [], edited: [] };
const reg = { kjs: { 'kj-a': { name: 'KJ Ann' }, 'kj-b': { name: 'KJ Bo' } }, companies: {} };

describe('summarizeDiff (#334 groups)', () => {
  it('sees nothing in an unchanged file', () => {
    const d = data(venue('a'), venue('b'));
    assert.deepEqual(summarizeDiff(d, JSON.parse(JSON.stringify(d))), EMPTY);
  });

  it('a newer lastVerified is a confirmation, and nothing else', () => {
    const before = data(venue('a', { name: 'Alpha', schedule: [show({ lastVerified: '2026-10-02' })] }));
    const after = data(venue('a', { name: 'Alpha', schedule: [show({ lastVerified: '2026-10-09' })] }));
    const sum = summarizeDiff(before, after);
    assert.deepEqual(sum.confirmed, ['Alpha, Every Friday 9 PM → Oct 9']);
    assert.deepEqual({ ...sum, confirmed: [] }, EMPTY);
  });

  it('a Split is one change, described old → new from its date, and the old show is not "ended"', () => {
    const before = data(venue('h', { name: 'Hudson Tavern', schedule: [show()] }));
    const after = data(venue('h', { name: 'Hudson Tavern', schedule: [
      show({ activePeriod: { end: '2026-11-05' } }),
      show({ day: 'Thursday', activePeriod: { start: '2026-11-06' }, changed: '2026-11-06' }),
    ] }));
    const sum = summarizeDiff(before, after);
    assert.equal(sum.changed.length, 1);
    assert.match(sum.changed[0], /Hudson Tavern, Every Friday 9 PM — Every Friday → Every Thursday from Nov 6/);
    // The old show's new last night is real, so it is listed as an ending too.
    assert.deepEqual(sum.ended, ['Hudson Tavern, Every Friday 9 PM — last night Nov 5']);
    assert.deepEqual(sum.added, []);
    assert.deepEqual(sum.removed, []);
  });

  it('a correction (changed moves) is a change with what changed, not an add and a remove', () => {
    const before = data(venue('a', { name: 'Alpha', schedule: [show({ host: { kjId: 'kj-a' } })] }));
    const after = data(venue('a', { name: 'Alpha', schedule: [show({ startTime: '20:00', host: { kjId: 'kj-b' }, changed: '2026-10-15' })] }), );
    Object.assign(after, reg);
    Object.assign(before, reg);
    const sum = summarizeDiff(before, after);
    assert.equal(sum.changed.length, 1);
    assert.match(sum.changed[0], /9 PM–1 AM → 8 PM–1 AM/);
    assert.match(sum.changed[0], /host KJ Ann → KJ Bo/);
    assert.deepEqual(sum.added, []);
    assert.deepEqual(sum.removed, []);
    assert.deepEqual(sum.edited, []);
  });

  it('a new show or venue with created is an addition', () => {
    const before = data(venue('a', { name: 'Alpha' }));
    const after = data(
      venue('a', { name: 'Alpha', schedule: [show(), show({ day: 'Sunday', startTime: '18:00', created: '2026-10-15' })] }),
      venue('n', { name: 'Newbar', created: '2026-10-15' }),
    );
    const sum = summarizeDiff(before, after);
    assert.deepEqual(sum.added, ['Alpha, Every Sunday 6 PM', 'Newbar (new venue, 1 show: Every Friday 9 PM)']);
    assert.deepEqual(sum.changed, []);
  });

  it('a new activePeriod.end is an ending', () => {
    const before = data(venue('a', { name: 'Alpha' }));
    const after = data(venue('a', { name: 'Alpha', schedule: [show({ activePeriod: { end: '2026-12-30' } })] }));
    const sum = summarizeDiff(before, after);
    assert.deepEqual(sum.ended, ['Alpha, Every Friday 9 PM — last night Dec 30']);
    assert.deepEqual(sum.edited, []);
  });

  it('a pruned show and a removed venue are removals; a night off is an edit', () => {
    const before = data(
      venue('a', { name: 'Alpha', schedule: [show(), show({ day: 'Monday' })] }),
      venue('z', { name: 'Zed' }),
    );
    const after = data(venue('a', { name: 'Alpha', schedule: [show({ exclusions: [{ date: '2026-10-30' }] })] }));
    const sum = summarizeDiff(before, after);
    assert.deepEqual(sum.removed, ['Alpha, Every Monday 9 PM', 'Zed (venue)']);
    assert.deepEqual(sum.edited, ['Alpha, Every Friday 9 PM — nights off']);
  });

  it('venue facts and shared registries are edits', () => {
    const before = { ...data(venue('a', { name: 'Alpha' })), kjs: {} };
    const after = { ...data(venue('a', { name: 'Alpha', address: { street: '1 Main' } })), kjs: { x: { name: 'X' } } };
    assert.deepEqual(summarizeDiff(before, after).edited, ['Alpha — address', 'kjs registry']);
  });

  it('tolerates an empty or absent listings array', () => {
    assert.deepEqual(summarizeDiff({}, {}), EMPTY);
    assert.equal(summarizeDiff({ listings: [] }, data(venue('a', { name: 'A' }))).added.length, 1);
  });
});

describe('matchShows', () => {
  it('lines up unchanged shows even when one is inserted between them', () => {
    const fri = show(), sat = show({ day: 'Saturday' }), mid = show({ day: 'Thursday', changed: '2026-11-06', activePeriod: { start: '2026-11-06' } });
    const { pairs, added, removed } = matchShows([fri, sat], [fri, mid, sat]);
    assert.equal(pairs.length, 2);
    assert.deepEqual(added, [mid]);
    assert.deepEqual(removed, []);
  });

  it('never pairs a freshly created show with an old one it replaced', () => {
    const old = show({ day: 'Monday' }), fresh = show({ day: 'Tuesday', created: '2026-10-15' });
    const { pairs, added, removed } = matchShows([old], [fresh]);
    assert.deepEqual(pairs, []);
    assert.deepEqual(added, [fresh]);
    assert.deepEqual(removed, [old]);
  });
});

describe('prTitle', () => {
  const NOW = new Date(2026, 8, 11);

  it('leads with the date and counts each group', () => {
    const t = prTitle({ ...EMPTY, confirmed: ['x', 'y'], changed: ['c'], added: ['z'], ended: ['e'] }, NOW);
    assert.equal(t, 'Curator publish 2026-09-11 — 2 confirmed, 1 changed, 1 added, 1 ended');
  });

  it('stays readable with nothing to report', () => {
    assert.equal(prTitle(EMPTY, NOW), 'Curator publish 2026-09-11');
  });
});

describe('prBody', () => {
  it('lists each group it has content for, with counts, and says why there is no ticket', () => {
    const body = prBody({ ...EMPTY, confirmed: ['Alpha, Every Friday 9 PM → Oct 2'], added: ['Gamma (new venue)'] });
    assert.match(body, /\*\*Confirmed \(1\)\*\*/);
    assert.match(body, /Alpha/);
    assert.match(body, /\*\*Added \(1\)\*\*/);
    assert.doesNotMatch(body, /Removed/);
    assert.match(body, /No ticket by design/);
  });

  it('orders the groups confirmed, changed, added, ended, removed, edited', () => {
    const body = prBody({ confirmed: ['c'], changed: ['h'], added: ['a'], ended: ['e'], removed: ['r'], edited: ['d'] });
    const at = (t) => body.indexOf(`**${t}`);
    assert.ok(at('Confirmed') < at('Changed') && at('Changed') < at('Added') && at('Added') < at('Ended') && at('Ended') < at('Removed') && at('Removed') < at('Edited'));
  });

  it('caps a very long list rather than writing a thousand bullets', () => {
    const many = Array.from({ length: 60 }, (_, i) => `venue ${i}`);
    assert.match(prBody({ ...EMPTY, added: many }), /and 20 more/);
  });
});

describe('branchName', () => {
  it('is the date, with a suffix only when one is needed', () => {
    assert.equal(branchName(new Date(2026, 8, 11)), 'data/2026-09-11');
    assert.equal(branchName(new Date(2026, 8, 11), 2), 'data/2026-09-11-2');
    assert.equal(branchName(new Date(2026, 0, 5)), 'data/2026-01-05');
  });
});

describe('parseArgs', () => {
  it('reads the flags the curator passes', () => {
    assert.deepEqual(parseArgs(['--dry-run']), { dryRun: true });
    assert.deepEqual(parseArgs(['--export', 'e.json', '--master', 'm.js']), { dryRun: false, exportFile: 'e.json', master: 'm.js' });
    assert.equal(parseArgs(['--repo', 'a/b']).repo, 'a/b');
    assert.equal(parseArgs(['--adopt-baseline']).adoptBaseline, true);
    assert.equal(parseArgs([]).adoptBaseline, undefined);
    assert.equal(parseArgs(['--no-auto-merge']).noAutoMerge, true);
    assert.equal(parseArgs([]).noAutoMerge, undefined);
  });
});

describe('mainGuard (one writer, #336)', () => {
  const data = { listings: [{ id: 'a', name: 'A' }] };
  it('passes when main is what we last published', () => {
    assert.equal(mainGuard({ base: data, main: JSON.parse(JSON.stringify(data)), inFlight: false }), 'ok');
  });
  it('has nothing to compare without a record', () => {
    assert.equal(mainGuard({ base: null, main: data, inFlight: false }), 'no-base');
  });
  it('allows a mismatch while a data PR is still merging', () => {
    assert.equal(mainGuard({ base: { listings: [] }, main: data, inFlight: true }), 'in-flight');
  });
  it('refuses when main changed outside the curator', () => {
    assert.equal(mainGuard({ base: { listings: [] }, main: data, inFlight: false }), 'refuse');
  });
});

describe('prBody', () => {
  it('no longer mentions the retired drift check', () => {
    const body = prBody({ ...EMPTY, added: ['Gamma'] });
    assert.doesNotMatch(body, /check-curator-drift|curator:check|First publish/);
    assert.match(body, /merges\s+itself/);
  });
});
