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
- All venue data in `js/data.js` (currently 59+ venues)
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
├── css/
│   ├── base.css           # CSS variables, reset, typography
│   ├── layout.css         # Header, nav, page structure
│   ├── components.css     # Buttons, cards, modals, forms
│   ├── views.css          # View-specific styles
│   ├── bingo.css          # Bingo game styles
│   ├── editor.css         # Editor page styles
│   └── submit.css         # Submission form styles
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
│   │   ├── Navigation.js  # View tabs, week nav, filters
│   │   ├── DayCard.js     # Daily schedule display
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
│   │   └── venues.js      # Venue data operations
│   │
│   └── utils/
│       ├── date.js        # Date formatting, schedule matching
│       ├── string.js      # Text manipulation, escaping
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
  dedicated: false,           // true if karaoke-only venue
  address: {
    street: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701"
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
      endTime: "01:00"        // Can cross midnight
    }
  ],
  host: {                     // Optional
    name: "KJ Name",
    company: "Company Name"
  },
  socials: {                  // All optional
    website: "https://...",
    facebook: "https://facebook.com/...",
    instagram: "https://instagram.com/...",
    twitter: "https://twitter.com/..."
  }
}
```

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

## CSS Conventions

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

## Common Development Tasks

### Adding a New Venue
1. Edit `js/data.js`
2. Add venue object to `listings` array
3. Run `scripts/validate-data.js` to check format
4. Optionally add coordinates via `scripts/geocode-venues.js`

### Adding a New View
1. Create `js/views/NewView.js` extending Component
2. Add case in `app.js` renderView() function
3. Add navigation tab in Navigation.js
4. Add view-specific styles in `css/views.css`

### Modifying Styles
- Global changes: `css/base.css` (variables) or `css/layout.css`
- Component changes: `css/components.css`
- View-specific: `css/views.css`

## Current Feature Status

### Implemented
- [x] Weekly calendar view with 7-day schedule
- [x] Alphabetical A-Z venue listing
- [x] Interactive map with Leaflet.js
- [x] Venue detail modal (mobile) and side pane (desktop)
- [x] Dedicated venue filter
- [x] Week navigation (prev/next/today)
- [x] Karaoke bingo game
- [x] Venue submission form
- [x] Venue editor tool
- [x] Comprehensive code documentation (codeexplained.html)

### Potential Future Enhancements
- [ ] Search/filter by host, city, or neighborhood
- [ ] User favorites (localStorage)
- [ ] Share venue links
- [ ] PWA offline support
- [ ] Backend API for submissions
- [ ] User accounts and reviews

## Project History

### Recent Changes
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

*Last updated: January 2025*
*Maintained by: Project contributors and Claude Code sessions*
