# ADR-004: Parallel data source via URL flag — production stays on JSON

- **Status:** Accepted
- **Date:** 2026-04-30
- **Issue:** [#56](https://github.com/Johnesco/karaokedirectory/issues/56) (backfill of plan decisions)
- **Related:** [ADR-001](001-supabase-schema-jsonb.md) — Supabase schema choice

## Context

The project is migrating toward a Supabase-backed directory ([Issue #44](https://github.com/Johnesco/karaokedirectory/issues/44) — community contributions, KJ/venue/admin roles, moderation queue). The schema is decided ([ADR-001](001-supabase-schema-jsonb.md)) and the scaffolding is in `main` but dormant.

Cutting over from `js/data.js` to Supabase as the live source is **risky**:
- Supabase availability becomes a hard dependency for the public site
- Subtle behavior differences (timezone handling, RLS edge cases, network latency) can break the user experience
- We can't validate the read path under real conditions until we exercise it
- Reverting after a bad cutover requires a code deploy, not a config change

We want to:
1. Keep the public site on `js/data.js` for Austin — zero risk to the live experience.
2. Build and validate the Supabase read path **in parallel**, accessible to those who opt in.
3. Make the opt-in scoped narrowly enough that it can't accidentally ship to the public.
4. Keep the same in-memory data shape so views and components don't have to know which source served them.

## Decision

**Production reads `js/data.js`. Supabase engages only when `?supabase=true` is in the URL query string.** The flag is URL-only and per-session — no localStorage persistence, no sticky behavior across reloads.

A small adapter layer lives between the data source and the existing `js/services/venues.js`. The adapter (a) reads the URL flag once at boot, (b) loads data from the chosen source, (c) returns `{ tagDefinitions, listings }` in the shape `initVenues()` already consumes. All views and components stay untouched.

When Supabase mode is active, a visible banner mirrors the existing `?debug=1` indicator pattern so the user knows the experience is experimental.

## Consequences

**Positive**
- **Production has zero new failure modes** while the Supabase path is being validated. The default user flow doesn't even fetch from Supabase.
- **Easy to test in real conditions** — open `?supabase=true` in any environment, including a phone, without a separate deploy.
- **Reversible to nothing.** If Supabase has issues, drop the flag from any debug links. No code change required.
- **Minimal blast radius for the integration code.** Only one branch in `app.js` and one new adapter module — `venues.js`, all views, and all components remain unchanged.
- **Forces shape parity.** The adapter outputs the existing shape, which means we cannot ship a Supabase change that breaks views without also breaking the adapter contract — early signal.
- **Supports staged rollout later.** Once we trust Supabase, the cutover is changing the default in `app.js` (one line) — not a rewrite.

**Negative / accepted tradeoffs**
- **Two read paths to maintain** while the flag exists. Drift between JSON and Supabase data is possible unless we keep them seeded in sync. Mitigated by the existing `supabase/seed-from-data.js` workflow that derives Supabase content from `data.js`.
- **The flag is invisible to most users.** Bug reports from the Supabase path will be rare and likely from us alone. We'll have less production-like load testing than we would with a percentage rollout.
- **No persistence.** Per-session means we type `?supabase=true` every time, or save bookmarks. Intentional — accidental stickiness was a risk we wanted to remove.
- **The adapter has to assemble the old shape from the new schema.** That's a bit of glue code. Acceptable cost for not touching views.
- **JSON stays the source of truth for now.** Editing in Supabase doesn't propagate back to `data.js` automatically — when we cut over for real, we'll have to retire `data.js` or define a new sync direction.

**Future revisit triggers**
- Supabase read path proves stable across enough sessions → flip the default and demote `data.js` to a fallback.
- We add write paths (submissions, moderation) — at that point the JSON path can't keep up and we'll have to commit to Supabase as the primary.
- Drift bugs between JSON and Supabase appear despite the seed pipeline → either tighten the seed automation or accelerate cutover.
- We add a second region — JSON-per-region doesn't scale; Supabase becomes the only sensible primary.

## Options considered

### Option A — Big-bang cutover (rejected)

Switch the live site from JSON to Supabase in one deploy.

Rejected because:
- Production is currently 100% reliable. Trading reliability for new capability before validating the new path is the wrong order.
- Reverting requires a code deploy and a mental context switch under pressure.
- We can't observe Supabase under real load without doing this — but a flag (this option) gets us most of that observability without risk.

### Option B — Build behind feature flag, ship gradually with percentage rollout (rejected for v1)

Flip a server-side flag for X% of traffic, monitor, expand.

Rejected because:
- The site is fully static — no server to read a flag from. Implementing percentage rollout client-side (e.g. hash-based) adds complexity.
- We don't have analytics infrastructure to know if the rollout is working.
- A URL flag is sufficient for the validation phase. We can revisit percentage rollout when cutover is imminent.

### Option C — `?supabase=true` URL flag, per-session (accepted)

What we picked. Cheap, observable, opt-in, leaves no trace if not used.

### Option D — `localStorage` flag like `?debug=1` (rejected)

The existing debug flag persists in `localStorage`. We could mirror that pattern.

Rejected because:
- Debug mode is for development; sticky persistence makes sense for a developer iterating.
- Supabase mode is for validation by people who explicitly want to test the experimental path. Sticky persistence creates a class of bugs where someone forgets they're on the experimental path and reports issues against the wrong source.
- Per-session is safer: every load resets to the production source.

## Rejected sub-decisions

- **Use a single shared `loadData()` that internally branches:** rejected. The branch is in the bootstrap (`app.js`), not in `loadData()`. Keeping the JSON path *byte-identical* to the pre-Supabase code means we know we haven't broken production by adding the adapter.
- **Lazy-import the Supabase client only when the flag is set:** accepted. Pages without the flag pay zero bytes for Supabase. ([`fe548ef`](https://github.com/Johnesco/karaokedirectory/commit/fe548ef) does this.)
- **Show a banner in Supabase mode:** accepted. Mirrors `?debug=1` indicator. Prevents confusion about which source served the data.
- **Allow `?supabase=false` to force JSON:** accepted as a no-op since JSON is the default; keeping the absence-of-flag as the default avoids encoding a redundant negative.

## Implementation notes

- **Bootstrap branch:** in `js/app.js` `init()`, after `initDebugMode()`, read `?supabase=true` from `URLSearchParams(window.location.search)`. If true, dynamic-import the Supabase loader; otherwise call the existing `loadData()`.
- **Adapter:** a `loadFromSupabase()` function that returns `{ tagDefinitions, listings }` matching the JSON shape — feeds the same `initVenues()` and `initTagConfig()` as the JSON path.
- **Banner:** copy of the `.debug-indicator` pattern in `js/utils/debug.js` and `css/components.css`.
- **Anon key:** safe to ship in client config (`js/config.js`) — RLS is what protects data.
- **Untouched files:** `js/services/venues.js`, all views, all components, `editor/editor.js`. The adapter is the only seam.

This is the *integration pattern*; the schema choice is [ADR-001](001-supabase-schema-jsonb.md). When cutover happens, a new ADR will supersede this one with the new default and the JSON-source retirement plan.
