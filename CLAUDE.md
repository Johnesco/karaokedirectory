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
│       ├── task.yml       # Refactors, deps, tooling template
│       ├── spike.yml      # Research/investigation template
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
│   ├── docs.css           # Documentation page styles (codeexplained.html)
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
│   │   └── venues.js      # Venue data operations, search, filtering
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

<!-- ============================================================
     SDLC WORKFLOW
     This section is universal. It works across any project that
     uses GitHub Issues + Projects for tracking.

     Source: https://github.com/Johnesco/sdlc-baseline
     ============================================================ -->

## Instructions for Claude

### Roles and Responsibilities

| Role | Owner | Board Columns | Key Rule |
|------|-------|---------------|----------|
| **PO** (Product Owner) | Human | Backlog, Done | Decides priority, accepts work |
| **BA** (Business Analyst) | Human or Claude | Backlog, Ready | Scopes tickets, writes acceptance criteria |
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

The **project specification** (`docs/functional-spec.md`) is the authoritative record of all application features, behavior, and data formats. It is the single source of truth for what this application does.

> If your project does not yet have a spec, treat CLAUDE.md as the primary record until one exists.

**Before ANY change**, follow these steps in order:

1. **Capture as a ticket** — Create a GitHub Issue describing the change before any other work begins. Include a clear title, relevant labels, acceptance criteria, and an associated **milestone**. Every issue must belong to an existing milestone by the time it ships; if no existing milestone fits, create a new one. No code is written without a ticket.

   > **IMPORTANT — Add to Project Board:** After creating the issue, you **must** also add it to the GitHub Projects board. The `gh issue create` command does **NOT** auto-add issues to the project board. Run this immediately after creating the issue:
   > ```
   > gh project item-add 1 --owner Johnesco --url [ISSUE_URL]
   > ```
   > An issue that is not on the board is considered incomplete. This is a known gotcha — do not skip this step.

2. **Review documentation for affected areas** — Read the sections of the spec (and other docs like CLAUDE.md, README.md) that describe the area being changed. Identify what exists, what will be impacted, and note any discrepancies.

3. **Flag discrepancies** — If existing code already differs from what the documentation says, stop and flag the mismatch for validation before proceeding. Do not silently "fix" documentation to match code or vice versa without explicit confirmation.

4. **Refine the ticket** — Based on the documentation review, update the GitHub Issue with additional context, affected doc sections, and a plan for documentation updates. The ticket should reflect the full scope of work including doc changes.

5. **Implement the change** — Write the code. Reference the ticket number (`#XX`) in commits.

6. **Update all documentation** — Update the spec, CLAUDE.md, README.md, and any other affected docs so they accurately reflect the new state. This is not optional — a change is not complete until its documentation is current.

7. **Verify consistency** — After updating, confirm that the documentation and code are in agreement. Any remaining gaps must be called out explicitly.

**Key rules:**
- No code without a ticket — every change starts as a GitHub Issue
- A change without a corresponding documentation update is considered **incomplete**
- Documentation updates are part of the definition of done, not a follow-up task
- When in doubt about whether docs need updating, they do
- The spec is the primary document; CLAUDE.md and README.md are secondary but must stay consistent

### Compressing Steps for Small Changes

Not every change needs the full ceremony. Here's when you can compress:

- **Data-only changes** (adding a record, fixing a typo): Steps 2-4 can compress into a quick scan. Still need a ticket (Step 1) and human verification (Step 7).
- **Bug fixes with obvious cause**: Step 2 becomes "confirm the spec describes the expected behavior." Steps 3-4 can compress into a single issue comment.
- **Documentation-only changes**: Step 5 becomes "edit the docs" instead of "write code." Step 6 is the main deliverable.
- **When NOT to compress**: New features, changes affecting multiple files, changes where you're unsure about existing behavior, anything that modifies user-facing behavior.

### When Making Changes
1. **Ticket first** — Follow the workflow above before all else
2. **Read before editing** — Always read files before modifying them
3. **Follow existing patterns** — Match the coding style already in use
4. **Keep it simple** — Avoid over-engineering

### Maintaining Documentation

**UPDATE the project spec** when you:
- Add, modify, or remove any feature
- Fix a bug that changes observable behavior
- Change data formats or API contracts
- Alter UI behavior, states, or interactions

**UPDATE CLAUDE.md** when you:
- Add new features or pages
- Change the file structure
- Modify architectural patterns
- Make significant design decisions

**UPDATE README.md** when changes affect:
- Public-facing feature descriptions
- Setup or usage instructions
- Project overview

## Development Workflow

### GitHub Issues & Projects

All work is tracked in **GitHub Issues** with a **GitHub Projects** kanban board.

- **Issues** = All work items (features, bugs, docs, tasks, spikes)
- **Labels** = Type (`feature`, `bug`, `docs`, `task`, `spike`) + Area (`area:frontend`, `area:data`, etc.) + Priority (`priority:high`, `priority:low`) + Resolution (`resolution:wontfix`, `resolution:duplicate`, etc.)
  - Resolution labels are only applied when closing an issue **without completing the work**. No resolution label = completed.
- **Milestones** = Major feature areas. Every issue must have a milestone by the time it ships. If no existing milestone fits, create a new one.
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
| **Backlog** | Captured; refinement happens here (doc review, scope, AC) |
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
| Backlog → Ready | Refinement checklist complete, acceptance criteria finalized |
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
| `task/` | Refactors, tooling, dependencies |
| `spike/` | Research, investigation |

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
- `codeexplained.html` - Interactive beginner's guide to the codebase
- Inline comments in `index.html` - Extensive HTML documentation
- JSDoc comments in JavaScript files

---

*Last updated: February 2026*
*Maintained by: Project contributors and Claude Code sessions*
