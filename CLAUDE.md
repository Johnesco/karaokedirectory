# Austin Karaoke Directory - Claude Project Memory

> This file serves as persistent context for Claude Code sessions. It is automatically read at the start of every conversation. Keep this document updated as the project evolves.

## Project Identity

**Name:** Austin Karaoke Directory
**Purpose:** A mobile-friendly web application helping users discover karaoke venues in and around Austin, Texas
**Target Users:** Karaoke enthusiasts looking for venues, schedules, and event details
**Live Site:** [Add deployment URL when available]

## Core Philosophy & Design Principles

### 1. No Framework, By Design
- **Vanilla JavaScript only** - No React, Vue, Angular, etc.
- Keeps the codebase educational, lightweight, and easy to understand
- No build step required - edit and refresh
- All patterns are explicit, not hidden behind framework "magic"

### 2. Mobile-First Responsive Design
- Base styles target mobile devices
- Media queries enhance for larger screens (768px, 1024px, 1400px breakpoints)
- Modal for venue details on mobile, side pane on desktop (1400px+)

### 3. Separation of Concerns
- **HTML:** Structure only (`index.html`, `about.html`, etc.)
- **CSS:** Styling only (`css/` folder with modular files)
- **JavaScript:** Behavior only (`js/` folder with ES6 modules)

### 4. Component-Based Architecture
- Custom lightweight `Component` base class (`js/components/Component.js`)
- State management via simple observer pattern (`js/core/state.js`)
- Event bus for component communication (`js/core/events.js`)

### 5. Data-Driven
- All venue data in `js/data.js` (currently 70+ venues)
- Service layer abstracts data access (`js/services/venues.js`)
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
│       ├── chore.yml      # Refactors, deps, tooling template
│       └── doc.yml        # Documentation-only changes template
├── CLAUDE.md              # THIS FILE - Claude project memory
├── README.md              # Public documentation
├── index.html             # Main SPA (heavily commented)
├── about.html             # About page
├── bingo.html             # Karaoke bingo game
├── submit.html            # Venue submission form
├── editor.html            # Venue data editor tool
├── codeexplained.html     # Interactive code documentation
│
├── css/
│   ├── base.css           # CSS variables, reset, typography (ALWAYS FIRST)
│   ├── layout.css         # Header, nav, footer, page structure
│   ├── components.css     # Buttons, cards, modals, forms
│   ├── views.css          # View-specific styles (weekly, map, etc.)
│   ├── bingo.css          # Bingo game styles (extends components)
│   ├── editor.css         # Editor page styles (extends components)
│   ├── submit.css         # Submission form styles (extends components)
│   └── docs.css           # Documentation page styles (codeexplained.html)
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
│   │   └── venues.js      # Venue data operations, search, filtering
│   │
│   └── utils/
│       ├── date.js        # Date formatting, schedule matching
│       ├── debug.js       # Debug mode utilities
│       ├── render.js      # Shared rendering (schedule table, host section, date range)
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
│   └── validate-data.js   # Validate venue data integrity
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
  dateRange: {                // Optional: for seasonal venues
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

### State Management
```javascript
import { getState, setState, subscribe } from './core/state.js';

// Read state
const currentView = getState('view');

// Update state (triggers subscribers)
setState({ view: 'alphabetical' });

// Subscribe to changes
subscribe('view', (newView) => console.log('View changed:', newView));
```

### Event Bus
```javascript
import { emit, on, Events } from './core/events.js';

// Emit event
emit(Events.VENUE_SELECTED, venueData);

// Listen for event
on(Events.VENUE_SELECTED, (venue) => showDetails(venue));
```

### Component Lifecycle
1. `constructor(container, props)` - Setup
2. `init()` - Initialize state, subscriptions
3. `template()` - Return HTML string
4. `render()` - Inject template into container
5. `afterRender()` - Attach event listeners
6. `destroy()` - Cleanup subscriptions and listeners

### Immersive Map Mode
The map view uses a full-screen immersive mode with floating controls:

**How it works:**
- `app.js` adds `body.view--map` class when map view is active
- CSS in `views.css` hides header/footer/nav and makes map fill viewport
- MapView renders floating controls inside its template
- VenueModal checks `getState('view') === 'map'` and skips opening

**Floating UI elements:**
- `.map-controls` - Left side, contains dedicated venue toggle button
- `.map-view-switcher` - Right side, Calendar/A-Z buttons to exit
- `.map-venue-card` - Floating card for venue details (replaces modal)

**User interactions:**
- Click marker → floating card appears, map pans to marker
- Click map background → card dismisses
- Press Escape → closes card (if open) or exits to Calendar view
- Click "Details" → exits to Calendar and opens full modal

### Search Feature
The app includes a global search bar that filters venues across all views:

**How it works:**
- Search input in Navigation component updates `searchQuery` state
- All views listen for `FILTER_CHANGED` events and re-render
- `venues.js` provides `venueMatchesSearch()` for filtering logic
- Search does not cause Navigation re-render (preserves input focus)

**Search matches against:**
- Venue name
- City and neighborhood
- Host name and company
- Tag IDs (e.g., "lgbtq", "dive") and labels (e.g., "LGBTQ+", "Dive Bar")
- "dedicated" keyword for dedicated karaoke venues
- Event names (for special one-time events)

**UI behavior:**
- Clear button appears when search has text
- Empty results show contextual message
- Day cards with no matching venues collapse to header-only
- Extended sections appear below current week (Next Week, This Month, Next Month)

### Extended Sections
The Weekly view always shows extended sections beyond the current week:

**How it works:**
- `ExtendedSection` component (`js/components/ExtendedSection.js`) renders collapsible day card sections
- Date range helpers in `js/utils/date.js`: `getNextWeekRange()`, `getThisMonthRange()`, `getNextMonthRange()`
- Sections: "Next Week", "Later in [Month]", "[Next Month]" (up to 60 days)
- Deduplication: "This Week" and "Next Week" show all matches; later sections skip already-seen venues
- Collapse state persists in `localStorage` (`extendedSection_{title}_collapsed`)

**CSS classes:**
- `.extended-section` - Container for extended section
- `.extended-section__header` - Clickable header with title, count badge, toggle button
- `.extended-section__content` - Day cards container
- `.extended-section--collapsed` - Hides content when collapsed

### Day Card States
Day cards in the weekly view have multiple visual states controlled by CSS classes:

| Class | Behavior |
|-------|----------|
| `.day-card--today` | Purple border highlight for current day |
| `.day-card--past` | Collapsed (header only), dimmed, click to expand |
| `.day-card--empty` | Collapsed (header only), dimmed - no venues match filters/search |
| `.day-card--expanded` | Modifier for past days that have been clicked to expand |

**State combinations:**
- Past + Empty: Shows collapsed, can still expand but content will be empty
- Today + Empty: Shows collapsed with purple border (search filtered out all venues)
- Past days default to collapsed; clicking header toggles expansion

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
| codeexplained.html | base, layout, components, docs |

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

## Current Feature Status

### Implemented
- [x] Weekly calendar view with 7-day schedule
- [x] Alphabetical A-Z venue listing
- [x] Interactive map with Leaflet.js (immersive full-screen mode)
- [x] Venue detail modal (mobile) and side pane (desktop)
- [x] Dedicated venue filter
- [x] Week navigation (prev/next/today)
- [x] Venue tagging system with 19 color-coded badges
- [x] Global search (filters by name, city, neighborhood, host, tags)
- [x] Collapsible empty day cards (space-efficient when filtering)
- [x] Special events support (one-time events with dates and event links)
- [x] Seasonal/date range support for temporary venues
- [x] Karaoke bingo game
- [x] Venue submission form
- [x] Venue editor tool with live preview and tag management
- [x] Address geocoding in editor (Nominatim/OpenStreetMap API)
- [x] Comprehensive code documentation (codeexplained.html)
- [x] Debug mode for schedule troubleshooting (?debug=1)
- [x] Shared rendering utilities (render.js) for schedule tables, host sections, date ranges

### Potential Future Enhancements
- [ ] Tag-based quick filter buttons (clickable tag chips)
- [ ] User favorites (localStorage)
- [ ] Share venue links
- [ ] PWA offline support
- [ ] Backend API for submissions
- [ ] User accounts and reviews

## Project History

### Recent Changes
- **2026-02**: Fixed geocoding CORS bug in venue editor (#29)
  - US Census Geocoder API does not support CORS for browser fetch requests
  - Replaced with Nominatim (OpenStreetMap) Geocoder API (free, CORS-enabled)
  - Ecosystem-aligned: project already uses Leaflet.js with OpenStreetMap tiles
  - Node.js batch script (`scripts/geocode-venues.js`) unchanged (not affected by CORS)
- **2026-02**: Backported sdlc-baseline enhancements (#26)
  - Enhanced `feature.yml`: added Test Plan, Size (replaces Complexity), Documentation Impact fields
  - Enhanced `bug.yml`: added Steps to Reproduce, Severity dropdown, Environment field; expanded DoD
  - Added `chore.yml` template for refactors, deps, tooling
  - Added `doc.yml` template for documentation-only changes
  - Added `config.yml` to disable blank issues
  - Added `.github/PULL_REQUEST_TEMPLATE.md` with doc and testing checklists
  - Added Roles and Responsibilities section (PO/BA/Dev/Documenter/QA with board column ownership)
  - Added "Claude cannot QA its own work" as explicit rule with hat-switch protocol
  - Added Step Compression guidance (when/how to compress steps 2-4 for small changes)
  - Added Branch Naming conventions (type/description format)
  - Added Severity and Priority matrix (4-level severity → 2 priority labels)
  - Updated Board Column descriptions to be more descriptive
  - Aligned workflow section wording with sdlc-baseline CLAUDE-TEMPLATE.md
  - Source: https://github.com/Johnesco/sdlc-baseline
- **2026-02**: Added technical depth to documentation (#22)
  - Created `docs/architecture.md` — visual architecture reference with Mermaid.js diagrams (module dependencies, component hierarchy, data flow, event lifecycle, state management, CSS architecture)
  - Created `docs/patterns.md` — code pattern cookbook with 10 annotated recipes (add venue, add view, add component, add tag, add event, read/write state, add schedule frequency, add social platform, style BEM component, add utility function)
  - Added 8 implementation note blockquotes to `docs/functional-spec.md` (sections 2, 3, 4, 6, 7, 9, 13, 21)
  - Added Mermaid.js plugin to Docsify portal (`docs/index.html`)
  - Updated sidebar navigation (`docs/_sidebar.md`) with links to new documents
- **2026-02**: Unified frequency label and "+N more" into `getScheduleContext()` (#30)
  - Extracted frequency label + "+N more" logic from `VenueCard.compactTemplate()` into `getScheduleContext()` in `js/utils/render.js`
  - Single function takes venue + matched schedule entry, returns `{ frequencyLabel, moreCount, moreText }`
  - VenueCard now imports and destructures result instead of inline logic
  - No visual change to rendered output
- **2026-02**: Added "+N more" indicator to compact venue cards (#21)
  - When a venue has multiple schedule entries, compact cards show "+N more" below the time line
  - Count logic: `N = venue.schedule.length - 1` (all other entries including recurring and one-time)
  - Muted, italic text with calendar-days icon, styled as `.venue-card__more-nights`
  - Only shown when `showSchedule` is true and N > 0; singular/plural handled
  - Works in day cards, extended sections, and map floating card
- **2026-02**: Always-visible extended sections and component rename (#17, #18, #19, #20)
  - Extended sections (Next Week, Later in Month, Next Month) now always visible in Weekly view, not just during search
  - Renamed `SearchSection` component to `ExtendedSection` (file, exports, CSS classes, localStorage keys)
  - localStorage key migration from `searchSection_*` to `extendedSection_*` on module load
  - Updated functional spec Section 2 with Extended Sections subsection, rewrote Section 9 reference
  - Updated README.md Weekly Calendar View feature description
- **2026-02**: Added frequency labels to venue cards and dedup notice to search sections (#16)
  - Compact venue cards now show frequency + day before time: "Every Friday · 9:00 PM - 1:00 AM"
  - Uses `formatScheduleEntry()` from `js/utils/date.js` with `showEvery: true`
  - Frequency label wrapped in `.venue-card__frequency` span (muted color via CSS)
  - Skipped for `frequency: "once"` events (they already have event name line)
  - Extended search sections with deduplication now show "Plus X recurring venues already shown above"
  - `countVenuesInRange()` in `ExtendedSection.js` tracks `dedupedCount` alongside `count`
  - Dedup notice styled as `.extended-section__dedup-notice` (muted, centered, italic)
- **2026-02**: Fixed submit form schedule section overflow on desktop (#15)
  - `.schedule-entry` grid columns changed from `1fr` to `minmax(0, 1fr)` to prevent content overflow
  - Added `min-width: 0` on schedule form groups and `overflow: hidden` on `.submit-form` and `.form-section`
  - Schedule inputs constrained with `width: 100%` and `box-sizing: border-box`
- **2026-02**: Migrated project management from Taiga to GitHub Issues + Projects
  - All work items tracked as GitHub Issues with labels, milestones, and Projects board
  - Issue templates (`.github/ISSUE_TEMPLATE/`) enforce documentation-first workflow (feature, bug, chore, docs + config)
  - PR template (`.github/PULL_REQUEST_TEMPLATE.md`) with doc and testing checklists
  - 12 labels: 4 type (`feature`, `bug`, `docs`, `chore`), 7 area, 2 priority
  - 3 milestones: Documentation Portal, Exclusion Dates, Form Parity
  - Projects board with 6 columns: Backlog, Refining, Ready, In Progress, Verify, Done
  - Commit convention changed from `Taiga #XX` to `#XX` (GitHub issue numbers)
  - `Fixes #XX` in PR body auto-closes issues on merge
- **2026-02**: Added extended sections in Weekly view
  - New `ExtendedSection` component (`js/components/ExtendedSection.js`)
  - Shows "Next Week", "Later in [Month]", and "[Next Month]" sections always (not just during search)
  - Date range helpers in `js/utils/date.js`: `getNextWeekRange()`, `getThisMonthRange()`, `getNextMonthRange()`, `getDateRange()`, `getMonthName()`
  - Collapsible sections with localStorage persistence
  - Deduplication: recurring venues only shown once across sections
  - CSS styles for `.extended-section` in `css/views.css`
- **2026-02**: Created Functional Specification and documentation portal
  - `docs/functional-spec.md` — authoritative spec covering all 23 feature areas
  - `docs/index.html` — Docsify-powered viewer (CDN, no build step, dark theme)
  - Custom slugify in Docsify config to match GitHub heading ID algorithm
  - Sidebar navigation via `_sidebar.md`, full-text search plugin
  - Documentation-First Workflow added to CLAUDE.md (mandatory for all changes)
  - Resolved 3 doc-code discrepancies: breakpoint 1200→1400px, added bluesky social, standardized day name casing
  - Added Related Documentation section to `codeexplained.html`
- **2026-02**: Added geocode button to venue editor
  - Replaced Node.js script hint with in-browser "Geocode Address" button
  - Uses Nominatim (OpenStreetMap) Geocoder API (free, public, CORS-enabled)
  - Reads address fields, populates lat/lng, shows status feedback
  - Function `geocodeAddress()` in `editor/editor.js`, exposed to global scope
  - CSS `.geocode-row` in `css/editor.css`
- **2025**: Added special events support ("once" frequency)
  - Schedule entries with `frequency: "once"` for one-time events
  - `date` field for specific dates, `eventName` for display label
  - `eventUrl` field for linking to event pages (works on all frequencies)
  - `special-event` tag added to tagDefinitions
  - Special events sort to top of daily listings in WeeklyView
  - Editor supports all "once" fields (date picker, event name, event URL)
- **2025**: Added date range support for seasonal venues
  - `dateRange` field with `start` and `end` date strings
  - Venues only appear within their active date range
  - Editor includes season start/end date inputs
  - `formatDateRangeText()` in date.js, `renderDateRange()` in render.js
- **2025**: Added shared rendering utilities (`js/utils/render.js`)
  - `renderScheduleTable()` for venue detail schedule display
  - `renderHostSection()` for host/KJ display with website and socials
  - `renderDateRange()` for date range notices
  - `formatHostDisplay()` for compact host lines in cards
  - Used by VenueModal and VenueDetailPane
- **2025**: Added TikTok and YouTube social platform support
  - `socials.tiktok` and `socials.youtube` fields in venue data
  - Editor form fields for both platforms
  - Icons rendered via `createSocialLinks()` in url.js
- **2025**: Added host website field
  - `host.website` field for KJ/host personal website
  - Displayed in venue detail views and editor
- **2025**: Added tag definitions editor in venue editor
  - Add, modify, and remove tag definitions in sidebar
  - Color pickers for background and text colors
  - Changes propagate to tag selector and preview
- **2025-01**: Added global search functionality
  - Search input in Navigation component with clear button
  - Filters venues by name, city, neighborhood, host, company, and tags
  - Search by tag ID or label (e.g., "lgbtq" or "LGBTQ+")
  - All views (Weekly, Alphabetical, Map) respond to search
  - State managed via `searchQuery` in state.js
  - CSS in `css/components.css` (.search-input styles)
- **2025-01**: Added collapsible empty day cards
  - Days with no venues (due to schedule or search filters) collapse to header-only
  - Reduces vertical space when searching with few results
  - CSS class `.day-card--empty` controls collapsed state
- **2025-01**: Expanded venue tagging system
  - Added tags: restaurant, outdoor, billiards, brewery, games, craft-cocktails, neighborhood
  - Integrated "dedicated" badge into tag system (renders via `renderTags()`)
  - Tags searchable by ID or display label
- **2025-01**: Added immersive full-screen map mode
  - Map takes 100% viewport, hides header/footer/navigation
  - Floating controls: view switcher (top-right), dedicated filter toggle (top-left)
  - Floating venue card replaces modal (slide-in animation)
  - Escape key support: closes card first, then exits map view
  - Body class `view--map` controls immersive styling
  - CSS in `css/views.css` (immersive map section)
- **2025-01**: Added venue tagging system with color-coded badges
  - Tag definitions in `js/data.js` (tagDefinitions object)
  - Tag rendering utility in `js/utils/tags.js`
  - Tags display in VenueCard, VenueModal, and VenueDetailPane
  - CSS styles in `css/components.css` (.venue-tags, .venue-tag)
- **2025-01**: Added debug mode with visual overlay (`?debug=1`)
- **2025-01**: Created `js/utils/debug.js` for debug utilities
- **2025-01**: Standardized CSS loading across all pages for consistency
- **2025-01**: Created `css/docs.css` - moved inline styles from codeexplained.html
- **2025-01**: Added components.css to bingo.html and editor.html
- **2025-01**: Added CLAUDE.md for persistent project memory
- **2024**: Added Raggedy Anne's venue
- **2024**: Added comprehensive documentation to index.html
- **2024**: Created codeexplained.html documentation page
- **2024**: Implemented dual-pane layout for 1400px+ screens
- **2024**: Various style updates and corner refinements

### Architecture Decisions
1. **Vanilla JS chosen** to keep educational value and avoid framework overhead
2. **ES6 modules** for code organization without bundler
3. **Custom state management** instead of Redux for simplicity
4. **Leaflet.js** for maps (open source, no API key required)
5. **Font Awesome CDN** for icons (easy updates, no local assets)
6. **Docsify** for documentation portal (CDN-loaded, no build step, renders markdown directly)
7. **Ticket-First, Documentation-Aware Workflow** — Every change starts as a GitHub Issue; Functional Specification is the single source of truth; every change must update it

<!-- ============================================================
     SDLC WORKFLOW
     This section is universal across all projects using the
     sdlc-baseline process. Keep in sync with CLAUDE-TEMPLATE.md.

     Source: https://github.com/Johnesco/sdlc-baseline
     ============================================================ -->

## Instructions for Claude

### Roles and Responsibilities

| Role | Owner | Board Columns | Key Rule |
|------|-------|---------------|----------|
| **PO** (Product Owner) | Human | Backlog, Done | Decides priority, accepts work |
| **BA** (Business Analyst) | Human or Claude | Refining, Ready | Scopes tickets, writes acceptance criteria |
| **Dev** (Developer) | Claude (primary) | In Progress | Writes code, follows conventions |
| **Documenter** | Claude (bundled with Dev) | In Progress | Updates spec, CLAUDE.md, README |
| **QA** (Quality Assurance) | **Human (always)** | **Verify** | Verifies completed work |

> **The most important rule: Claude cannot QA its own work.** The Verify column is always human-owned. The person or AI that wrote the code is not qualified to verify it.

**Hat-switch protocol:** When working with Claude, explicitly state which role you're in to keep the interaction predictable:
- `"PO hat — let's prioritize the backlog."`
- `"BA mode — help me scope this feature."`
- `"Dev time — implement ticket #12."`
- `"QA check — I'm testing what you built."`

### Ticket-First, Documentation-Aware Workflow (MANDATORY)

Every software change — feature, bug fix, refactor, or data update — follows this sequence. No step may be skipped.

The **Functional Specification** (`docs/functional-spec.md`) is the authoritative record of all application features, behavior, and data formats. It is the single source of truth for what this application does.

**Before ANY change**, follow these steps in order:

1. **Capture as a ticket** — Create a GitHub Issue describing the change before any other work begins. Include a clear title, relevant labels, acceptance criteria, and an associated **milestone**. Every issue must belong to an existing milestone by the time it ships; if no existing milestone fits, create a new one. No code is written without a ticket.

   > **IMPORTANT — Add to Project Board:** After creating the issue, you **must** also add it to the GitHub Projects board. The `gh issue create` command does **NOT** auto-add issues to the project board. Run this immediately after creating the issue:
   > ```
   > gh project item-add 1 --owner Johnesco --url [ISSUE_URL]
   > ```
   > An issue that is not on the board is considered incomplete. This is a known gotcha — do not skip this step.

2. **Review documentation for affected areas** — Read the sections of the Functional Specification (and other docs like CLAUDE.md, README.md) that describe the area being changed. Identify what exists, what will be impacted, and note any discrepancies.

3. **Flag discrepancies** — If existing code already differs from what the documentation says, stop and flag the mismatch for validation before proceeding. Do not silently "fix" documentation to match code or vice versa without explicit confirmation.

4. **Refine the ticket** — Based on the documentation review, update the GitHub Issue with additional context, affected doc sections, and a plan for documentation updates. The ticket should reflect the full scope of work including doc changes.

5. **Implement the change** — Write the code. Reference the ticket number (`#XX`) in commits.

6. **Update all documentation** — Update the Functional Specification, CLAUDE.md, README.md, and any other affected docs so they accurately reflect the new state. This is not optional — a change is not complete until its documentation is current.

7. **Verify consistency** — After updating, confirm that the documentation and code are in agreement. Any remaining gaps must be called out explicitly.

**Key rules:**
- No code without a ticket — every change starts as a GitHub Issue
- A change without a corresponding documentation update is considered **incomplete**
- Documentation updates are part of the definition of done, not a follow-up task
- When in doubt about whether docs need updating, they do
- The Functional Specification is the primary document; CLAUDE.md and README.md are secondary but must stay consistent

### Compressing Steps for Small Changes

Not every change needs the full ceremony. Here's when you can compress:

- **Data-only changes** (adding a venue, fixing a typo): Steps 2-4 can compress into a quick scan. Still need a ticket (Step 1) and human verification (Step 7).
- **Bug fixes with obvious cause**: Step 2 becomes "confirm the spec describes the expected behavior." Steps 3-4 can compress into a single issue comment.
- **Documentation-only changes**: Step 5 becomes "edit the docs" instead of "write code." Step 6 is the main deliverable.
- **When NOT to compress**: New features, changes affecting multiple files, changes where you're unsure about existing behavior, anything that modifies user-facing behavior.

### When Making Changes
1. **Ticket first** — Follow the workflow above before all else
2. **Read before editing** — Always read files before modifying them
3. **Follow existing patterns** — Match the coding style already in use
4. **Keep it simple** — This project intentionally avoids over-engineering
5. **Test responsively** — Changes should work on mobile and desktop

### Maintaining Documentation

**UPDATE the Functional Specification** (`docs/functional-spec.md`) when you:
- Add, modify, or remove any feature
- Fix a bug that changes observable behavior
- Change data formats or venue fields
- Alter UI behavior, states, or interactions
- Modify search, filtering, or navigation logic

**UPDATE CLAUDE.md** when you:
- Add new features or pages
- Change the file structure
- Modify architectural patterns
- Add new venue data fields
- Make significant design decisions

**UPDATE README.md** when changes affect:
- Public-facing feature descriptions
- Setup or usage instructions
- Project overview or screenshots

### Security Considerations
- Always use `escapeHtml()` when rendering user-provided content
- Use `sanitizeUrl()` for any URLs before rendering
- Never store API keys or secrets in code
- Validate all form inputs

## Development Workflow

### GitHub Issues & Projects

All work is tracked in **GitHub Issues** with a **GitHub Projects** kanban board.

- **Issues** = All work items (features, bugs, docs, chores)
- **Labels** = Type (`feature`, `bug`, `docs`, `chore`) + Area (`area:frontend`, `area:data`, etc.) + Priority (`priority:high`, `priority:low`)
- **Milestones** = Major feature areas aligned to Functional Spec sections (replace Taiga epics). Every issue must have a milestone by the time it ships. If no existing milestone fits, create a new one.
- **Projects board** = Visual kanban for tracking status

### Milestones

| Milestone | Spec Sections | Description |
|-----------|---------------|-------------|
| Documentation Portal | — | Documentation site navigation and landing pages |
| Exclusion Dates | — (future) | Venue closure/exclusion dates feature |
| Form Parity | 15 | Bring submit form to parity with editor |
| Weekly Calendar View | 2, 13 | Weekly schedule grid, day cards, schedule matching |
| Alphabetical View | 3 | A-Z venue listing |
| Map View | 4 | Interactive Leaflet map, immersive mode |
| Search & Filtering | 9, 10 | Global search, extended search, dedicated filter |
| Venue Cards & Detail | 6, 7, 8 | Compact/full cards, mobile modal, desktop pane |
| Navigation & Layout | 5, 19 | Nav controls, responsive design, week navigation |
| Venue Data & Tags | 11, 12 | Data model, tag system |
| Venue Editor | 16 | Editor tool with live preview and geocoding |
| Karaoke Bingo | 14 | Bingo game |
| About & Infrastructure | 17, 18, 20, 21 | About page, debug mode, security, state management |

### Board Columns

| Column | What's Here |
|--------|-------------|
| **Backlog** | Captured but not yet scoped |
| **Refining** | Defining scope and requirements |
| **Ready** | Acceptance criteria finalized, ready to build |
| **In Progress** | Actively being coded |
| **Verify** | Code complete, awaiting human testing |
| **Done** | Verified and accepted |

### Board Automations (GitHub Projects Workflows)

These transitions are handled automatically by GitHub Projects:

| Trigger | Sets Status To |
|---------|---------------|
| Item added to project | **Backlog** |
| Item reopened | **In Progress** |
| Item closed | **Done** |
| Pull request merged | **Done** |

These transitions are **manual** and must be set during the workflow:

| Transition | When to Move |
|------------|-------------|
| Backlog → Refining | When scoping/discussing the issue |
| Refining → Ready | When acceptance criteria are finalized |
| Ready → In Progress | When coding begins |
| In Progress → Verify | When code is complete, awaiting testing |

### Commit Convention

```
#XX: description
```

Where `XX` is the GitHub Issue number. Use `Fixes #XX` in PR body for auto-close.

### Branch Naming

```
[type]/[short-description]
```

| Prefix | Use for |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `chore/` | Refactors, tooling, dependencies |

Use lowercase and hyphens. Include issue number if helpful: `feature/12-avatar-upload`. Solo projects can commit to main freely — branch when changes need review or span multiple sessions.

### Severity and Priority

Bug severity maps to priority labels:

| Severity | Priority Label | Response |
|----------|---------------|----------|
| **Critical** — System down or data at risk | `priority:high` | Fix immediately |
| **High** — Feature broken, no workaround | `priority:high` | Fix before new features |
| **Medium** — Works but with issues | *(no label)* | Normal backlog order |
| **Low** — Cosmetic or minor inconvenience | `priority:low` | Fix when convenient |

The PO can override the default mapping when business context warrants it (e.g., a low-severity typo on a landing page may still be `priority:high`).

### Idea to Ship Cycle

| Phase | What Happens |
|-------|--------------|
| **Capture** | `gh issue create` + add to project board |
| **Refine** | Discussion in issue comments, spec it out |
| **Build** | PR with `Fixes #XX`, branch + implementation |
| **Verify** | PR includes spec updates, human reviews |
| **Ship** | Merge PR → issue auto-closes → board updates |

<!-- ============================================================
     END SDLC WORKFLOW
     Everything below this line is project-specific.
     ============================================================ -->

## Related Documentation

- `docs/functional-spec.md` - **Functional Specification (authoritative)** — Complete record of all features, behavior, and data formats. Must be updated with every change.
- `docs/architecture.md` - **Architecture Reference** — Mermaid.js diagrams covering module dependencies, component hierarchy, data flow, event lifecycle, state management, and CSS architecture.
- `docs/patterns.md` - **Code Pattern Cookbook** — 10 annotated recipes for common implementation tasks (add venue, add view, add component, add tag, etc.).
- `README.md` - Public-facing project documentation
- `codeexplained.html` - Interactive beginner's guide to the codebase
- Inline comments in `index.html` - Extensive HTML documentation
- JSDoc comments in JavaScript files

---

*Last updated: February 2026*
*Maintained by: Project contributors and Claude Code sessions*
