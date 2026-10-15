# Austin Karaoke Directory - Claude Project Memory

> This file serves as persistent context for Claude Code sessions. It is automatically read at the start of every conversation. Keep this document updated as the project evolves.

## Project Identity

**Name:** Austin Karaoke Directory
**Purpose:** A mobile-friendly web application helping users discover karaoke venues in and around Austin, Texas
**Target Users:** Karaoke enthusiasts looking for venues, schedules, and event details
**Live Site:** https://karaokedirectory.com (apex — `www.` 301s here; the apex is what every canonical and `og:url` points at)
**Hosting:** Netlify, static, deployed from `main`. Config in `netlify.toml` ([ADR-010](docs/adr/010-static-on-netlify-only-constraint.md))
**Analytics:** Microsoft Clarity (project ID `x1sfnv6zu4`), loaded by `js/analytics.js` **only after the visitor accepts** the consent banner — not an inline snippet. Choice persists in `localStorage` under `kd_analytics_consent`. See [functional spec §23](docs/functional-spec.md)

## Architecture

### 1. Stack
- **Vanilla JavaScript** (ES6 modules) for the application code
- **HTML5 + CSS3** for structure and styling
- **Leaflet.js** for the map view
- **Font Awesome** for icons
- **A build step exists** ([ADR-012](docs/adr/012-generated-entity-pages.md)): `npm run build` generates static entity pages under `/kj/`, `/company/`, `/venue/` plus `sitemap.xml`, from `js/data.json`. The SPA itself still needs no build — `index.html` runs as-is.

**The one constraint:** whatever is deployed must be **static files served by Netlify** ([ADR-010](docs/adr/010-static-on-netlify-only-constraint.md)). Netlify Functions and edge handlers are out of scope — adding one needs a new ADR. Deploy config lives in `netlify.toml`.

### 2. Mobile-First Responsive Design
- Base styles target mobile devices
- Media queries enhance for larger screens. The scale is **480 / 560 / 768 / 1400**, plus one `min-width: 1024px` rule for the map's docked venue card: 480px stacks schedule tables, 560px splits phone vs phablet nav, 769px+ enables multi-column venue grids, 1400px+ shows the desktop detail pane (see spec §19). `bingo.html` keeps its own game-specific scale.
- Modal for venue details on mobile, side pane on desktop (1400px+)
- **Mobile drives the layout; the wider breakpoints inherit** (#224). On `page--edge-to-edge` at ≤768px, `.main-content`'s inline padding is zero and the day-card body's is too, so venue cards run to both screen edges and the venue card's own padding is the page's **single text inset** — day name, venue name and day-card footer count all land on one line. At 769px+ there are two lines, because the day-card body keeps its gutter to carry the multi-column grid. See spec §19 "Density and alignment"

### 3. Separation of Concerns
- **HTML:** Structure only (`index.html`, `about.html`, etc.)
- **CSS:** Styling only (`css/` folder with modular files)
- **JavaScript:** Behavior only (`js/` folder with ES6 modules)

### 4. Component-Based Architecture
- `Component` base class (`js/components/Component.js`)
- State management via observer pattern (`js/core/state.js`)
- Event bus for component communication (`js/core/events.js`)

### 5. Data Layer
- **Single source: `js/data.json`** (#102, ADR-006). Dev scripts, the curator, and the browser all read this one file — the browser fetches it at runtime (ADR-008), so there is no generated copy to keep in sync.
- Because data arrives by `fetch`, the site must be served over http(s). Opening `index.html` from disk won't work (`fetch` is blocked on `file://`).
- **There is no second data source.** Supabase was parked by [ADR-009](docs/adr/009-park-supabase.md) — the scaffolding lives in `_deprecated/supabase/`, and `js/config.js`, the `useSupabase` flag, and the CDN bundle are gone. Re-entry trigger is written into that ADR: the moment the directory needs a *write* path.
- **`data.json` stands in for a database** until it converts to a relational (or more fitting) one. Shape new data so it maps cleanly onto tables: the schema is the column types, `validate-data.js` the constraints (a rule a table would enforce belongs there, not in a view), git the audit log, and `activePeriod` a validity range. See functional spec §11 "`data.json` as a stand-in database"
- **Time lives at two levels, both `activePeriod`** (ADR-016): a venue's bounds the venue, a schedule entry's bounds that show. `scheduleMatchesDate()` honours the show's window, so date-aware surfaces answer for their date; surfaces with no date (detail table, host section, search, KJ views, generated pages) list shows running today via `activeEntries()`. Nothing announces a coming change — it just happens on its date
- Service layer abstracts data access (`js/services/venues.js`). It reads whatever `initVenues()` is handed, so the source is swappable — but there is only one source today (ADR-009)
- Schedule matching logic handles complex recurrence patterns
- **Three layers, three units (ADR-013):** storage's unit is the **venue**, identity's unit is the **registries**, presentation's unit is the **show** — the derived `{venue, schedule entry}` pair that `getVenueEventsForDate()` emits ("one row per show"). Views group shows; they do not own bespoke pipelines. A recurring named production (Story-Oke) is its host registry entry — "all its shows" is the host lens, not a new entity type

## Display Philosophy

These principles govern **what** the directory shows and **how** it presents venues — the editorial stance, not the technical architecture.

### 1. Every Show Listed, Alphabetical Within Each Group
No ratings, reviews, rankings, or "best of" lists. Every active show is listed, and **position within a group is always alphabetical**. Groups reflect facts about a show (new, recently confirmed), plus one owner-controlled placement group: **Featured** ([ADR-017](docs/adr/017-day-card-sections-and-featured-placement.md), amending the old "every venue presented equally, no editorial favoritism"). Featured holds test placements only; its label and disclosure are revisited before the first paid placement.

### 2. Facts, Not Opinions
Show what a venue **is** (dive bar, 21+, LGBTQ+), not what experience you'll have. Tags are descriptive, not prescriptive. No "vibe" or quality descriptors.

### 3. The Week Is the Heartbeat
Karaoke schedules, hosts, and venues change frequently. Data beyond a month or two is unreliable. The 7-day weekly view is the primary interface, and the extended sections (Next Week, Later in Month, Next Month) provide just enough lookahead for discovery without overpromising accuracy. There is no long-range calendar by design.

### 4. Special Events Are the Exception, Not the Rule
One-time events sort to the top and get visual prominence (star icon) because they're newsworthy departures from the recurring baseline. Recurring nights are the default; specials are the signal.

### 5. Balance Visibility, Don't Overwhelm
Daily venues can dominate the calendar and overshadow weekly, bi-weekly, or monthly shows. The calendar view must balance visibility so less frequent events get fair exposure — not buried under a wall of nightly regulars. The Alphabetical and Map views are designed to show everything equally; the calendar view is where editorial balance matters most.

### 6. Practical Utility First
The app is designed for someone on their phone asking "where's karaoke tonight?" Quick search, minimal clicks, fast load, no account required.

### 7. Community-Sourced, Editorially Controlled
Anyone can submit a venue, but inclusion is curated. The `active` flag allows quiet removal without deleting data. No public archive or "closed" label.

### 8. Intentionally Minimal
No accounts, favorites, history, social features, or personalization. Every visit starts fresh and equal. Features are only added if they serve the core "find karaoke" use case.

### 9. Transparent About Its Limits
The about page warns users to verify with the venue. Debug mode exists for schedule logic. The app acknowledges it's best-effort data, not a guaranteed source.

## File Structure Overview

```
karaokedirectory/
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md  # PR checklist template
│   └── ISSUE_TEMPLATE/
│       ├── config.yml     # Disable blank issues
│       ├── feature.yml    # Feature/user story issue template
│       ├── bug.yml        # Bug report issue template
│       ├── task.yml       # Refactors, deps, tooling template
│       ├── spike.yml      # Research/investigation template
│       └── doc.yml        # Documentation-only changes template
│   └── workflows/
│       └── ci.yml         # CI: validators + unit tests, and the Playwright e2e job
├── CLAUDE.md              # THIS FILE - Claude project memory
├── README.md              # Public documentation
├── index.html             # Main SPA (heavily commented)
├── about.html             # About page
├── bingo.html             # Karaoke bingo game
├── submit.html            # Venue submission form (mobile-first, single-flow)
├── package.json           # devDependencies + npm scripts (dev, test, test:unit, validate:all)
├── playwright.config.js   # e2e config — own server on :3456, NOT the dev port
├── netlify.toml           # Deploy config: publish root + build command (ADR-010, ADR-012)
├── robots.txt             # Crawl rules
├── sitemap.xml            # GENERATED by scripts/build-pages.js; gitignored
│
├── assets/
│   └── images/
│       └── notes3.webp    # Page background (#163). 1600px WebP, 105 KB
│
├── css/
│   ├── base.css           # CSS variables, reset, typography (ALWAYS FIRST)
│   ├── layout.css         # Header, nav, footer, page structure
│   ├── components.css     # Buttons, cards, modals, forms
│   ├── views.css          # View-specific styles (weekly, map, etc.)
│   ├── bingo.css          # Bingo game styles (extends components)
│   ├── submit.css         # Submission form styles (extends components)
│   └── snowflakes.css     # Seasonal snowfall animation (disabled, commented out in index.html)
│
├── js/
│   ├── app.js             # Application entry point
│   ├── data.json          # Venue database — the single source (edit this)
│   ├── bingo.js           # Bingo game logic
│   ├── submit.js          # Venue submission form (was 803 inline lines, #168)
│   ├── chrome.js          # Shared site header + footer across the public pages (#162)
│   ├── analytics.js       # Consent-gated Microsoft Clarity loader (spec §23)
│   │
│   ├── core/
│   │   ├── router.js      # THE owner of URL <-> state; only replaceState caller
│   │   ├── state.js       # Centralized state management
│   │   └── events.js      # Event bus (pub/sub)
│   │
│   ├── components/
│   │   ├── Component.js   # Base component class
│   │   ├── Navigation.js  # View tabs, week nav, search, filters
│   │   ├── DayCard.js     # Daily schedule display (supports search filtering)
│   │   ├── ExtendedSection.js  # Extended sections (Next Week, Later in Month, Next Month)
│   │   ├── VenueCard.js   # Venue listing item
│   │   ├── VenueModal.js  # Mobile venue detail popup
│   │   ├── VenueDetailPane.js  # Desktop venue detail sidebar
│   │   ├── venue-selection.js  # Shared venue-card click binding
│   │   └── fabs.js        # Back-to-top + jump-to-today (was an inline script in index.html)
│   │
│   ├── views/
│   │   ├── WeeklyView.js      # 7-day calendar view
│   │   ├── AlphabeticalView.js # A-Z venue listing
│   │   ├── MapView.js         # Leaflet.js map view
│   │   ├── KJIndexView.js     # ?kj=all — directory of every KJ and company
│   │   └── KJDossierView.js   # ?kj=<name> — one host's shows across venues
│   │
│   ├── services/
│   │   └── venues.js      # Venue data operations, search, filtering (data-source agnostic)
│   │
│   └── utils/
│       ├── date.js        # Date formatting, schedule matching
│       ├── debug.js       # Debug mode utilities
│       ├── hosts.js       # Host ref hydration (kjs/companies registries, ADR-007)
│       ├── render.js      # Shared rendering (schedule table, host section, active period)
│       ├── string.js      # Text manipulation, escaping
│       ├── tags.js        # Venue tag rendering and configuration
│       └── url.js         # URL building, sanitization
│
├── backend/
│   └── Code.gs            # Google Apps Script behind submit.html. NOT deployed by
│                          # this repo — the running copy lives in Google's editor
│                          # and is updated by pasting this file in. Recipients come
│                          # from a NOTIFICATION_EMAIL script property, not the source
│
├── scripts/               # Developer tools
│   ├── geocode-venues.js  # Add coordinates to venues (patches data.json)
│   ├── validate-data.js   # THE data validator (Ajv + supplementary checks) — CI gate
│   ├── check-css-load-order.js  # CSS load order across HTML pages — CI gate
│   ├── publish-data.js          # Take the curator's data.json live: one-writer check, validate, an auto-merging PR
│   └── code-metrics.js    # Line/size snapshot by bucket (manual, writes metrics/snapshots/)
│
├── schema/
│   └── venue.schema.json  # Authoritative venue schema (ADR-005)
│
├── e2e/                   # Playwright specs (16 files) — run by `npm test`, gated in CI
├── test/                  # node --test unit specs (12 files: 11 listed by name, plus sections.test.mjs) — run by `npm run test:unit`
│   ├── date.test.mjs      # Schedule matching, exclusions, lifespans, date ranges
│   ├── venues.test.mjs    # venuePasses, search predicates, host hydration
│   ├── render.test.mjs    # Host resolution, schedule table, "Also" line
│   ├── build-pages.test.mjs       # Generated entity pages, JSON-LD
│   ├── publish-data.test.mjs      # Publish summary and the one-writer guard (mainGuard)
│   ├── validate-data.test.mjs     # The validator CLI against mutated data copies (#322)
│   └── freshness / router / string / tags / url .test.mjs  # one per module
│
├── metrics/snapshots/     # Output of scripts/code-metrics.js (manual, occasional)
│
├── docs/
│   ├── index.html         # Docsify documentation viewer
│   ├── functional-spec.md # Functional Specification (authoritative)
│   ├── architecture.md    # Mermaid diagrams — modules, data flow, events
│   ├── patterns.md        # 10 annotated implementation recipes
│   ├── _sidebar.md        # Docsify sidebar navigation
│   ├── .nojekyll          # GitHub Pages underscore file support
│   ├── adr/               # ADR-001…016 + README index
│   └── spikes/            # Research write-ups
│
└── _deprecated/           # Archived old code (do not use)
```

Not in the tree above, but tracked: the brand assets at the repo root (`og.jpg` plus its `og.png` design source, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`), `.hintrc`, `karaokedirectory.code-workspace`, `js/.gitattributes`, `package-lock.json`.

`assets/images/` holds `notes3.webp`, the page background (#163). The favicons and `og.jpg` stay at the **root** on purpose — that is where browsers and social scrapers look for them by convention, and every page references them by absolute path.

## Venue Data Format

**Authoritative schema:** [`schema/venue.schema.json`](schema/venue.schema.json) — single source of truth, enforced by CI via Ajv. Curator targets it; submit.html emits venue partials against it; future Supabase JSONB mirrors it. See [ADR-005](docs/adr/005-venue-json-schema.md).

The shape below is a human-readable summary. When the two disagree, the schema wins.

When adding or modifying venues in `js/data.json`, follow this structure:

```javascript
{
  id: "venue-slug",           // Unique, lowercase, hyphenated
  name: "Venue Name",
  active: true,               // Optional: false to hide venue from all pages (default: true)
  dedicated: false,           // true if karaoke-only venue
  tags: ["lgbtq", "21+"],     // Optional: array of tag IDs
  address: {
    street: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
  },
  coordinates: {              // Optional, for map view
    lat: 30.2672,
    lng: -97.7431
  },
  schedule: [
    {
      frequency: "every",     // "every", "first", "second", "third", "fourth", "last"
      day: "Friday",          // Full day name, capitalized
      startTime: "21:00",     // 24-hour format
      endTime: "01:00",       // Can cross midnight
      eventUrl: "https://...", // Optional: link to event page
      exclusions: [           // Optional: dates this recurring show is skipped (holiday/closure)
        { date: "2026-12-25", reason: "Holiday" }  // objects only — reason optional. A bare date string is NOT accepted (#169)
      ],
      activePeriod: {         // Optional: the show's lifespan (ADR-016, #288) — its known first and/or last night.
        end: "2026-10-14"     // At least one bound; a missing one is open. Written only when known, never backfilled.
      },                      // A change = end the old entry + a new entry with `start`; a correction = edit in place.
                              // Not allowed on "once" entries. Due for removal 30 days after `end`: the curator's
                              // "To prune" list (on Today) flags it and removes it only when asked (validator warns)
      host: {                 // Optional: overrides venue-level host for this show only
        name: "Guest KJ",     // See "Per-show host override" below
        affiliation: "Some Karaoke Co",
        website: "https://..."
      },
      lastVerified: "2026-10-02", // Optional: the SHOW DATE the latest evidence confirms (ADR-015, #275) — not the day it was seen.
                                  // May be in the future; that night's card carries the Announced marker. Curator-derived; never backfilled
      created: "2026-09-26",      // Optional: the day this show was ADDED to the directory (#322) — not its first night. Curator-stamped;
                                  // a Split carries it forward. New for 30 days from the later of created and activePeriod.start
      featured: {                 // Optional: a featured placement (#322, ADR-017) — true, or a window, inclusive, either bound open.
        start: "2026-10-15",      // Same shape as activePeriod. Not allowed on "once" entries (already pinned). Validator warns once spent
        end: "2026-10-31"
      },
      changed: "2026-11-06"       // Optional: when this show's details last changed (#329) — a Split sets the night it takes effect,
                                  // a correction the day it was corrected. Not on "once" entries. Listed under Updated for 30 days (#335)
    },
    {
      frequency: "once",      // One-time special event
      date: "2026-03-15",     // Specific date (YYYY-MM-DD)
      startTime: "20:00",
      endTime: "23:00",
      eventName: "Event Name", // Optional: display name for the event
      eventUrl: "https://...", // Optional: link to event page
      socials: { instagram: "https://..." }, // Optional: event-level social links (same shape as venue socials)
      lastVerified: "2026-03-15"  // Optional: same meaning as above — the confirmed night, normally the event's own date
    }
  ],
  created: "2026-10-10",      // Optional: the day this venue was ADDED (#322). Makes its shows New for 30 days. Undated = not new
  activePeriod: {             // Optional: limits when venue appears
    start: "2026-06-01",      // Venue only appears within this range
    end: "2026-08-31"
  },
  host: {                     // Optional: default host for shows that don't override
    name: "KJ Name",
    affiliation: "Karaoke Company Name", // Use "affiliation", not "company"
    website: "https://...",   // Optional: host/KJ website
    socials: { instagram: "https://..." } // Optional: KJ/host social links (same shape as venue socials)
  },
  socials: {                  // All optional
    website: "https://...",
    facebook: "https://facebook.com/...",
    instagram: "https://instagram.com/...",
    twitter: "https://twitter.com/...",
    tiktok: "https://tiktok.com/...",
    youtube: "https://youtube.com/...",
    bluesky: "https://bsky.app/..."
  },
  phone: "512-555-1234"       // Optional: venue's public phone (tel: link in detail views)
}
```

### Per-show host override

The `host` field on a schedule entry overrides the venue-level `host` for that show only. Useful when one venue runs different recurring shows with different KJs (e.g., Stardust on Monday with KJ A, Saturday with KJ B). Existing venues with a single host need no change.

Inheritance rules (per `resolveHostFor` in `js/utils/render.js`):
- Schedule entry without `host` → inherits the venue-level `host`.
- Schedule entry with `host` → that's the show's host. **Full object swap, not field-level merge** — if you set `entry.host`, the venue's `name`, `affiliation`, and `website` are NOT inherited for that show. Set whichever fields you want present on the override.
- A venue may have NO venue-level `host` if every schedule entry specifies its own (The Highball is the current example).

Where this is consumed:
- `js/utils/render.js` → `resolveHostFor(venue, scheduleEntry)` returns the effective host. `renderScheduleTable()` adds a "Host" column whenever any entry has its own host.
- `js/views/KJIndexView.js` → walks both `venue.host` and `schedule[].host` when enumerating KJs.
- `js/services/venues.js` → `venueMatchesHost()` matches at either level.

### Host registries (ADR-007)

Hosts are being normalized out of inline objects into two top-level registries, referenced by id — the same indirection `tags[]` uses:

```javascript
kjs: { "kj-stephanie": { name: "KJ Stephanie" } },          // people and named acts
companies: { "starling-karaoke": { name: "Starling Karaoke", website: "https://..." } },
listings: [
  { id: "some-bar", host: { kjId: "kj-stephanie", companyId: "starling-karaoke" } }
]
```

- A **host ref** is `{ kjId?, companyId? }` with at least one id: company-only (a company runs it, KJ rotates/unknown), KJ-only (independent), or both. Valid at venue level and per schedule entry, with the same full-swap override rule.
- **The KJ↔company link lives on the show, not on the entities** — no company on a KJ, no roster on a company. Rosters and the KJ index are derived by scanning shows, so they can't go stale, and a KJ can work under different companies at different venues.
- `hydrateVenues()` in `js/utils/hosts.js` resolves refs inside `initVenues()` into the legacy display shape (KJ fields win, company fills gaps), so nothing downstream needs to know which form was stored.
- **`data.json` is migrated** (#124 Phase 2) — 24 KJs and 18 companies, every host stored as a ref. `_deprecated/migrate-hosts.js` performed the one-time conversion and is retained there for reference only.
- **The curator is registry-aware** (#124 Phase 4). Its master is migrated, hosts are picked from dropdowns rather than typed, and a website field edits the shared registry record — so it exports refs, not inline objects.
- **The legacy inline shape is still accepted** by schema and hydration, because `submit.html` emits it for curator reconciliation (#124 Phase 3 remains open). `validate-data.js` fails on unresolvable ids and warns on unreferenced or same-named registry entries.

Full detail: [functional spec §11 "Host Registries"](docs/functional-spec.md).

### City registry (#170)

`address.city` is a closed vocabulary, checked the same way tags and host refs
are. `js/data.json` carries a top-level `cities` map:

```javascript
cities: { "round-rock": { name: "Round Rock" } }
```

`validate-data.js` **fails** on any `address.city` not in the map, with a
nearest-match hint. That is what free text cost: `"Hutto/Round Rock"` and
`"Lake Travis"` lived alongside the real names for as long as the field existed
— 19 distinct strings for 17 actual cities. Both are folded in.

The id is stable so a city can become a link target rather than a string
(ADR-011). Nothing links to one today.

**`address.neighborhood` is gone.** It was populated on 5 of 80 venues, one of
its three values was a city, and every page's meta description advertised
"search by name or neighborhood" — a promise that worked for 6% of the
directory. Removed from the schema, `venueMatchesSearch`, `filterVenues`,
`getNeighborhoods()`, the submit payload, and the meta text.

### Venue Tags

Tags are defined in `tagDefinitions` at the top of `js/data.json`. Each tag has:
- **id** (key): Machine-readable identifier
- **label**: Human-readable display name

**Colours are authored CSS, not data** (ADR-014, #238): `css/components.css` carries one `.tag[data-tag="<id>"]` rule per tag, holding the #229 WCAG palette. `data.json` stores no presentation values, so a stale curator export can never revert design work. A tag without a rule falls back to the neutral `.tag` surface.

Available tags:
| Tag ID | Label | Description |
|--------|-------|-------------|
| `dedicated` | Dedicated | Dedicated karaoke venue (auto-added when `dedicated: true`) |
| `lgbtq` | LGBTQ+ | LGBTQ+ friendly venue |
| `dive` | Dive Bar | Dive bar atmosphere |
| `sports-bar` | Sports Bar | Sports bar venue |
| `country-bar` | Country Bar | Country/western bar |
| `21+` | 21+ | 21 and over only |
| `18+` | 18+ | 18 and over only |
| `all-ages` | All Ages | No age restriction |
| `family-friendly` | Family | Family-friendly venue |
| `smoking-inside` | Smoking Inside | Indoor smoking allowed |
| `restaurant` | Restaurant | Primarily a restaurant with karaoke |
| `outdoor` | Outdoor | Significant outdoor/patio space |
| `live-band-karaoke` | Live Band | Live band karaoke venue |
| `billiards` | Billiards | Pool hall / billiards focus |
| `brewery` | Brewery | Brewery or distillery |
| `games` | Games | Arcade, bowling, entertainment center |
| `craft-cocktails` | Craft Cocktails | Upscale craft cocktail bar |
| `neighborhood` | Neighborhood Bar | Casual neighborhood bar |
| `special-event` | Special Event | One-time special karaoke events (auto-added on cards for `frequency: "once"` entries) |

Tags are rendered as color-coded badges in VenueCard, VenueModal, VenueDetailPane and MapView using the `renderTags()` function from `js/utils/tags.js`.

**`dedicated` and `special-event` are derived, not stored.** `renderTags()` prepends the first when `venue.dedicated` is true; `VenueCard` prepends the second when the entry it is rendering is `frequency: "once"`. `renderTags()` deduplicates the result, so listing either in a venue's `tags` no longer renders the badge twice (#208) — but it is still redundant, and `validate-data.js` warns about it. Since ADR-014, `validate-data.js` also warns if a tag definition still carries `color`/`textColor` — those fields are ignored; the palette lives in CSS.

## Key Technical Patterns

> For detailed code recipes, see `docs/patterns.md` (10 annotated implementation patterns).

### State Management
- `js/core/state.js`: `getState(key)`, `setState(obj)`, `subscribe(key, callback)` — simple observer pattern
- **The single change channel.** Change something with `setState`, react with `subscribe(key, …)`. Never announce a state change on the event bus as well — subscribers have already run, and the second notification re-renders every listening view (#157)

### Event Bus
- `js/core/events.js`: `emit(event, data)`, `on(event, callback)`, `off(event, callback)`
- Only for one-shots that are **not** state transitions. That is exactly two events: `VENUE_SELECTED` and `VENUE_CLOSED`. Nine others were deleted in #157 — eight had only one end (no emitter or no listener), and `FILTER_CHANGED` duplicated the state keys it accompanied

### Component Lifecycle
`constructor` → `init()` → `template()` → `render()` → `afterRender()` → `destroy()`

### Immersive Map Mode
- `app.js` adds `body.view--map` class; CSS hides header/footer/nav, map fills viewport
- Floating elements: `.map-date-filter` + `.map-controls` (left), `.map-view-switcher` (right), `.map-venue-card` (details)
- Escape key: closes card first, then exits to Calendar view
- **Date filter** (#215): All / This Week / Today, held in `mapDateFilter` state. "This week" is Sunday–Saturday of the current week, not the next seven days. The predicate is `venueHasShowInRange()` in `js/services/venues.js`. Deliberately not in the URL — the spans are relative to "now"
- **The map filters by time, not text** (#217). Its two filters are the date buttons and the dedicated toggle; `MapView` does not subscribe to `searchQuery` and `getVenuesWithCoordinates()` takes no such option. The nav bar holding the search input is hidden in immersive mode, so a carried-over query used to narrow the map invisibly
- Leaflet loads from a CDN *after* render, so `MapView.destroyed` gates the async `initMap()`. Skip that guard and a destroyed instance claims the live one's container, which leaves a map nothing is subscribed to — see functional spec §4

### Search Feature
- Navigation updates `searchQuery` state; **WeeklyView and AlphabeticalView** subscribe to that key. MapView does not — the map filters by time (#217). State is the only change channel — never `setState` and then `emit` the same change (#157)
- `venues.js` → `venueMatchesSearch()` matches: venue name, city, venue-level host name/affiliation, per-show host name/affiliation, and tags (ID + label)
- It does **not** match event names. This file claimed otherwise for months; `venueMatchesSearch` never reads `entry.eventName`. Adding it is a one-line change tracked on #37 — until that lands, the omission is the truth
- Empty results collapse day cards to header-only (`.day-card--empty`)

### URL Query Params

**`js/core/router.js` owns URL ↔ state.** Everything the URL can say goes through two functions — `readLocation()` (query + hash → a normalized object) and `writeLocation(patch)` (a partial patch → the URL). `writeLocation` is the **only** caller of `history.replaceState` in the app; if you find yourself reaching for `location.search` elsewhere, that is the bug.

- `?view=<weekly|alphabetical|map>` — initial view. `VALID_VIEWS` is declared once, in the router
- `?kj=all` — KJ index (`KJIndexView`)
- `?kj=none` — venues with no listed host
- `?kj=<id>` — KJ dossier (`KJDossierView`). Carries a **registry id**, matched exactly, so `?kj=armando` no longer also matches "KJ Armando and Paola". A non-id value still substring-matches names, so links shared before #124 Phase 5 keep working
- `?debug=1` — debug mode (also `localStorage.debug=1`)
- `?fresh=1` — freshness lens (#259): reveals each show's confirmed night on calendar cards, the detail schedule table and the KJ dossier, worded from that night (ADR-015) — "Announced for Oct 1" ahead of it, "Verified today" on it, "Verified Aug 28 · 9d" after. URL-only by decision — no `localStorage` twin. Read by `readLocation()`, initialised via `initFreshLens()` in `js/utils/freshness.js`
- `#view=<v>&venue=<id>` — deep link to a selected venue. The hash records the **actual** view; a venue-less hash is cleared rather than left as `#view=weekly`
- Legacy bare hashes (`#weekly`) are still honoured

`venueShareUrl()` pins `view=weekly` deliberately — a shared venue link should land on the calendar regardless of which view the sharer was in. That is a different question from what the address bar shows while browsing.

`?kj=` and the generated `/kj/<id>/` pages (ADR-012) now speak the same language: both address a host by registry id (#124 Phase 5). The SPA additionally accepts a name substring, for links that predate the change.

### Extended Sections
- `ExtendedSection` component renders collapsible sections: "Next Week", "Later in [Month]", "[Next Month]"
- Date helpers in `js/utils/date.js`; deduplication skips already-shown venues in later sections
- Collapse state persists in `localStorage` (`extendedSection_{title}_collapsed`)

### Day Card Sections (ADR-017, #324)
Every day card groups its shows: **Specials** (one-time events, no heading) → **New** → **Updated** → **Featured** → **Verified** → **the rest** (no heading). Each show sits in exactly one section, the first it qualifies for, and each section is alphabetical. Empty sections aren't rendered.
- New: something **added**. `created` or `activePeriod.start` (the later), at show or venue level, within 30 days of today; an entry with `changed` ignores its own start. Updated (#335): **any** detail change to a show that isn't new (a Split or a correction), via `changed` within 30 days. Verified: `lastVerified` within 30 days of today. Featured: `featured` is `true` or a window covering the card's date
- **One clock (#330):** the 30 days is `VERIFIED_WINDOW_DAYS` in `js/utils/date.js`. The Verified section, the `?fresh=1` lens and the validator's stale warning all use it, and all treat day 30 as outside. The validator mirrors the number (it's CommonJS), and `test/validate-data.test.mjs` fails if the two differ
- The rules are pure functions in `js/utils/sections.js` (`groupShows()`), unit-tested. `DayCard.renderEvents()` renders them. Extended sections get them too
- Headed sections are coloured (New emerald `#34d399`, Updated sky `#38bdf8`, Featured amber, Verified indigo) with a centred title between rules: a box at 769px+, a left stripe at ≤768px. See functional spec §2 "Sections"

### Day Card States
| Class | Behavior |
|-------|----------|
| `.day-card--today` | Purple border highlight |
| `.day-card--past` | Collapsed, dimmed, click to expand |
| `.day-card--empty` | Collapsed, dimmed — no matching venues |
| `.day-card--expanded` | Modifier for expanded past days |

## CSS Conventions

### CSS Loading Order (IMPORTANT)
All pages should load CSS in this order for consistency:
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="stylesheet" href="css/base.css">      <!-- 1. Variables, reset -->
<link rel="stylesheet" href="css/layout.css">    <!-- 2. Page structure -->
<link rel="stylesheet" href="css/components.css"> <!-- 3. UI components -->
<link rel="stylesheet" href="css/[page].css">    <!-- 4. Page-specific (optional) -->
```

### Page CSS Requirements
| Page | CSS Files |
|------|-----------|
| index.html | base, layout, components, views |
| about.html | base, layout, components, views |
| submit.html | base, layout, components, views, submit |
| bingo.html | base, layout, components, bingo |

Enforced by `scripts/check-css-load-order.js` — also run automatically in CI on every PR (`.github/workflows/ci.yml`). Exits non-zero on violation.

### BEM Naming
- Block: `.venue-card`
- Element: `.venue-card__header`
- Modifier: `.venue-card--full` (the old `--compact` example named a class #166 deleted)

### CSS Variables (defined in `base.css`)
- Colors: `--color-primary`, `--color-secondary`, `--bg-card`, etc.
- Spacing: `--spacing-xs` through `--spacing-2xl`
- Typography: `--font-size-sm` through `--font-size-2xl`
- Borders: `--border-radius`, `--border-color`
- Transitions: `--transition-fast`, `--transition-normal`

**The `--spacing-*` values are fixed. Tune density by pointing a selector at a different token, never by re-valuing the scale** (#224). Re-valuing one retunes every page that uses it, and `html { font-size: 14px }` at ≤480px is already a global multiplier on the whole scale — a second one compounds invisibly.

### `.panel` is a three-surface primitive
`.panel` / `__header` / `__title` / `__body` (extracted in #166) are shared by the calendar's day cards, the Alphabetical view's letter cards, **and** about.html's seven articles. Any edit is a three-surface change, and only the first has e2e coverage — check the other two by hand. `__header` and `__body` deliberately share the same inline padding so a panel has one text inset (#224).

### Standard Page Structure
Use these semantic elements consistently:
```html
<body>
    <header class="site-header">...</header>
    <nav class="navigation-container">...</nav>
    <main class="main-content">...</main>
    <footer class="site-footer">...</footer>
</body>
```

## Common Development Tasks

### Adding a New Venue

`js/data.json` is **maintained externally** by the project owner, in a local-only curator tool that lives outside this repo (at the owner's `~/karaoke-curator/`). **Only the curator changes it** (one writer, ADR-018): never edit venue data in a code PR. A code change that needs new data makes it *valid* in its own PR; the owner then makes the change in the curator and publishes it (#322 broke this rule once).

**The curator keeps current state only** (#331, ADR-018). Its `data.json` is **exactly** the site's `js/data.json`: Save writes it, Publish sends it, and there is no Export step and no second copy to drift. Personal notes (venue contact and notes, the Facebook catch-up list, unfinished draft venues) live in a separate `notes.json` that never leaves the owner's machine. No history is kept: each action sets the public fields when it is taken, and git holds every published version. When the curator opens it checks that `main`'s `js/data.json` is what was last published (skipped while a data PR is merging); if not, its one offer is "take main's data". The old `curator:check` drift script and three-way publish baseline are gone (#336); a CI step fails any non-`data/` PR that touches `js/data.json`.

The curator runs on **:8765** via `node server.js` (its `start.cmd`), with its own site preview on **:8766**, which serves the curator's own `data.json` so a change can be checked before publishing. Serving it from a static file server instead makes browsing work while Save and Publish both fail with `501 Unsupported method ('POST')`.

**Confirming a show is one button in the curator** (#276). Its Posters screen reads a folder of unprocessed posters, and one Confirm per matching show stamps that show's `lastVerified` with the night (never moving it backwards, and only for a night inside the show's lifespan), files the poster and moves on. It works the same for a phone call, just without an image. Nothing else about the confirmation is stored (#331): the poster file is the only evidence kept.

**The curator opens on Today** (#333), a to-do screen read entirely from current fields. **Due this week** lists every live show whose next night (the repo's `nextOccurrence`) falls within 7 days and is not confirmed for it (`lastVerified` earlier or missing): never-verified first, then soonest night, each row with the venue's private contact, a one-click ✓ for that night and the show action panel. Confirming the night drops it; ended shows and spent one-time events never appear; a show 25+ days into the 30-day window (#330) is flagged as about to leave Verified. No daily target. Beside it: the **Inbox** (posters waiting, oldest age), **Publish** (what changed since `last-published.json`, and the button), and **Watch** (New and Updated on the site via the repo's `sections.js`, placements starting or ending this week, To prune). The Dashboard's seven tabs are gone: everything else is one searchable **Shows** table. The per-browser 30/60/90 "overdue" setting is gone too; the curator's badges use `VERIFIED_WINDOW_DAYS`.

**Every show action is one panel** (#332). The curator's Form holds **venue facts only**: its schedule rows are read-only, each with one ✎ that opens the **show action panel**, the same component as on the Posters screen (and, with #333, on Today): **Confirm · Correct it · Changes from… · Night off · Last night · ☆ Feature** on a show, **+ show · + one-time** on a venue. Each action sets the public fields itself (#331). What an action confirms is *ticked* on Posters, for the poster's Confirm to stamp, and stamped at once anywhere else, so the same fields change on every screen. Correct it and Changes from… also confirm (a correction counts as a confirmation).

**Updated, New and corrections** (#335, #329). The panel's *Correct it* sets the show's `changed` to today, and *Changes from…* (the Split) sets it on the new show to the date the change takes effect. Either way the show is listed under **Updated** on the site for 30 days. A newly added venue or show is stamped `created` instead and is **New**. The confirmation records that once lived in an `_announcements` list (#276) are gone (#331); `lastVerified` is stored, not derived.

**A show's lifespan is set in the curator, and pruning is flagged, never automatic** (#288, ADR-016). The show action panel sets it: a first night in *Correct it*, an end in *Last night*, and *Changes from…* (the **Split**) for a change on a date. The old show ends the day before, and a new one starts that day, carrying `changed` and confirmed for its first night. A show past its last night reads "ended" and is exempt from the overdue/never counts. Today's **"To prune"** list lists every show more than 30 days past its last night (ended recurring shows and spent one-time events) and the header counts them. Nothing is removed on Save or Publish; each removal is the owner's click.

**`created` is stamped by the curator; a placement is set there too** (#323, data #322, ADR-017). Adding a venue, or a show or one-time event with the panel's *+ show* / *+ one-time* (Form or Posters), writes today's date as `created`, so nobody types it. A Split keeps the old show's `created` (a day or time change is not news) unless its **genuinely new show** box is ticked. The panel's **☆ Feature** tab sets a placement on a recurring show: ticked with no dates is `featured: true`, dates make a window, unticking removes it; it is not offered on one-time events, and a Split gives each half only the placement nights it runs. Save runs the same checks the repo would (a window that ends before it starts, `featured` on a one-time event, a malformed date) and warns if any would stop Publish; the repo's validator is the gate.

**Catching up on Facebook is a list in the curator** (#298). The groups where shows get announced live in the master as a curator-private `_catchupGroups` list (`{ id, name, url, lastChecked? }`, never exported), shown at the top of the sidebar least-recently-checked first. **Start/Next** opens each in **one named companion window** (`kd-catchup`) on the right half of the screen and reuses it, marking each group checked as it moves on. Facebook refuses to be framed even by a local page, which is why it is a window and not an iframe.

**The Posters screen is built for reading by hand, from the keyboard** (#300, #301, #302). There is no OCR and no vision API, by the owner's decision; the tool removes the clicking around the reading. A poster gets in by **Ctrl+V** anywhere in the curator (or a drop); a link on the clipboard, or pasted next, is kept as that poster's source and pre-fills the record's. The queue is **newest first** (toggle remembered per browser) and shows its count and oldest age; **"Delete older than N days"** moves the stale ones into `posters/_deleted/` behind one confirmation — moved, never deleted, never automatic. The search box always has focus: ↓ into the results, Space ticks, ←/→ steps a ticked show through **date chips** limited to nights it actually runs (the repo's `nextOccurrence`), Enter submits; the outcomes are Alt+key so no letter is ever stolen from the search. **No poster** (Alt+0, #306) is the same screen for a link, a call or something known: search, tick and Submit work the same, the only outcome is Confirm, and nothing is filed — the queue waits where it was. **Every poster can confirm, correct or create** (#303): a ✎ on each show opens the show action panel (#332) on *Correct it*; each venue offers *+ show* and *+ one-time*, and *+ New venue* stays on the poster. What is confirmed, corrected or created is ticked, so Submit records the poster against it as usual. **Every poster ends one of four ways** (#349, owner): **Confirm** (the default: a poster is at minimum a confirmation; stamps the ticked shows, files it in `filed/`), **Park** (not sure yet: `posters/_parked/`, out of the queue, kept with its link; "Back to the queue" on Posters and Today returns them), **Skip** (stays in the queue), **Delete** (useless or outdated: `posters/_deleted/`, never removed from disk; absorbs the old *Not a poster*). Pick the outcome (Alt+C/P/S/X), read **"What will change"** (a diff of the data since the poster came up, plus what each tick would stamp and why a date would not move), then **Submit**. Park and Note only no longer pretend to keep a note: nothing but the poster file is kept (#331).

If you're a contributor (or a Claude session) with a venue to add or fix: **do not edit `js/data.json` in a PR** (one writer, ADR-018). Send it to the owner instead, through the site's submit form (`submit.html`) or a GitHub issue, and the owner adds it in the curator. If the change needs a new field or rule, that part *is* a code PR (schema, validator, display); the data itself follows from the curator once it merges. `node scripts/validate-data.js` and `node scripts/geocode-venues.js` remain useful for checking a file locally.

Do not look for or attempt to use `editor.html` — it was removed in favor of the external curator tool.

### Adding a New View
1. Create `js/views/NewView.js` extending Component
2. Add case in `app.js` renderView() function
3. Add navigation tab in Navigation.js
4. Add view-specific styles in `css/views.css`

### Modifying Styles
- Global changes: `css/base.css` (variables) or `css/layout.css`
- Component changes: `css/components.css`
- View-specific: `css/views.css`

## Testing

Three gates. All of them run in CI on every PR (`.github/workflows/ci.yml`), in two jobs — the fast one (validators + unit tests) and the Playwright one.

```bash
npm install          # once
npm run dev          # serve on http://localhost:8000

npm run validate:all # venue data (Ajv + supplementary checks) and CSS load order
npm run test:unit    # node --test — pure modules only, ~150ms
npm test             # Playwright end-to-end, ~1.5 min

npm run data:publish:dry  # what a publish would send live, without sending it
npm run data:publish      # gates, then open the data PR with auto-merge on (no ticket by design, #338)
```

**Publishing checks one writer** (ADR-018, #336). `publish-data.js` refuses when `main`'s `js/data.json` is not what the curator last published (`last-published.json`, next to the curator's `data.json`), unless a data PR is still merging. That means someone changed the data outside the curator, and the curator's one offer is "take main's data". The `curator:check` drift script, its three-way baseline and the first-publish `--adopt-baseline` step existed while the curator kept a second full copy; #331 removed the copy and #336 removed them.

| Gate | Covers | Notes |
|---|---|---|
| `validate:all` | `js/data.json` against `schema/venue.schema.json`, plus cross-row checks and data-quality warnings; CSS load order on all 4 pages | Non-zero exit fails CI. Warnings are informational and do not fail |
| `test:unit` | `js/utils/date.js`, `js/utils/hosts.js`, and the pure predicates in `js/services/venues.js` | **Pure modules only.** View classes belong to e2e — do not unit test them |
| `npm test` | Behaviour across all 4 pages, 16 spec files | Starts its own server on **:3456**, so it will not collide with `npm run dev` |

Notes that will bite you otherwise:

- `node --test` is invoked **with no path argument** on purpose. A glob needs Node 21+; a bare directory stopped working in Node 24. The no-arg form discovers `test/*.test.mjs` identically on 18 through 24.
- **CI runs Node 20** while local development is typically newer, and nothing declares an `engines` constraint. A test invocation that works locally can still fail in CI — this has already happened once.
- Unit tests can import `js/services/venues.js` and `js/utils/render.js` only because `escapeHtml()` no longer builds a detached `<div>` (#147). Reverting it to a DOM technique would break them.

### Debug Mode
Enable debug mode to see why venues appear on specific dates:
1. Add `?debug=1` to the URL (e.g., `index.html?debug=1`)
2. Or run in console: `localStorage.setItem('debug', '1')`

When enabled:
- A "Debug Mode" indicator appears in the top-right corner
- Venue cards show their schedule match reason (e.g., "Every Friday", "First Saturday")
- Hover over cards for detailed match info
- Calendar cards say **why the show is in its section** (#325): "New since Oct 1 (show's first night)", "Updated Oct 10 (show details changed)", "Verified for Oct 15", "Never verified"…, built by `sectionReason()` in `js/utils/sections.js`

**Freshness lens** (`?fresh=1`, #259) is the sibling lens for data age, worded from the confirmed night (ADR-015): "📣 Announced for Oct 1" before that night, "✓ Verified today" on it, "✓ Verified Aug 28 · 9d" after. An unconfirmed show gets nothing (#267). The detail schedule table grows a Verified column on all four surfaces when some show at the venue is confirmed, and the KJ dossier annotates each one. URL-only (no `localStorage`), off by default, and `renderFreshness()` returns `''` when off — so the public page emits no new markup, which `e2e/fresh-lens.spec.js` asserts. The curator's Preview button opens the site with it on.

<!-- ============================================================
     WORKING IN THIS PROJECT
     Universal process content lives canonically in sdlc-baseline.
     We link out — never paste copies here. See the consumption model:
     https://github.com/Johnesco/sdlc-baseline/blob/main/docs/consumption.md
     ============================================================ -->

## Working in this project

This project uses the [sdlc-baseline](https://github.com/Johnesco/sdlc-baseline) universal workflow. Claude must follow these canonical docs:

- [Workflow (7 steps)](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/workflow.md) — ticket-first, documentation-aware
- [Roles & hat-switch protocol](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/roles.md) — PO / BA / Dev / Documenter / QA
- [Definition of Done](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/definition-of-done.md) — exit criteria by issue type
- [Severity & priority matrix](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/severity-matrix.md)
- [Commit, PR, and branch conventions](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/commit-conventions.md)
- [ADR protocol](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/adrs.md) — when and how to record architectural decisions

The **Functional Specification** (`docs/functional-spec.md`) is this project's authoritative behavior record. CLAUDE.md and README.md are secondary but must stay consistent.

**Two non-negotiables:**

1. **No code without a ticket.** Every change starts as a GitHub Issue. Add it to the project board immediately:
   ```
   gh project item-add 1 --owner Johnesco --url [ISSUE_URL]
   ```
2. **Claude cannot QA its own work.** The Verify column is always human-owned.

When sdlc-baseline updates, glance at its [CHANGELOG](https://github.com/Johnesco/sdlc-baseline/blob/main/CHANGELOG.md) before adopting changes here.

### Project-specific deviations

This project intentionally diverges from canonical sdlc-baseline guidance in these places:

- **Publishing venue data carries no ticket.** `npm run data:publish` (the curator's
  Publish button) opens a PR straight from the curator's data.json, with no GitHub Issue behind it,
  and turns on auto-merge so it merges itself once CI is green (#338).
  Rationale: updating venue data is daily operation, not development — it happens
  several times a week, changes no code, and is gated by `validate-data.js` and the
  one-writer check (#336) rather than by review. Building the tooling still follows
  the normal process (#275, #276, #277). Everything that touches code keeps its ticket.

### Project IDs

GitHub Projects field IDs and option IDs for this project. Used by Claude when scripting `gh` commands.

- **Project board:** `PVT_kwHOAFNB8s4BOmpz` (Karaoke Directory, project number `1`, owner `Johnesco`)
- **Status field:** `PVTSSF_lAHOAFNB8s4BOmpzzg9Qduc`
- **Status options:**
  - Backlog = `cd363248`
  - Ready = `c4cc9638`
  - In Progress = `8d33a330`
  - Verify = `e911bcff`
  - Done = `480f598a`

### Milestones

Reconciled against the repo's live milestones on 2026-08-01. Regenerate with:

```bash
gh api "repos/Johnesco/karaokedirectory/milestones?state=all&per_page=50" --jq '.[] | "\(.state)\t\(.title)"'
```

| Milestone | Spec Sections | Description |
|-----------|---------------|-------------|
| Technical Foundation | 21 | Routing, state, view registry, service layer — the app's substrate |
| Weekly Calendar View | 2, 13 | Weekly schedule grid, day cards, schedule matching |
| Alphabetical View | 3 | A-Z venue listing |
| Map View | 4 | Interactive Leaflet map, immersive mode |
| Search & Filtering | 9, 10 | Global search, extended search, dedicated filter |
| Venue Cards & Detail | 6, 7, 8 | Compact/full cards, mobile modal, desktop pane |
| Navigation & Layout | 5, 19 | Nav controls, responsive design, week navigation |
| Venue Data & Tags | 11, 12 | Data model, tag system, registries |
| Form Parity | 15 | Submit form UX (intentionally a slim subset; the curator handles the rest) |
| Karaoke Bingo | 14 | Bingo game |
| About & Infrastructure | 17, 18, 20, 25 | About page, debug mode, security, docs accuracy |
| Documentation Portal | — | Documentation site navigation and landing pages |
| Testing & CI | — | Test suite health, CI gates, dev-environment scripts |
| SEO & Metadata | 22 | Discoverability, share cards, structured data, canonical host |
| Design System | 19 | Tokens, shared component blocks, orphan CSS, breakpoints |
| Accessibility | — | Keyboard operability, focus management, ARIA, contrast |

**Closed milestones** — kept for their history, not accepting new issues: Exclusion Dates (complete — the detail-view notice this table used to call "pending" ships at `js/utils/render.js:332`), Venue Editor (`editor.html` retired to `_deprecated/`), Community Accounts and National Expansion (both closed against the fixed single-metro, no-accounts frame).

### Architecture Decisions

ADRs live in [`docs/adr/`](docs/adr/). See the [index](docs/adr/README.md) for the running list. Format and threshold rule documented in [sdlc-baseline `docs/adrs.md`](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/adrs.md).

Current ADRs:
- [ADR-001](docs/adr/001-supabase-schema-jsonb.md) — Supabase schema: JSONB venues over normalized relational
- [ADR-002](docs/adr/002-vanilla-js-no-build.md) — Vanilla JS, no framework, no build step *(superseded by ADR-010)*
- [ADR-003](docs/adr/003-github-pages-deploy.md) — GitHub Pages as deploy target *(superseded by ADR-010 — production is Netlify)*
- [ADR-004](docs/adr/004-parallel-data-source-flag.md) — Parallel data source via URL flag
- [ADR-005](docs/adr/005-venue-json-schema.md) — Venue JSON Schema as single source of truth
- [ADR-006](docs/adr/006-data-json-canonical.md) — `js/data.json` canonical, `js/data.js` auto-generated
- [ADR-007](docs/adr/007-host-registry-normalization.md) — Host normalization: KJ and company registries referenced by shows
- [ADR-008](docs/adr/008-fetch-data-json-directly.md) — Browser fetches `js/data.json`, removing the generated `data.js` wrapper
- [ADR-009](docs/adr/009-park-supabase.md) — Park Supabase: remove the dormant runtime path, keep the design
- [ADR-010](docs/adr/010-static-on-netlify-only-constraint.md) — **Static output on Netlify is the only architectural constraint** (supersedes 002, 003)
- [ADR-011](docs/adr/011-entity-link-contract.md) — Entity link contract: every linkable thing is `{type, id}` over a registry with stable ids
- [ADR-012](docs/adr/012-generated-entity-pages.md) — Adopt a build step: static entity pages generated from `js/data.json`
- [ADR-013](docs/adr/013-show-centric-presentation.md) — Venue-rooted storage, registry identity, show-centric presentation: the **show** (a derived `{venue, schedule entry}` pair) is the unit of display; storage stays venue-rooted; series are represented by their host registry entry
- [ADR-014](docs/adr/014-tag-colors-authored-css.md) — Tag colours are authored CSS; `data.json` is purely factual
- [ADR-015](docs/adr/015-one-confirmation-per-show-date.md) — **One confirmation, anchored to the show date**: a show carries one public date, the night the latest evidence confirms (supersedes the ADR-013 evidence-level addendum)
- [ADR-016](docs/adr/016-show-lifespan.md) — **A show's lifespan, recorded as it becomes known**: an optional `activePeriod` on the schedule entry, never backfilled; a change is an end plus a start; no announcement; shows 30+ days past their last night are flagged in the curator's "To prune" tab and removed only when the owner asks
- [ADR-017](docs/adr/017-day-card-sections-and-featured-placement.md) — **Day-card sections, and featured placement**: shows grouped into Specials / New / Featured / Verified / the rest, alphabetical within each; amends Display Philosophy #1; a gate on the first paid placement

## Security Considerations
- Always use `escapeHtml()` when rendering user-provided content
- Use `sanitizeUrl()` for any URLs before rendering
- Never store API keys or secrets in code
- Validate all form inputs

## Related Documentation

- `docs/functional-spec.md` - **Functional Specification (authoritative)** — Complete record of all features, behavior, and data formats. Must be updated with every change.
- `docs/architecture.md` - **Architecture Reference** — Mermaid.js diagrams covering module dependencies, component hierarchy, data flow, event lifecycle, state management, and CSS architecture.
- `docs/patterns.md` - **Code Pattern Cookbook** — 10 annotated recipes for common implementation tasks (add venue, add view, add component, add tag, etc.).
- `README.md` - Public-facing project documentation
- JSDoc comments in JavaScript files

---

*Last updated: June 2026*
*Maintained by: Project contributors and Claude Code sessions*
