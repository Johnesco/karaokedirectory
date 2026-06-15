# Spike: Unify how surfaces read the venue model

> **Status:** Draft / analysis complete — follow-up issues filed (S1–S5)
> **Date:** 2026-06-14
> **Type:** Spike (research/investigation)
> **Related milestone:** Technical Foundation

## Why

The directory has grown to **five public surfaces** plus a shared venue-detail view:

| Surface | Entry point | View class |
|---|---|---|
| Weekly | `?view=weekly` (default) | `WeeklyView` |
| Alphabetical | `?view=alphabetical` | `AlphabeticalView` |
| Map | `?view=map` | `MapView` |
| KJ Index | `?kj=all` | `KJIndexView` |
| KJ Dossier | `?kj=<name>` / `?kj=none` | `KJDossierView` |
| Venue detail | `VENUE_SELECTED` event | `VenueModal` (mobile) + `VenueDetailPane` (desktop) + Map floating card |

Each surface independently re-derives the same three things from one small data model:
**(a)** which schedule entry applies, **(b)** who hosts, and **(c)** which venues to show. Those
derivations have drifted, producing duplicated code *and* surfaces that present different facts
for the same venue. This spike maps the data shape, the per-surface data flow, and the seams
where code and data should be united, with a measured duplication ledger to track payoff.

## The data, as it actually exists (77 venues)

Counts from `js/data.json`; shape from [`schema/venue.schema.json`](../../schema/venue.schema.json) (ADR-005).

| Field | Present | Note |
|---|---|---|
| `coordinates` | 77 / 77 | every venue geocoded — Map's "has coords?" guard never excludes anyone |
| `host` (venue and/or per-show) | ~all | `affiliation` on ~31 |
| `socials` | 75 | venue-level |
| `tags` | 68 | |
| `address.neighborhood` | 26 | optional |
| `activePeriod` | 3 | seasonal |
| `frequency:"once"` | 6 | specials genuinely rare |
| `exclusions` | 1 | closure dates |
| **`phone`** | **0** | rendered in detail view but **not in schema** |
| **`schedule.note`** | **0** | rendered in 3 places but **not in schema** |
| **`host.socials`** | **0** | rendered in 2 places but **schema-forbidden** |

The host model is the richest part of the shape: a host may live on the venue **or** on an
individual schedule entry, and a per-show host is a **full-object override** (not a field merge).
This is exactly the part the surfaces each re-walk.

## How each surface consumes the model

| Surface | Data source fn | active / activePeriod / dedicated / search | schedule → HTML | venue detail |
|---|---|---|---|---|
| Weekly | `getVenuesForDate` + `getVenueEventsForDate` | ✓ / ✓ / ✓ / ✓ | VenueCard compact + `getScheduleContext` | modal / pane (shared) |
| Alphabetical | `getVenuesSorted` | ✓ / ✓ / ✓ / ✓ | `VenueCard.renderScheduleList` | modal / pane (shared) |
| Map | `getVenuesWithCoordinates` | ✓ / ✓ / ✓ / ✓ | `renderScheduleCompact` + `renderScheduleTable` | `renderVenueDetailSections` (shared) |
| KJ Index | `getAllVenues` | ✓ / **✗** / **✗** / — | — | — |
| KJ Dossier | `getAllVenues` + `venueMatchesHost` | ✓ / **✗** / **✗** / — | `renderRecurring` / `renderOneTime` | inline (its own) |

Two columns carry the duplication: **six distinct schedule→HTML functions**, and the **KJ surfaces
bypassing the service layer** (so they silently ignore `activePeriod` and the dedicated toggle).

## The seams

### S1 — The host model has no primitive
The rule *"a venue's hosts = `venue.host` plus every `schedule[].host` (full-object override)"* is
independently re-encoded in **four/five** places:

- `js/utils/render.js:17` `resolveHostFor`, `:25` `hasPerShowHosts`
- `js/services/venues.js:100` `venueMatchesHost`
- `js/views/KJIndexView.js:135` `processHost` (walk both → build index)
- `js/views/KJDossierView.js:99` `hasAnyHost` + `:148` `getMatches` (walk both → filter)

No `getVenueHosts(venue)` exists. **Fix:** one accessor returning the canonical host list
(`{ host, scope: 'venue'|'show', scheduleEntry? }`); the others become thin consumers.
Enabler for **#81** (kjDefinitions identity registry).

### S2 — `schedule → HTML` happens six times
1. `js/utils/render.js:38` `renderScheduleTable` — table w/ per-show **Host column**, event links, notes → modal/pane/map-detail
2. `js/utils/render.js:97` `renderScheduleCompact` — `<div>` list → map popup
3. `js/utils/render.js:259` `getScheduleContext` + `:193` `buildAlsoText` + `:367` `renderScheduleContext` — "Every Fri · Also Tue" summary → Weekly cards *(already owned by #30/#32)*
4. `js/components/VenueCard.js:165` `renderScheduleList` — `<ul>` → Alphabetical full card
5. `js/components/VenueCard.js:40` compact time row → Weekly day cards
6. `js/views/KJDossierView.js:203` `renderRecurring` / `:216` `renderOneTime` → KJ dossier

They disagree on host overrides, exclusions, notes, and event links. They won't all collapse to one
(a marker popup ≠ an audit dossier), but the **entry-formatting core** should be a single function the
skins call. The "Also/+N more" family (#3) is already tracked by **#30/#32** and is out of scope here.

### S3 — Alphabetical shows *less truth* than every other surface (consistency bug)
Alphabetical renders through `VenueCard.fullTemplate` (`js/components/VenueCard.js:118`) →
`renderScheduleList`, while modal/pane/map go through `renderVenueDetailSections`
(`js/utils/render.js:299`). So the A–Z surface **silently omits**: per-show host overrides (no Host
column), the "Closed today" banner, "Upcoming closures," and the active-period notice. The same venue
presents different facts depending on where you click it. `fullTemplate` is a parallel
re-implementation of the shared section helpers. **Decision (locked): Option A** — keep Alphabetical
inline-expanded and reduce `fullTemplate` to a wrapper over the shared section helpers, adding a
trimmed "list/inline" variant (e.g. `renderVenueDetailSections(venue, { actions: false })`) so the
77-venue page stays light. No interaction change. See #116.

### S4 — The service layer copy-pastes its filter predicate and comparators
The predicate *active + activePeriod + dedicated + search* is duplicated across **six** functions:
`getVenuesForDate` (`:166`), `getVenueEventsForDate` (`:206`), `getVenuesSorted` (`:247`),
`getVenuesWithCoordinates` (`:432`), `searchVenues` (`:309`), `filterVenues` (`:339`) — all in
`js/services/venues.js`. The alpha-sort comparator appears 5×; the "specials-first" comparator 2×.
`getVenuesForDate` and `getVenueEventsForDate` are near-twins (unique-venue vs venue+event).
**Fix:** one `venuePasses(venue, ctx)` predicate + exported `byName` / `specialsFirst` comparators;
derive the unique list from the events list. Supersedes **#72** (which is now largely already fixed).

### S5 — The render layer believes in a shape the schema forbids
Three fields are rendered but are **schema-illegal** (`additionalProperties:false`) and absent from data:

- `venue.phone` → Contact section `js/utils/render.js:345`. *(And `js/utils/validation.js:198` sanitizes a `phone` from the submit form — a field the schema drops and the renderer can never show: an end-to-end orphan.)*
- `schedule.note` → `js/utils/render.js:69`, `js/components/VenueCard.js:98`, `:184`
- `host.socials` → `js/utils/render.js:152`, `js/components/VenueCard.js:122`

**Decision (locked), per field — see #118:**
- `venue.phone`: **promote**, scoped as the **venue's** public phone (explicitly not KJ, not curator-internal).
- socials: **promote multi-scope** — one shared `socials` shape attachable to **venue** (exists), **event** (`scheduleEntry.socials`, new), and **host** (`host.socials`, new). Event-level *render* is a fast-follow; the shape lands now.
- `schedule.note`: **delete**.

### Minor seams (fold into the above)
- KJ surfaces sort by **raw name**, not `getSortableName` — `KJIndexView.js:158`, `KJDossierView.js:130` — so "The Highball" sorts under **T** there but under **H** everywhere else. (Fix in S1/S4.)
- `VenueCard.getScheduleForDate` (`js/components/VenueCard.js:192`) re-implements day matching with `toLocaleDateString` instead of `scheduleMatchesDate`/`getDayName`. (Fix in S2.)

## Target architecture

A thin **derived-accessor layer** every surface reads through, so the model has one interpreter:

- `getVenueHosts(venue)` → canonical host list (S1)
- a single schedule-entry formatter the 3 skins call (S2; `formatScheduleEntry` already exists as the seed)
- `renderVenueDetailSections` as the **only** full-detail renderer (S3)
- `venuePasses(venue, ctx)` + exported comparators, with KJ views routed through the service (S4)
- schema and renderer agreeing on the field set (S5)

Net **less** code, and the surface-consistency gaps close as a side effect.

## Duplication ledger (tracker)

Baseline LOC measured from the function line-ranges cited above (current `main`). "Projected net" is an
estimate to be replaced with "Actual" as each issue lands. S2 and S3 overlap on
`VenueCard.renderScheduleList` (26 LOC) — it is attributed to **S3** (deleted there) to avoid double-counting.

| Seam | Issue | Implementations today | Baseline dup LOC | Projected net LOC | Actual | Status |
|---|---|---|---|---|---|---|
| S1 host walk | #114 | 4 walks | ~100 | −40 … −60 | net **+10** (+40/−30); `getVenueHosts` ~24 LOC offsets per-consumer savings; **4 walks → 1** | ✅ `114-get-venue-hosts`, pending Verify |
| S2 schedule render | #115 | 6 formatters | ~93 | −15 … −30 (converge) | — | Not started |
| S3 alpha detail parity | #116 | 2 detail renderers | 72 (`fullTemplate` 46 + `renderScheduleList` 26) | −55 … −60 | JS net **−57**; CSS **+95** (venue-card section styles) → net **+43**; **facts parity achieved** | ✅ `116-alphabetical-detail-parity`, pending Verify |
| S4 service predicate/sort | #117 | 6 copies | ~50 | −30 … −50 | — | Not started |
| S5 schema↔render | #118 | 3 phantom fields | ~18 | −18 (delete) / +schema (promote) | note −26 (render+CSS+debug); schema +18 (phone, host+event socials); **phantom 3→0** | ✅ Implemented on `118-schema-rendered-fields`, pending human Verify |
| **Total** | (parent #113) | | **~330** | **−160 … −220** | | |

**Actuals to date (S5, S1, S3 implemented).** Raw LOC is running **net-positive (~+45)**, not the projected −160…−220 — the projections under-counted the cost of the new *shared* code (the `getVenueHosts` primitive in S1; the `venue-card__*` section CSS in S3, which partly mirrors the modal/pane values). The realized value is **structural dedup + cross-surface consistency** (Alphabetical now shows per-show hosts / closures / active period it previously omitted), not raw line deletion. The largest *raw* reductions remain in S2 (converge 6 schedule renderers) and S4 (collapse 6 service predicates).

Structural wins (independent of LOC):
- host-walk implementations **4 → 1**
- schedule formatters **6 → 1 core + 3 skins**
- full-detail renderers **2 → 1**
- service filter predicate **6 → 1**
- phantom rendered fields **3 → 0** (or promoted to schema)

## Decisions (resolved 2026-06-14)
1. **S5 fields** — ✅ `venue.phone` **promote** (venue's public phone only); **socials** **promote multi-scope** (venue / event / host, one shared shape; event render is a fast-follow); `schedule.note` **delete**. See #118.
2. **S3 approach** — ✅ **Option A**: keep Alphabetical inline-expanded, reduce `fullTemplate` to a wrapper over the shared helpers with a trimmed "list/inline" (no-actions) variant. See #116.
3. **Sequencing** — S1 and S3 give the most user-visible payoff; S4 is the lowest-risk internal win. Suggested order: **S5 → S1 → S3 → S2 → S4**.

## Related existing issues
- **#72** searchVenues duplication / activePeriod — subset of S4; verify & close as superseded.
- **#30 / #32** Unify frequency label + "Also/+N more" renderer — the one schedule formatter S2 leaves alone.
- **#81** Normalize KJ identity via kjDefinitions — S1's `getVenueHosts` is its enabler.
- **#78 / #88** Map multi-show rendering — consumers of the S2 schedule core.
- **#36** Type-safety strategy (JSDoc vs TS) — the new primitives are the place to start typing.
