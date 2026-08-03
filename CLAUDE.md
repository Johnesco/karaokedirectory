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
- No build step — files served as-is. **This is a choice, not a rule.** [ADR-010](docs/adr/010-static-on-netlify-only-constraint.md) makes static-output-on-Netlify the only architectural constraint, so a build step is permitted; the current setup is kept because it still suits the app's scale, not because anything forbids changing it.

**The one constraint:** whatever is deployed must be **static files served by Netlify** ([ADR-010](docs/adr/010-static-on-netlify-only-constraint.md)). Netlify Functions and edge handlers are out of scope — adding one needs a new ADR. Deploy config lives in `netlify.toml`.

### 2. Mobile-First Responsive Design
- Base styles target mobile devices
- Media queries enhance for larger screens (560px, 768px, 1024px, 1400px breakpoints); 560px splits phone vs phablet nav, 769px+ enables multi-column venue grids (see spec §19)
- Modal for venue details on mobile, side pane on desktop (1400px+)

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
├── Code.gs                # Google Apps Script backend for submit.html (deployed outside this repo)
├── index.html             # Main SPA (heavily commented)
├── about.html             # About page
├── bingo.html             # Karaoke bingo game
├── submit.html            # Venue submission form (mobile-first, single-flow)
├── bday.html              # One-off birthday invite page (public, linked from nowhere)
├── package.json           # devDependencies + npm scripts (dev, test, test:unit, validate:all)
├── playwright.config.js   # e2e config — own server on :3456, NOT the dev port
├── netlify.toml           # Deploy config: publish root, no build command (ADR-010)
├── robots.txt             # Crawl rules
├── sitemap.xml            # Public URL list
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
│   ├── analytics.js       # Consent-gated Microsoft Clarity loader (spec §23)
│   │
│   ├── core/
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
│   │   └── venue-selection.js  # Shared venue-card click binding
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
│       ├── url.js         # URL building, sanitization
│       └── validation.js  # Form validation
│
├── scripts/               # Developer tools
│   ├── geocode-venues.js  # Add coordinates to venues (patches data.json)
│   ├── validate-data.js   # THE data validator (Ajv + supplementary checks) — CI gate
│   ├── check-css-load-order.js  # CSS load order across HTML pages — CI gate
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
│   ├── adr/               # ADR-001…008 + README index
│   └── spikes/            # Research write-ups
│
└── _deprecated/           # Archived old code (do not use)
```

Not in the tree above, but tracked: `notes.jpg` / `notes3.jpg` (`notes3.jpg` is the site background), `.hintrc`, `karaokedirectory.code-workspace`, `js/.gitattributes`, `package-lock.json`.

There is **no `assets/` directory** — the tree claimed one for months. Creating it is part of the brand-assets work (#163).

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
    neighborhood: "Downtown"  // Optional: helps with search filtering
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
        { date: "2026-12-25", reason: "Holiday" }  // reason optional; "2026-12-25" shorthand also accepted
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
| `special-event` | Special Event | One-time special karaoke events |

Tags are rendered as color-coded badges in VenueCard, VenueModal, and VenueDetailPane components using the `renderTags()` function from `js/utils/tags.js`.

## Key Technical Patterns

> For detailed code recipes, see `docs/patterns.md` (10 annotated implementation patterns).

### State Management
- `js/core/state.js`: `getState(key)`, `setState(obj)`, `subscribe(key, callback)` — simple observer pattern

### Event Bus
- `js/core/events.js`: `emit(event, data)`, `on(event, callback)` — pub/sub with `Events` constants

### Component Lifecycle
`constructor` → `init()` → `template()` → `render()` → `afterRender()` → `destroy()`

### Immersive Map Mode
- `app.js` adds `body.view--map` class; CSS hides header/footer/nav, map fills viewport
- Floating elements: `.map-controls` (left), `.map-view-switcher` (right), `.map-venue-card` (details)
- Escape key: closes card first, then exits to Calendar view

### Search Feature
- Navigation updates `searchQuery` state; all views listen for `FILTER_CHANGED` events
- `venues.js` → `venueMatchesSearch()` matches: venue name, city, neighborhood, venue-level host name/affiliation, per-show host name/affiliation, and tags (ID + label)
- It does **not** match event names. This file claimed otherwise for months; `venueMatchesSearch` never reads `entry.eventName`. Adding it is a one-line change tracked on #37 — until that lands, the omission is the truth
- Empty results collapse day cards to header-only (`.day-card--empty`)

### URL Query Params
- `?view=<weekly|alphabetical|map>` — initial view
- `?kj=all` — KJ index (`KJIndexView`, alphabetical directory of every unique KJ name)
- `?kj=<name>` — KJ self-audit dossier (`KJDossierView`; `venueMatchesHost()` filters venues; minimal nav with `.filter-chip` × clear)
- `?debug=1` — debug mode (also `localStorage.debug=1`)
- `app.js` reads URL params on boot; `subscribe('hostFilter', ...)` writes back to URL via `history.replaceState`

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
| bday.html | base, layout, components (inline `<style>` for the rest) |

Enforced by `scripts/check-css-load-order.js` — also run automatically in CI on every PR (`.github/workflows/ci.yml`). Exits non-zero on violation.

### BEM Naming
- Block: `.venue-card`
- Element: `.venue-card__header`
- Modifier: `.venue-card--compact`

### CSS Variables (defined in `base.css`)
- Colors: `--color-primary`, `--color-secondary`, `--bg-card`, etc.
- Spacing: `--spacing-xs` through `--spacing-2xl`
- Typography: `--font-size-sm` through `--font-size-2xl`
- Borders: `--border-radius`, `--border-color`
- Transitions: `--transition-fast`, `--transition-normal`

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
```

| Gate | Covers | Notes |
|---|---|---|
| `validate:all` | `js/data.json` against `schema/venue.schema.json`, plus cross-row checks and data-quality warnings; CSS load order on all 5 pages | Non-zero exit fails CI. Warnings are informational and do not fail |
| `test:unit` | `js/utils/date.js`, `js/utils/hosts.js`, and the pure predicates in `js/services/venues.js` | **Pure modules only.** View classes belong to e2e — do not unit test them |
| `npm test` | Behaviour across all 5 pages, 12 spec files | Starts its own server on **:3456**, so it will not collide with `npm run dev` |

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

- _(none currently)_

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
