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
const { summarizeDiff, prTitle, prBody, branchName, parseArgs } = require('../scripts/publish-data.js');

const show = (over = {}) => ({ frequency: 'every', day: 'Friday', startTime: '21:00', endTime: '01:00', ...over });
const venue = (id, over = {}) => ({ id, name: over.name || id, schedule: [show()], ...over });
const data = (...listings) => ({ listings });

describe('summarizeDiff', () => {
  it('sees nothing in an unchanged file', () => {
    const d = data(venue('a'), venue('b'));
    const sum = summarizeDiff(d, JSON.parse(JSON.stringify(d)));
    assert.deepEqual(sum, { added: [], removed: [], edited: [], confirmed: [] });
  });

  it('reports a confirmation as a confirmation, not an edit', () => {
    const before = data(venue('a', { name: 'Alpha' }));
    const after = data({ ...venue('a', { name: 'Alpha' }), schedule: [show({ lastVerified: '2026-10-02' })] });
    const sum = summarizeDiff(before, after);
    assert.equal(sum.confirmed.length, 1);
    assert.match(sum.confirmed[0], /Alpha/);
    assert.match(sum.confirmed[0], /2026-10-02/);
    assert.deepEqual(sum.edited, []);
  });

  it('separates added, removed and edited venues', () => {
    const before = data(venue('a', { name: 'Alpha' }), venue('b', { name: 'Beta' }));
    const after = data(venue('a', { name: 'Alpha Bar' }), venue('c', { name: 'Gamma' }));
    const sum = summarizeDiff(before, after);
    assert.deepEqual(sum.added, ['Gamma']);
    assert.deepEqual(sum.removed, ['Beta']);
    assert.deepEqual(sum.edited, ['Alpha Bar']);
  });

  it('counts a schedule change that is not a confirmation as an edit', () => {
    const before = data(venue('a', { name: 'Alpha' }));
    const after = data({ ...venue('a', { name: 'Alpha' }), schedule: [show({ startTime: '22:00' })] });
    const sum = summarizeDiff(before, after);
    assert.deepEqual(sum.edited, ['Alpha']);
    assert.deepEqual(sum.confirmed, []);
  });

  it('tolerates an empty or absent listings array', () => {
    assert.deepEqual(summarizeDiff({}, {}), { added: [], removed: [], edited: [], confirmed: [] });
    assert.deepEqual(summarizeDiff({ listings: [] }, data(venue('a', { name: 'A' }))).added, ['A']);
  });
});

describe('prTitle', () => {
  const NOW = new Date(2026, 8, 11);

  it('leads with the date and says what changed', () => {
    const t = prTitle({ confirmed: ['x', 'y'], added: ['z'], removed: [], edited: [] }, NOW);
    assert.match(t, /^Curator publish 2026-09-11 /);
    assert.match(t, /2 shows confirmed/);
    assert.match(t, /1 venue added/);
  });

  it('singularises, and stays readable with nothing to report', () => {
    assert.match(prTitle({ confirmed: ['x'], added: [], removed: [], edited: [] }, NOW), /1 show confirmed/);
    assert.equal(prTitle({ confirmed: [], added: [], removed: [], edited: [] }, NOW), 'Curator publish 2026-09-11');
  });
});

describe('prBody', () => {
  it('lists each section it has content for, and says why there is no ticket', () => {
    const body = prBody({ confirmed: ['Alpha — every Friday → 2026-10-02'], added: ['Gamma'], removed: [], edited: [] }, []);
    assert.match(body, /\*\*Shows confirmed\*\*/);
    assert.match(body, /Alpha/);
    assert.match(body, /\*\*Venues added\*\*/);
    assert.doesNotMatch(body, /Venues removed/);
    assert.match(body, /No ticket by design/);
  });

  it('caps a very long list rather than writing a thousand bullets', () => {
    const many = Array.from({ length: 60 }, (_, i) => `venue ${i}`);
    const body = prBody({ confirmed: [], added: many, removed: [], edited: [] }, []);
    assert.match(body, /and 20 more/);
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
  });
});
