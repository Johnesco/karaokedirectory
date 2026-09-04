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
- Service layer abstracts data access (`js/services/venues.js`). It reads whatever `initVenues()` is handed, so the source is swappable — but there is only one source today (ADR-009)
- Schedule matching logic handles complex recurrence patterns
- **Three layers, three units (ADR-013):** storage's unit is the **venue**, identity's unit is the **registries**, presentation's unit is the **show** — the derived `{venue, schedule entry}` pair that `getVenueEventsForDate()` emits ("one row per show"). Views group shows; they do not own bespoke pipelines. A recurring named production (Story-Oke) is its host registry entry — "all its shows" is the host lens, not a new entity type

## Display Philosophy

These principles govern **what** the directory shows and **how** it presents venues — the editorial stance, not the technical architecture.

### 1. Neutral Directory, Not a Review Platform
No ratings, reviews, rankings, or "best of" lists. Every active venue is presented equally. Alphabetical sort everywhere. No algorithmic or editorial favoritism.

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
│   ├── check-curator-drift.js   # Curator master vs js/data.json — run BEFORE exporting
│   └── code-metrics.js    # Line/size snapshot by bucket (manual, writes metrics/snapshots/)
│
├── schema/
│   └── venue.schema.json  # Authoritative venue schema (ADR-005)
│
├── e2e/                   # Playwright specs (12 files) — run by `npm test`, gated in CI
├── test/                  # node --test unit specs — run by `npm run test:unit`
│   ├── date.test.mjs      # Schedule matching, exclusions, date ranges
│   └── venues.test.mjs    # venuePasses, search predicates, host hydration
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
│   ├── adr/               # ADR-001…013 + README index
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
      host: {                 // Optional: overrides venue-level host for this show only
        name: "Guest KJ",     // See "Per-show host override" below
        affiliation: "Some Karaoke Co",
        website: "https://..."
      }
    },
    {
      frequency: "once",      // One-time special event
      date: "2026-03-15",     // Specific date (YYYY-MM-DD)
      startTime: "20:00",
      endTime: "23:00",
      eventName: "Event Name", // Optional: display name for the event
      eventUrl: "https://...", // Optional: link to event page
      socials: { instagram: "https://..." } // Optional: event-level social links (same shape as venue socials)
    }
  ],
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
- **color**: Background color (hex)
- **textColor**: Text color for contrast

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

**`dedicated` and `special-event` are derived, not stored.** `renderTags()` prepends the first when `venue.dedicated` is true; `VenueCard` prepends the second when the entry it is rendering is `frequency: "once"`. `renderTags()` deduplicates the result, so listing either in a venue's `tags` no longer renders the badge twice (#208) — but it is still redundant, and `validate-data.js` warns about it.

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
- `#view=<v>&venue=<id>` — deep link to a selected venue. The hash records the **actual** view; a venue-less hash is cleared rather than left as `#view=weekly`
- Legacy bare hashes (`#weekly`) are still honoured

`venueShareUrl()` pins `view=weekly` deliberately — a shared venue link should land on the calendar regardless of which view the sharer was in. That is a different question from what the address bar shows while browsing.

`?kj=` and the generated `/kj/<id>/` pages (ADR-012) now speak the same language: both address a host by registry id (#124 Phase 5). The SPA additionally accepts a name substring, for links that predate the change.

### Extended Sections
- `ExtendedSection` component renders collapsible sections: "Next Week", "Later in [Month]", "[Next Month]"
- Date helpers in `js/utils/date.js`; deduplication skips already-shown venues in later sections
- Collapse state persists in `localStorage` (`extendedSection_{title}_collapsed`)

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

`js/data.json` is **maintained externally** by the project owner. Day-to-day venue edits happen in a local-only curator tool that lives outside this repo (at the owner's `~/karaoke-curator/`). That tool writes `js/data.json`, which is the only venue data file (ADR-008).

**Run `npm run curator:check` before every export.** The curator's Export writes `js/data.json` verbatim from its own master, with nothing in between — so a master that is behind the repo silently reverts whatever landed since it was last synced, and every other gate stays green (`validate-data.js` checks the file against the schema, not against what it replaced). A 17-day-stale master would have destroyed #229's contrast palette and #228's live event; the check exits non-zero only when the repo holds content the export would drop, and skips cleanly when no master is present (#237).

The curator runs on **:8765** via `node server.js` (its `start.cmd`), with its own site preview on **:8766**. Serving it from a static file server instead makes browsing work while Save and Export both fail with `501 Unsupported method ('POST')`.

If you're a contributor (or a Claude session that needs to add a venue inside this repo):

1. Edit `js/data.json` directly. Add the venue object to the `listings` array, following the schema in the "Venue Data Format" section below.
2. Run `node scripts/validate-data.js` to check format. CI runs it on every PR — see `.github/workflows/ci.yml`.
3. Add coordinates via `node scripts/geocode-venues.js` (Node.js batch) — patches `data.json`.
4. Open a PR. The owner will reconcile your change with their curator master before merging or after.

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

npm run curator:check # curator master vs js/data.json — owner only, before exporting
```

`curator:check` is deliberately **not** part of `validate:all` and not a CI gate: it compares against a file outside the repo that only the owner has, so it would skip on every CI run and for every other contributor. It is a pre-export guard, not a build gate.

| Gate | Covers | Notes |
|---|---|---|
| `validate:all` | `js/data.json` against `schema/venue.schema.json`, plus cross-row checks and data-quality warnings; CSS load order on all 4 pages | Non-zero exit fails CI. Warnings are informational and do not fail |
| `test:unit` | `js/utils/date.js`, `js/utils/hosts.js`, and the pure predicates in `js/services/venues.js` | **Pure modules only.** View classes belong to e2e — do not unit test them |
| `npm test` | Behaviour across all 4 pages, 12 spec files | Starts its own server on **:3456**, so it will not collide with `npm run dev` |

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

<!-- ============================================================
     WORKING IN THIS PROJECT
     Universal process content lives canonically in sdlc-baseline.
     We link out — never paste copies here. See the consumption model:
     https://github.com/Johnesco/sdlc-baseline/blob/main/docs/consumption.md
     ============================================================ -->

## Working in this project

**SDLC profile:** core+ops
<!-- The site auto-deploys from `main` to a live public domain, so a bad merge is instantly live for real
     visitors and rollback is a real operation (netlify.toml, .github/workflows/ci.yml).
     Note: Supabase is parked (ADR-009), so security-basics' auth / injection / CSRF / IDOR sections
     still do not apply — there is no backend. See https://github.com/Johnesco/sdlc-baseline/blob/main/docs/profiles.md -->

This project uses the [sdlc-baseline](https://github.com/Johnesco/sdlc-baseline) universal workflow. Claude must follow these canonical docs:

- [Workflow (7 steps)](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/workflow.md) — ticket-first, decide before you build, documentation-aware
- [Roles & hat-switch protocol](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/roles.md) — PO / BA / Dev / Documenter / QA
- [Definition of Done](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/definition-of-done.md) — exit criteria by issue type, verification-first
- [Severity & priority matrix](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/severity-matrix.md)
- [Commit, PR, and branch conventions](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/commit-conventions.md)
- [ADR protocol](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/adrs.md) — the six-line stub, threshold rule, format
- [Profiles](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/profiles.md) — what `core+ops` requires
- [Deployment](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/deployment.md) — deploy patterns, config/secrets, rollback  *(ops)*
- [CI/CD](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/ci-cd.md) — GitHub Actions, branch protection — the ops gate  *(ops)*
- [Incident response](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/incident-response.md) — restore, investigate, prevent  *(ops)*

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

- **Profile `core+ops`** (sdlc-baseline v0.5.0). Declared for deployment, CI and incident response, which are all
  live here. The server-side half of `security-basics` — authentication, SQL injection, CSRF, IDOR — does **not**
  apply: Supabase is parked by [ADR-009](docs/adr/009-park-supabase.md) and the site is static.

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
