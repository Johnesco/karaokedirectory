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
- Media queries enhance for larger screens (768px, 1024px, 1200px breakpoints)
- Modal for venue details on mobile, side pane on desktop (1200px+)

### 3. Separation of Concerns
- **HTML:** Structure only (`index.html`, `about.html`, etc.)
- **CSS:** Styling only (`css/` folder with modular files)
- **JavaScript:** Behavior only (`js/` folder with ES6 modules)

### 4. Component-Based Architecture
- Custom lightweight `Component` base class (`js/components/Component.js`)
- State management via simple observer pattern (`js/core/state.js`)
- Event bus for component communication (`js/core/events.js`)

### 5. Data-Driven
- All venue data in `js/data.js` (currently 69+ venues)
- Service layer abstracts data access (`js/services/venues.js`)
- Schedule matching logic handles complex recurrence patterns

## File Structure Overview

```
karaokedirectory/
├── CLAUDE.md              # THIS FILE - Claude project memory
├── README.md              # Public documentation
├── index.html             # Main SPA (heavily commented)
├── about.html             # About page
├── bingo.html             # Karaoke bingo game
├── submit.html            # Venue submission form
├── editor.html            # Venue data editor tool
├── codeexplained.html     # Interactive code documentation
│
├── tests/                 # Test suite (not linked from site)
│   ├── index.html         # Visual test runner
│   └── schedule-tests.js  # Schedule matching tests
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
    youtube: "https://youtube.com/..."
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

### Test Suite
Open `tests/index.html` in a browser to run the test suite. Tests cover:
- Schedule matching logic (`scheduleMatchesDate()`)
- Date utilities (week calculations, formatting)
- Venue filtering and sorting

### Debug Mode
Enable debug mode to see why venues appear on specific dates:
1. Add `?debug=1` to the URL (e.g., `index.html?debug=1`)
2. Or run in console: `localStorage.setItem('debug', '1')`

When enabled:
- A "Debug Mode" indicator appears in the top-right corner
- Venue cards show their schedule match reason (e.g., "Every Friday", "First Saturday")
- Hover over cards for detailed match info

### Interactive Date Tester
The test page includes a date picker to check which venues appear on any date and why.

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
- [x] Address geocoding in editor (US Census Geocoder API)
- [x] Comprehensive code documentation (codeexplained.html)
- [x] Test suite for schedule verification (tests/index.html)
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
- **2026-02**: Added geocode button to venue editor
  - Replaced Node.js script hint with in-browser "Geocode Address" button
  - Uses US Census Geocoder API (free, public, CORS-enabled)
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
- **2025-01**: Added test suite (`tests/index.html`) for schedule verification
- **2025-01**: Added debug mode with visual overlay (`?debug=1`)
- **2025-01**: Created `js/utils/debug.js` for debug utilities
- **2025-01**: Standardized CSS loading across all pages for consistency
- **2025-01**: Created `css/docs.css` - moved inline styles from codeexplained.html
- **2025-01**: Added components.css to bingo.html and editor.html
- **2025-01**: Added CLAUDE.md for persistent project memory
- **2024**: Added Raggedy Anne's venue
- **2024**: Added comprehensive documentation to index.html
- **2024**: Created codeexplained.html documentation page
- **2024**: Implemented dual-pane layout for 1200px+ screens
- **2024**: Various style updates and corner refinements

### Architecture Decisions
1. **Vanilla JS chosen** to keep educational value and avoid framework overhead
2. **ES6 modules** for code organization without bundler
3. **Custom state management** instead of Redux for simplicity
4. **Leaflet.js** for maps (open source, no API key required)
5. **Font Awesome CDN** for icons (easy updates, no local assets)

## Instructions for Claude

### When Making Changes
1. **Read before editing** - Always read files before modifying them
2. **Follow existing patterns** - Match the coding style already in use
3. **Keep it simple** - This project intentionally avoids over-engineering
4. **Test responsively** - Changes should work on mobile and desktop
5. **Update documentation** - If you add features, update this file and README.md

### Maintaining This Document
**UPDATE THIS FILE** when you:
- Add new features or pages
- Change the file structure
- Modify architectural patterns
- Add new venue data fields
- Make significant design decisions

### Security Considerations
- Always use `escapeHtml()` when rendering user-provided content
- Use `sanitizeUrl()` for any URLs before rendering
- Never store API keys or secrets in code
- Validate all form inputs

## Related Documentation

- `README.md` - Public-facing project documentation
- `codeexplained.html` - Interactive beginner's guide to the codebase
- Inline comments in `index.html` - Extensive HTML documentation
- JSDoc comments in JavaScript files

---

*Last updated: February 2026*
*Maintained by: Project contributors and Claude Code sessions*
