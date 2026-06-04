# Austin Karaoke Directory - Claude Project Memory

> This file serves as persistent context for Claude Code sessions. It is automatically read at the start of every conversation. Keep this document updated as the project evolves.

## Project Identity

**Name:** Austin Karaoke Directory
**Purpose:** A mobile-friendly web application helping users discover karaoke venues in and around Austin, Texas
**Target Users:** Karaoke enthusiasts looking for venues, schedules, and event details
**Live Site:** https://www.karaokedirectory.com
**Analytics:** Microsoft Clarity (project ID `x1sfnv6zu4`) — see snippet before `</body>` on all public HTML pages

## Architecture

### 1. Stack
- **Vanilla JavaScript** (ES6 modules) for the application code
- **HTML5 + CSS3** for structure and styling
- **Leaflet.js** for the map view
- **Font Awesome** for icons
- Currently no build step — files served as-is

### 2. Mobile-First Responsive Design
- Base styles target mobile devices
- Media queries enhance for larger screens (768px, 1024px, 1400px breakpoints)
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
- All venue data in `js/data.js` (currently 79 venues) — the active runtime source, plus canonical authoring source
- Supabase wiring exists (`js/services/supabase.js`, JSONB-heavy 2-table schema in `supabase/migrations/`) but is currently **disabled** via `useSupabase: false` in `js/config.js`. See spec §11 *Storage and Data Flow*.
- Service layer abstracts data access (`js/services/venues.js`) — data-source agnostic, so the swap is a one-flag change
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
├── CLAUDE.md              # THIS FILE - Claude project memory
├── README.md              # Public documentation
├── index.html             # Main SPA (heavily commented)
├── about.html             # About page
├── bingo.html             # Karaoke bingo game
├── submit.html            # Venue submission form (mobile-first, single-flow)
├── editor.html            # Venue data editor tool
│
├── css/
│   ├── base.css           # CSS variables, reset, typography (ALWAYS FIRST)
│   ├── layout.css         # Header, nav, footer, page structure
│   ├── components.css     # Buttons, cards, modals, forms
│   ├── views.css          # View-specific styles (weekly, map, etc.)
│   ├── bingo.css          # Bingo game styles (extends components)
│   ├── editor.css         # Editor page styles (extends components)
│   ├── submit.css         # Submission form styles (extends components)
│   └── snowflakes.css     # Seasonal snowfall animation (disabled, commented out in index.html)
│
├── js/
│   ├── app.js             # Application entry point
│   ├── data.js            # Venue database (DO NOT COMMIT SECRETS)
│   ├── bingo.js           # Bingo game logic
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
│   │   └── VenueDetailPane.js  # Desktop venue detail sidebar
│   │
│   ├── views/
│   │   ├── WeeklyView.js      # 7-day calendar view
│   │   ├── AlphabeticalView.js # A-Z venue listing
│   │   └── MapView.js         # Leaflet.js map view
│   │
│   ├── services/
│   │   ├── venues.js      # Venue data operations, search, filtering (data-source agnostic)
│   │   └── supabase.js    # Supabase client + fetchVenueData() — runtime source
│   │
│   ├── config.js          # App config (Supabase URL/key, useSupabase feature flag)
│   │
│   └── utils/
│       ├── date.js        # Date formatting, schedule matching
│       ├── debug.js       # Debug mode utilities
│       ├── render.js      # Shared rendering (schedule table, host section, active period)
│       ├── string.js      # Text manipulation, escaping
│       ├── tags.js        # Venue tag rendering and configuration
│       ├── url.js         # URL building, sanitization
│       └── validation.js  # Form validation
│
├── editor/
│   └── editor.js          # Venue editor functionality
│
├── scripts/               # Developer tools
│   ├── geocode-venues.js  # Add coordinates to venues
│   ├── validate-data.js   # Validate venue data integrity
│   └── audit-for-supabase.js  # Pre-seed validation against logical rules
│
├── supabase/              # Supabase schema + seed pipeline
│   ├── migrations/        # SQL migrations (001–004; 004 is the current JSONB schema)
│   ├── seed-from-data.js  # Generates seed.sql from js/data.js
│   └── seed.sql           # Generated INSERT statements for venues + tags
│
├── assets/images/         # Static images
│
├── docs/
│   ├── index.html         # Docsify documentation viewer
│   ├── functional-spec.md # Functional Specification (authoritative)
│   ├── _sidebar.md        # Docsify sidebar navigation
│   └── .nojekyll          # GitHub Pages underscore file support
│
└── _deprecated/           # Archived old code (do not use)
```

## Venue Data Format

When adding or modifying venues in `js/data.js`, follow this structure:

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
      eventUrl: "https://..." // Optional: link to event page
    },
    {
      frequency: "once",      // One-time special event
      date: "2026-03-15",     // Specific date (YYYY-MM-DD)
      startTime: "20:00",
      endTime: "23:00",
      eventName: "Event Name", // Optional: display name for the event
      eventUrl: "https://..."  // Optional: link to event page
    }
  ],
  activePeriod: {             // Optional: limits when venue appears
    start: "2026-06-01",      // Venue only appears within this range
    end: "2026-08-31"
  },
  host: {                     // Optional
    name: "KJ Name",
    company: "Company Name",
    website: "https://..."    // Optional: host/KJ website
  },
  socials: {                  // All optional
    website: "https://...",
    facebook: "https://facebook.com/...",
    instagram: "https://instagram.com/...",
    twitter: "https://twitter.com/...",
    tiktok: "https://tiktok.com/...",
    youtube: "https://youtube.com/...",
    bluesky: "https://bsky.app/..."
  }
}
```

### Venue Tags

Tags are defined in `tagDefinitions` at the top of `js/data.js`. Each tag has:
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
- `venues.js` → `venueMatchesSearch()` matches: name, city, neighborhood, host, tags (ID + label), event names
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
| editor.html | base, layout, components, editor |
| bday.html | base, layout, components (inline `<style>` for the rest) |

Enforced by `scripts/check-css-load-order.js` — run it before merging any change that touches `<link>` tags. Exits non-zero on violation.

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
1. Edit `js/data.js` (or use the venue editor at `editor.html`)
2. Add venue object to `listings` array
3. Run `scripts/validate-data.js` to check format
4. Add coordinates using the "Geocode Address" button in the editor, or via `scripts/geocode-venues.js` (Node.js batch)

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

| Milestone | Spec Sections | Description |
|-----------|---------------|-------------|
| Documentation Portal | — | Documentation site navigation and landing pages |
| Exclusion Dates | — (future) | Venue closure/exclusion dates feature |
| Form Parity | 15 | Submit form UX (intentionally a slim subset of editor; curator handles the rest) |
| Weekly Calendar View | 2, 13 | Weekly schedule grid, day cards, schedule matching |
| Alphabetical View | 3 | A-Z venue listing |
| Map View | 4 | Interactive Leaflet map, immersive mode |
| Search & Filtering | 9, 10 | Global search, extended search, dedicated filter |
| Venue Cards & Detail | 6, 7, 8 | Compact/full cards, mobile modal, desktop pane |
| Navigation & Layout | 5, 19 | Nav controls, responsive design, week navigation |
| Venue Data & Tags | 11, 12 | Data model, tag system |
| Venue Editor | 16 | Editor tool with live preview and geocoding |
| Karaoke Bingo | 14 | Bingo game |
| Supabase Migration | — | Schema + parallel data source (see ADR-001, ADR-004) |
| About & Infrastructure | 17, 18, 20, 21 | About page, debug mode, security, state management |

### Architecture Decisions

ADRs live in [`docs/adr/`](docs/adr/). See the [index](docs/adr/README.md) for the running list. Format and threshold rule documented in [sdlc-baseline `docs/adrs.md`](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/adrs.md).

Current ADRs:
- [ADR-001](docs/adr/001-supabase-schema-jsonb.md) — Supabase schema: JSONB venues over normalized relational
- [ADR-002](docs/adr/002-vanilla-js-no-build.md) — Vanilla JS, no framework, no build step
- [ADR-003](docs/adr/003-github-pages-deploy.md) — GitHub Pages as deploy target
- [ADR-004](docs/adr/004-parallel-data-source-flag.md) — Parallel data source via URL flag

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

*Last updated: February 2026*
*Maintained by: Project contributors and Claude Code sessions*
