# ADR-001: Supabase schema — JSONB venues over normalized relational

- **Status:** Accepted
- **Date:** 2026-04-28
- **Landed in:** [`fe548ef`](https://github.com/Johnesco/karaokedirectory/commit/fe548ef) — "Refresh venue data + land Supabase JSONB scaffolding (dormant)"
- **Issue:** [#47](https://github.com/Johnesco/karaokedirectory/issues/47) (JSONB redesign), [#44](https://github.com/Johnesco/karaokedirectory/issues/44) (parent Supabase spike)
- **Supersedes:** Migration `001_initial_schema.sql` (normalized, dropped in `004_jsonb_redesign.sql`)

## Context

The project is moving to a Supabase backend in parallel with the static `js/data.js` source (production stays on JSON for Austin; Supabase engages behind a feature flag). Two schema shapes were viable.

Constraints at decision time:

- ~70 venues, single region (Austin)
- Read-mostly v1 — no auth, no public writes, no moderation queue yet
- Vanilla JS client, no build step, no ORM
- The frontend always fetches the **entire** venue bundle in one shot and filters client-side (week view, alphabetical, map all need everything)
- Want minimal seed/migration friction so we can iterate

## Decision

Adopt a **JSONB-heavy 2-table model**:

```
tags     (id, label, color, text_color)
venues   (id, name, active, data JSONB)
```

The `data` column holds the full venue object — `dedicated`, `address`, `coordinates`, `host`, `socials`, `schedule[]`, `activePeriod`, `tags[]` — mirroring the existing `js/data.js` shape. Top-level columns exist only for the access patterns that actually need indexing/RLS: `id` (PK / future FK target), `name` (sort key), `active` (RLS filter).

RLS: anon SELECT on `active = true` venues + all tags. No write policies in v1.

## Options considered

### Option A — Normalized (rejected)

The original `001_initial_schema.sql`: 7 tables — `tags`, `hosts`, `venues`, `venue_tags`, `schedules`, `profiles`, `submissions`. UUID PKs, FK constraints, separate `schedules` table for recurrence, junction table for tags.

**A more aggressive variant** explored in a parallel spike pushed this further: 9 tables adding `regions`, `companies`, `shows` (separating physical venue from the show that happens there), `show_schedules`, `venue_socials`. Solves Hudson Tavern-style duplication (`hudson-tavern-xpider` + `hudson-tavern-lynum` are the same bar with two KJs) by making `shows` first-class.

### Option B — JSONB-heavy (accepted)

Two tables, `data` as JSONB. `transformVenue` in the client collapses from ~80 lines to ~6: it's an identity map plus a couple of column merges. Single-table fetch on read. Schema tweaks (new social platform, new schedule field) don't require migrations.

## Rationale

- **The query path is one query.** The client fetches all active venues at startup; everything else is in-memory filtering. The relational benefits (joins, projection) buy nothing for this access pattern.
- **Seed is the dominant friction.** Until auth/writes land, the cost we feel weekly is "regen the seed when `data.js` changes." JSONB makes that a near-identity transform; normalized makes it a multi-pass dedup.
- **Schema evolution is cheap.** Adding `bluesky` to socials, or a new `frequency` value, is a `data.js` edit + reseed — no migration.
- **Referential integrity isn't free, but it isn't earning its keep yet.** With ~70 rows and a single curator, integrity is enforced editorially (and by `scripts/audit-for-supabase.js`). Once submissions and moderation exist, that calculus changes — but we're not there.
- **Postgres JSONB has GIN indexes if we ever need them.** Not free, but available without a re-architecture.

## Consequences

**Positive**
- `js/services/supabase.js` `transformVenue` shrunk ~80 → ~6 lines.
- Single-table SELECT on the only real read path.
- `seed.sql` regenerates trivially from `data.js` (`supabase/seed-from-data.js`).
- Schema additions for new fields require zero migration work.
- RLS policy surface is small — easy to reason about.

**Negative / accepted tradeoffs**
- **Hudson Tavern duplication carries forward.** A venue with two KJs on different nights is still two rows, mirroring `data.js`. Acceptable at current scale.
- **No FK enforcement** on hosts, companies, or tag references inside `data.tags[]`. Integrity relies on the audit script (`scripts/audit-for-supabase.js`) and the editorial workflow.
- **JSONB queries are awkward** if we ever need server-side filtering by, say, "all venues with a Friday show." Mitigation: pull derived columns out of `data` if/when an access pattern demands it.
- **No multi-region first-class support.** The `regions` table the normalized spike proposed (with IANA timezone) is gone. When we expand beyond Austin, region info has to be added — likely as a top-level `region` column on `venues`, not a JSONB nest.

**Future revisit triggers**
- Public submissions land → moderation queue needs FK integrity → consider promoting `host`, `submissions`, etc. out of JSONB.
- National expansion ([#17](https://github.com/Johnesco/karaokedirectory/issues/17)) → likely add `region` column at minimum.
- A new view needs server-side filtering on a nested field at scale → promote that field to a column with a regular index, or add a GIN index on `data`.

## Rejected sub-decisions

- **Per-platform social columns** (e.g. `instagram_url`, `facebook_url`): brittle; every new platform is a migration.
- **PostGIS from day one:** unused; `numeric` lat/lng inside `data.coordinates` is sufficient. Easy to bolt on later.
- **Separate `show_events` table for one-offs:** doubles the calendar query path; the existing `frequency: 'once'` schedule entry is fine.
- **UUID PKs with `slug` column:** slugs are already unique and human-meaningful; an extra UUID is overhead with no current benefit.

## Implementation notes

- **Migrations:** `001` (normalized) → `002` (RLS) → `003` (indexes) → `004_jsonb_redesign.sql` (drops 001's tables, creates this schema). Old migrations preserved for history.
- **Dormant by default:** `js/config.js` exports `useSupabase: false`. Site continues to read `js/data.js` at runtime. Flip the flag and rerun `004` + reseed when expansion is on.
- **3-tier fallback chain** in `js/app.js`: Supabase (when flag is on) → static `js/data.js` → empty state.
- **Audit before seed:** `scripts/audit-for-supabase.js` validates `data.js` shape before `seed-from-data.js` regenerates `seed.sql`.
