# ADR-009: Park Supabase — remove the dormant runtime path, keep the design

**Status:** Accepted
**Date:** 2026-08-01
**Issue:** [#159](https://github.com/Johnesco/karaokedirectory/issues/159)
**Supersedes:** [ADR-001](001-supabase-schema-jsonb.md) (JSONB schema) · [ADR-004](004-parallel-data-source-flag.md) (parallel data source via URL flag)
**Related:** [ADR-008](008-fetch-data-json-directly.md) — the browser fetches `js/data.json` directly

## Context

Supabase has been wired but switched off since April: six files, ~870 lines, a live project, an anon key in two places, and a `useSupabase` flag whose own comment invited you to flip it.

Nothing exercised it, and it decayed:

- **`seed.sql` was three months and one ADR stale.** It held 77 of 80 venues and predated the host registries entirely ([ADR-007](007-host-registry-normalization.md)). Flipping the flag would have resolved all 58 host refs to `null` and shipped a directory with **no KJ attribution** — the second-most-important fact the site publishes.
- **`supabase/poc.html` was publicly served** (`200` at `/supabase/poc.html`), permanently broken against migration 004, and duplicated the anon key from `js/config.js`.
- **Every visitor paid for it.** `index.html` loaded the Supabase UMD bundle from jsdelivr on every page view — an unconditional third-party round trip for a feature that was off.
- **ADR-004 described a `?supabase=true` mechanism that exists nowhere in the code.** It was marked Accepted the whole time.

The decision this ADR settles is not "is Supabase good" — it is **whether a dormant, unexercised, unmaintained parallel data path is worth keeping wired.**

## Decision

**Park it. Move the scaffolding out of the running application; keep the design.**

- `supabase/` and `js/services/supabase.js` move to `_deprecated/`. The expensive, reviewed part — the JSONB schema reasoning in ADR-001 and migration `004` — stays readable there and in git history.
- `supabase/poc.html` is deleted outright rather than archived. It was broken, publicly reachable, and carried a duplicate credential.
- `config.useSupabase`, the `supabase` config block, the `fetchVenueData` import, and the fallback branch in `app.js` are removed. `loadData()` becomes what it has actually been since ADR-008: fetch `js/data.json`.
- The jsdelivr `<script>` tag is removed from `index.html`.

### Re-entry trigger

Reopen this decision **the moment the directory needs a write path.** Concretely, either of:

1. **Public submissions land somewhere other than the curator's inbox** — a queue, a moderation view, anything with state the site itself owns. This is [#48](https://github.com/Johnesco/karaokedirectory/issues/48), closed against this ADR rather than rejected.
2. **A second curator.** One person editing one JSON file needs no database. Two people editing it need merge resolution, which is what a database is for.

A related condition, deliberately *not* a trigger: an admin moderation UI ([#52](https://github.com/Johnesco/karaokedirectory/issues/52)). That was closed as out of frame — it builds on a write path rather than motivating one, so it follows trigger 1 rather than standing alone.

When a trigger fires, start from ADR-001's JSONB design. It is still the right shape for this data; it was never the problem.

## Consequences

### Positive

- **The site stops paying for an unused feature** — one fewer third-party request on every page load, from a CDN with no fallback.
- **The flag stops being a trap.** A flag that would ship visibly broken output if flipped is worse than no flag; nothing about `useSupabase: false` warned that `seed.sql` had gone stale beneath it.
- **One credential surface instead of two**, and no publicly-served page carrying a copy.
- **Data-layer tickets stop carrying an invisible tax.** Every change to `js/data.json`'s shape implicitly owed an update to the seed pipeline that nobody was paying.

### Negative

- **Re-entry costs a day or two** — restore from `_deprecated/`, regenerate `seed.sql`, teach the seed generator about `kjs`/`companies`. That is the correct price, and cheaper than the accumulated drift of leaving it wired.
- **The migration history moves out of the obvious place.** Mitigated: this ADR names where it went, and ADR-001 still explains why the schema looks the way it does.

### Neutral

- **The Supabase project itself is untouched.** This ADR is about this repository. Whether to delete the hosted project is a separate, reversible decision.

## Alternatives considered

- **Commit to it.** Write `005_host_registries.sql`, teach `seed-from-data.js` and `fetchVenueData()` about the registries, regenerate, add a CI staleness gate, cut over. Rejected: 2–3 days of catch-up just to be *correct again*, then a permanent dual-maintenance tax on every data-layer change, plus a hard third-party availability dependency on a site whose whole value is loading fast on a phone in a bar. It buys nothing today — one curator, one metro, ~80 venues, a static JSON file a CDN caches for free.
- **Delete it entirely.** Same afternoon of work, marginally cleaner tree. Rejected as slightly more destructive than necessary for no additional gain: the re-entry trigger below is genuinely plausible, and ADR-001's design is worth not re-deriving.
- **Leave it as-is.** Rejected — this is the status quo, and it is strictly worse than either committing or deleting, because it *presents* as a maintained parallel path while being neither maintained nor exercised.

## Related work

- **#47** delivered the JSONB redesign this parks (migration `004`) — shipped, and preserved
- **#48** is the re-entry trigger, closed against this ADR rather than rejected
- **#52** admin moderation — out of frame; follows trigger 1
- **#151** deleted `scripts/audit-for-supabase.js`, the pre-seed validator, folding its surviving checks into `validate-data.js`
