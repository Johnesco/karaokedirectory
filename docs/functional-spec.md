# Austin Karaoke Directory — Functional Specification

> **Status:** Living document — must be updated with every code change.
> **Authority:** This is the single source of truth for application behavior. Code must match this spec; any discrepancy must be flagged and resolved.

**Version:** 1.0
**Last updated:** February 2026
**Application:** Austin Karaoke Directory
**Live site:** [Add deployment URL]

---

## Table of Contents

1. [Overview](#1-overview)
2. [Weekly Calendar View](#2-weekly-calendar-view)
3. [Alphabetical View](#3-alphabetical-view)
4. [Map View](#4-map-view)
5. [Navigation & Controls](#5-navigation--controls)
6. [Venue Cards](#6-venue-cards)
7. [Venue Detail — Mobile Modal](#7-venue-detail--mobile-modal)
8. [Venue Detail — Desktop Pane](#8-venue-detail--desktop-pane)
9. [Search](#9-search)
10. [Filtering](#10-filtering)
11. [Venue Data Model](#11-venue-data-model)
12. [Tag System](#12-tag-system)
13. [Schedule Matching](#13-schedule-matching)
14. [Karaoke Bingo Game](#14-karaoke-bingo-game)
15. [Venue Submission Form](#15-venue-submission-form)
16. [Venue Editor](#16-venue-editor)
17. [About Page](#17-about-page)
18. [Debug Mode](#18-debug-mode)
19. [Responsive Design](#19-responsive-design)
20. [Security](#20-security)
21. [State Management & Events](#21-state-management--events)
22. [Known Discrepancies](#22-known-discrepancies)
23. [Change Log](#23-change-log)

---

## 1. Overview

### Purpose

A mobile-friendly web application helping users discover karaoke venues in and around Austin, Texas. Users can browse venues by weekly schedule, alphabetical listing, or interactive map. The site provides schedule details, venue tags, host/KJ information, and social links.

### Target Users

Karaoke enthusiasts looking for venues, schedules, and event details in the greater Austin area.

### Design Philosophy

- **Vanilla JavaScript only** — no frameworks, no build step
- **Mobile-first responsive design** — base styles target mobile, enhanced for larger screens
- **Data-driven** — all venue data in a single JavaScript file (`js/data.js`), currently 69 venues
- **Component-based** — lightweight custom `Component` base class with state management and event bus

### Pages

| Page | File | Purpose |
|------|------|---------|
| Main app | `index.html` | Single-page app with all three views |
| About | `about.html` | Project info, feature overview, contact |
| Bingo | `bingo.html` | Karaoke bingo game |
| Submit | `submit.html` | Venue submission and issue reporting |
| Editor | `editor.html` | Venue data editing tool |
| Docs | `codeexplained.html` | Interactive code documentation (beginner-oriented) |
| Spec viewer | `docs/index.html` | Docsify-powered documentation portal (renders this spec) |
| Tests | `tests/index.html` | Schedule matching test suite |

---

## 2. Weekly Calendar View

**File:** `js/views/WeeklyView.js`

The default view. Displays a 7-day schedule grid showing which venues have karaoke on each day.

### Display

- Shows 7 consecutive days starting from the current `weekStart` date
- Each day rendered as a "day card" containing venue listings
- Days appear in calendar order (Sunday through Saturday)

### Day Card States

| State | CSS Class | Behavior |
|-------|-----------|----------|
| Today | `.day-card--today` | Purple border highlight, "Today" badge shown, always expanded |
| Future day | _(none)_ | Normal appearance, always expanded |
| Past day | `.day-card--past` | Dimmed, collapsed by default (header only), click header to expand |
| Empty day | `.day-card--empty` | Dimmed, collapsed to header only, shows "No karaoke scheduled" |
| Past + expanded | `.day-card--past.day-card--expanded` | Past day that user clicked to expand |
| Today + empty | `.day-card--today.day-card--empty` | Purple border, collapsed (search filtered all venues) |

### Day Card Header

Each day card header displays:
- Day name (e.g., "Monday")
- Short date (e.g., "Jan 15")
- "Today" badge (if current day)
- Expand/collapse chevron indicator

### Day Card Content

When expanded, shows:
- List of venue cards in compact mode
- Footer with venue count (e.g., "5 venues")

### Sorting

- **Special events first** — venues with `frequency: "once"` matching that date sort to the top
- **Then alphabetical** — remaining venues sorted by `getSortableName()` (ignores articles like "The", "A", etc.)

### Interaction

- **Click past day header** — toggles expand/collapse
- **Click venue card** (except links) — emits `VENUE_SELECTED` event, opens venue detail
- **Links** (address, event URLs) — open directly, do not trigger venue detail

### Auto-Scroll

When viewing the current week, the page scrolls to today's day card after render using `scrollIntoView({ behavior: 'instant', block: 'start' })`.

### Filtering

- Respects the "Show dedicated" toggle
- Respects the search query — day cards with no matching venues collapse to `.day-card--empty`
- Re-renders on `FILTER_CHANGED` event

---

## 3. Alphabetical View

**File:** `js/views/AlphabeticalView.js`

Browse all venues alphabetically, grouped by first letter.

### Layout

1. **Letter index** — quick-link buttons across the top for each letter that has venues (A, B, C...). Clicking scrolls to that letter group.
2. **Letter groups** — one section per letter, each containing:
   - Letter heading with venue count (e.g., "B — 7 venues")
   - Full-mode venue cards showing complete schedule, host info, and socials
3. **Total count** — bottom shows total filtered venue count

### Sorting

- Letters appear A–Z
- Venues within each letter sorted alphabetically by `getSortableName()`
- Articles ("The", "A", "An", etc.) moved to end for sorting: "The Highball" sorts under "H"

### Sticky Index

- The letter index bar sticks to the top during scroll
- Its height is tracked via `ResizeObserver` and stored as CSS variable `--az-index-height` so letter headings can stick below it

### Empty State

If no venues match the current search/filter, displays "No venues match your search." with no letter index.

### Filtering

- Respects the "Show dedicated" toggle
- Respects the search query
- Re-renders on `FILTER_CHANGED` event

---

## 4. Map View

**File:** `js/views/MapView.js`

Interactive Leaflet.js map showing venue locations with marker clustering.

### Immersive Mode

When the map view is active:
- `body` receives class `.view--map`
- CSS hides the site header, footer, and navigation bar
- The map fills the entire viewport (100vh)
- Floating controls overlay the map

### Map Configuration

- **Center:** Austin, TX (`30.2672, -97.7431`)
- **Default zoom:** 11
- **Tiles:** OpenStreetMap (free, no API key)
- **Libraries:** Leaflet 1.9.4 + MarkerClusterGroup (loaded from CDN on first render)

### Marker Clustering

Markers are grouped using the MarkerClusterGroup plugin:

| Cluster Size | Icon Size | Visual |
|-------------|-----------|--------|
| 1–9 venues | 36px | Small cluster |
| 10–19 venues | 42px | Medium cluster |
| 20+ venues | 48px | Large cluster |

- **Click cluster** — smooth `flyToBounds` animation (0.8s) to zoom in on cluster bounds
- **Hover cluster** — tooltip lists venue names (up to 12, then "and X more...")

### Individual Markers

- Custom purple pin icon (30px wide, 40px tall)
- **Hover** — tooltip shows venue name
- **Click** — marker becomes selected (`.map-marker--selected`), floating venue card appears, map pans to center on marker

### Floating Venue Card

A card that appears over the map when a marker is selected. Has two states:

| State | Content |
|-------|---------|
| **Summary** | Venue name, tags, schedule, "Directions" link, "Details" button |
| **Details** (expanded) | Full location, schedule, host, socials, contact info |

- Close button (X) hides the card
- "Details" button expands the card and shows a back arrow
- "Back to Summary" returns to compact view
- Clicking the map background (not a marker or card) dismisses the card

### Floating Controls

| Control | Position | Contents |
|---------|----------|----------|
| `.map-controls` | Top-left | "Show/Hide Dedicated" toggle button |
| `.map-view-switcher` | Top-right | Calendar and A-Z buttons to exit map view |

### Escape Key

- **If venue card is open** — closes the floating card
- **If no card is open** — exits map view, returns to Weekly Calendar view

### Venue Count Info

Displays "X of Y venues have map coordinates" at the bottom. If some venues lack coordinates, shows a hint to add them via the editor.

### Filtering

- Respects the "Show dedicated" toggle — re-renders markers when changed
- Respects the search query — only matching venues with coordinates shown
- Only venues with valid `coordinates.lat` and `coordinates.lng` appear on the map

---

## 5. Navigation & Controls

**File:** `js/components/Navigation.js`

Persistent navigation bar with view switching, week navigation, search, and filters.

### View Switcher Buttons

| Button | Icon | Label | Action |
|--------|------|-------|--------|
| Weekly | Calendar icon | CAL | Switch to weekly view |
| A-Z | List icon | A-Z | Switch to alphabetical view |
| Map | Map icon | MAP | Switch to map view |
| Bingo | Grid icon | BINGO | Navigate to `bingo.html` |

- Active view button highlighted with `.nav-btn--active` (blue background)
- Bingo is a navigation link, not a view switch

### Week Navigation

Only visible when `view === 'weekly'`:
- **Left chevron** — previous week
- **Right chevron** — next week
- **Center text** — week range (e.g., "Jan 15 - Jan 21, 2026")
- **"Today" button** — only shown when not viewing the current week; jumps back to current week

### Search Input

Always visible. See [Section 9: Search](#9-search) for full behavior.

### Dedicated Venue Filter

Always visible. See [Section 10: Filtering](#10-filtering) for full behavior.

### Navigation Height Tracking

The navigation bar's height is tracked by a `ResizeObserver` and stored as CSS variable `--nav-height`, used for sticky positioning in child views.

---

## 6. Venue Cards

**File:** `js/components/VenueCard.js`

Venue cards appear in two modes depending on context.

### Compact Mode

Used in: Weekly Calendar day cards, Map floating card summary.

Displays:
- **Venue name** — clickable button
- **Special event indicator** — star icon + event name (for `frequency: "once"` events). If `eventUrl` is set, event name is a link. Adds `.venue-card--special-event` class and injects `special-event` tag.
- **Time range** — clock icon + "9:00 PM - 1:00 AM" format. If `eventUrl` is set (and not already shown as special event link), shows arrow link icon.
- **Address** — location icon + full address as Google Maps link
- **Host** — "Presented by [host display]" (compact format: company name, or name if no company)
- **Tags** — color-coded badge list

### Full Mode

Used in: Alphabetical View.

Displays everything in compact mode plus:
- **Complete schedule** — all schedule entries listed (not just the one matching today)
- **Host section** — full host name, company, website
- **Social links** — all venue social media icons
- **Date range notice** — if seasonal venue

### Debug Info

When debug mode is enabled (`?debug=1`), compact cards show the schedule match reason at the top (e.g., "Every Friday", "First Saturday").

### Click Behavior

- Clicking the venue name button emits `VENUE_SELECTED`
- Clicking links (address, social, event URL) opens the link directly without triggering venue detail
- In Weekly and Alphabetical views, clicking anywhere on the card (except links) also triggers `VENUE_SELECTED`

---

## 7. Venue Detail — Mobile Modal

**File:** `js/components/VenueModal.js`

Full-screen modal overlay for viewing venue details on smaller screens.

### When It Opens

The modal opens only when ALL of these conditions are met:
- A `VENUE_SELECTED` event fires
- Window width is **less than 1400px**
- The current view is **not** the map view (map uses its own floating card)

### Content Sections

| Section | Content |
|---------|---------|
| Header | Venue name, event name (if special event), tags |
| Location | Full address, "View Map" button, "Directions" button |
| Schedule | Schedule table (all entries) + date range notice if seasonal |
| Host | Host name, company, website, social links |
| Social Media | Venue social links (if any) |
| Contact | Phone number link (if venue has phone field) |

Schedule tables, host sections, and date range notices are rendered using shared utilities from `js/utils/render.js`.

### Close Triggers

1. Click the close button (X)
2. Click the backdrop overlay
3. Press Escape key

### Scroll Lock

When the modal is open, `document.body.style.overflow = 'hidden'` prevents background scrolling. Restored on close.

### Events Emitted

- `MODAL_OPEN` when opening
- `VENUE_CLOSED` when closing

---

## 8. Venue Detail — Desktop Pane

**File:** `js/components/VenueDetailPane.js`

Sticky sidebar on the right side of the screen for wide viewports.

### Display Breakpoint

Visible when window width is **1400px or wider**. Hidden on smaller screens via CSS.

### Content

Same sections as the mobile modal (Location, Schedule, Host, Social Media, Contact).

### Empty State

When no venue is selected, shows a microphone icon and the text: "Select a venue to see details, schedule, and host information."

### State

- Listens to `VENUE_SELECTED` — updates with venue data
- Listens to `VENUE_CLOSED` — clears to empty state
- Emits `VENUE_DETAIL_SHOWN` when displaying a venue

---

## 9. Search

The app includes a global search bar that filters venues across all views.

### Search Input

Located in the Navigation component. Always visible.
- **Placeholder:** "Search venues, tags, hosts..."
- **Clear button** (X icon) appears when search has text; clicking clears input and refocuses it
- Typing updates the `searchQuery` state and emits `FILTER_CHANGED`

### What Search Matches Against

Search is case-insensitive substring matching. A venue matches if the query appears in any of:

| Field | Example query | Matches |
|-------|--------------|---------|
| Venue name | "highball" | "The Highball" |
| City | "round rock" | Venues in Round Rock |
| Neighborhood | "downtown" | Venues with neighborhood "Downtown" |
| Host name | "johnny" | Venues hosted by someone named Johnny |
| Host company | "sing" | Venues with company containing "sing" |
| Tag ID | "lgbtq" | Venues tagged `lgbtq` |
| Tag label | "Dive Bar" | Venues tagged `dive` (label: "Dive Bar") |
| "dedicated" or "karaoke" keywords | "dedicated" | Venues with `dedicated: true` |
| Event name | "birthday" | Special events with "birthday" in event name |

### Search Behavior by View

- **Weekly:** Day cards with no matching venues collapse to `.day-card--empty`. Days with matches show only matching venues.
- **Alphabetical:** Letter groups only show matching venues. Letters with no matches disappear. Empty results show "No venues match your search."
- **Map:** Only matching venues with coordinates appear as markers.

### Preservation of Input Focus

The Navigation component does **not** re-render when search changes, to preserve keyboard focus in the input field. Only the views re-render.

---

## 10. Filtering

### Dedicated Venue Filter

- **UI:** Checkbox labeled "Show dedicated venues" in Navigation
- **Default state:** `showDedicated: true` (dedicated venues are shown)
- **When unchecked:** Venues with `dedicated: true` are excluded from all views
- **Map view:** A floating "Show/Hide Dedicated" button replaces the checkbox

### Date Range Filtering

Venues with a `dateRange` field only appear when the current date falls within `dateRange.start` and `dateRange.end` (inclusive). This is automatic — no user control.

### Filter Event Flow

1. User changes filter (dedicated toggle, search input)
2. State updated (`showDedicated` or `searchQuery`)
3. `FILTER_CHANGED` event emitted
4. All views re-render with filtered results

---

## 11. Venue Data Model

**File:** `js/data.js`

All venue data is stored in a single JavaScript file as `const karaokeData = { tagDefinitions, listings }`.

### Venue Object Schema

```
{
  id                    string        REQUIRED  Unique, lowercase, hyphenated slug
  name                  string        REQUIRED  Venue display name
  active                boolean       OPTIONAL  Default: true. Set false to hide venue.
  dedicated             boolean       REQUIRED  true if karaoke-only venue
  tags                  string[]      OPTIONAL  Array of tag IDs (e.g., ["lgbtq", "dive"])

  address               object        REQUIRED
    address.street      string        REQUIRED
    address.city        string        REQUIRED
    address.state       string        REQUIRED
    address.zip         string        OPTIONAL
    address.neighborhood string       OPTIONAL  Helps with search filtering

  coordinates           object        OPTIONAL  Required for map view
    coordinates.lat     number        Latitude (-90 to 90)
    coordinates.lng     number        Longitude (-180 to 180)

  schedule              object[]      REQUIRED  At least one entry

    Recurring entry:
      frequency         string        "every", "first", "second", "third", "fourth", "last"
      day               string        Full day name, capitalized (e.g., "Friday")
      startTime         string        24-hour format "HH:MM"
      endTime           string|null   24-hour format "HH:MM" or null (open-ended)
      eventUrl          string        OPTIONAL  Link to event page

    One-time entry:
      frequency         string        "once"
      date              string        "YYYY-MM-DD"
      startTime         string        24-hour format "HH:MM"
      endTime           string|null   24-hour format "HH:MM" or null
      eventName         string        OPTIONAL  Display name for the event
      eventUrl          string        OPTIONAL  Link to event page

  dateRange             object        OPTIONAL  For seasonal venues
    dateRange.start     string        "YYYY-MM-DD"
    dateRange.end       string        "YYYY-MM-DD"

  host                  object|null   OPTIONAL
    host.name           string        OPTIONAL
    host.company        string        OPTIONAL
    host.website        string        OPTIONAL  Host/KJ personal website

  socials               object|null   OPTIONAL
    socials.website     string        OPTIONAL
    socials.facebook    string        OPTIONAL
    socials.instagram   string        OPTIONAL
    socials.twitter     string        OPTIONAL
    socials.tiktok      string        OPTIONAL
    socials.youtube     string        OPTIONAL
    socials.bluesky     string        OPTIONAL
}
```

### Venue Count

As of February 2026: **69 venues** in the listings array.

### Active/Inactive

Venues default to active. Setting `active: false` hides the venue from all views, searches, and counts. The venue remains in data but `getAllVenues()` and all query functions exclude it.

### Sortable Name

The `getSortableName()` utility strips leading articles for sorting purposes. "The Highball" becomes "Highball, The" and sorts under "H". Recognized articles include English (a, an, the), French, Spanish, Italian, and Portuguese articles.

---

## 12. Tag System

**Files:** `js/data.js` (definitions), `js/utils/tags.js` (rendering)

### Tag Definitions

Tags are defined in the `tagDefinitions` object in `js/data.js`. Each tag has:
- **id** (object key) — machine-readable identifier
- **label** — human-readable display name
- **color** — badge background color (hex)
- **textColor** — badge text color (hex)

### Current Tags (19)

| Tag ID | Label | Color | Description |
|--------|-------|-------|-------------|
| `dedicated` | Dedicated | #673ab7 | Dedicated karaoke venue (auto-added when `dedicated: true`) |
| `lgbtq` | LGBTQ+ | #e040fb | LGBTQ+ friendly venue |
| `dive` | Dive Bar | #8d6e63 | Dive bar atmosphere |
| `sports-bar` | Sports Bar | #4caf50 | Sports bar venue |
| `country-bar` | Country Bar | #ff9800 | Country/western bar |
| `21+` | 21+ | #f44336 | 21 and over only |
| `18+` | 18+ | #ffc107 | 18 and over only |
| `all-ages` | All Ages | #2196f3 | No age restriction |
| `family-friendly` | Family | #03a9f4 | Family-friendly venue |
| `smoking-inside` | Smoking Inside | #e90707 | Indoor smoking allowed |
| `restaurant` | Restaurant | #795548 | Primarily a restaurant |
| `outdoor` | Outdoor | #4caf50 | Significant outdoor/patio space |
| `live-band-karaoke` | Live Band | #9c27b0 | Live band karaoke |
| `billiards` | Billiards | #607d8b | Pool hall / billiards focus |
| `brewery` | Brewery | #ff5722 | Brewery or distillery |
| `games` | Games | #00bcd4 | Arcade, bowling, entertainment |
| `craft-cocktails` | Craft Cocktails | #e91e63 | Upscale craft cocktail bar |
| `neighborhood` | Neighborhood Bar | #9e9e9e | Casual neighborhood bar |
| `special-event` | Special Event | #e91e63 | One-time special karaoke events |

### Rendering

Tags render as color-coded inline badges using `renderTags(tags, options)` from `js/utils/tags.js`.
- CSS classes: `.venue-tags` (container), `.venue-tag` (individual badge)
- The `dedicated` tag is auto-prepended when `venue.dedicated === true`, even if not in the `tags` array
- The `special-event` tag is injected in compact venue cards for `frequency: "once"` events

### Searchability

Tags are searchable by both their ID and label. Searching "dive" or "Dive Bar" will find venues tagged `dive`.

---

## 13. Schedule Matching

**File:** `js/utils/date.js` — `scheduleMatchesDate(schedule, date)`

This is the core logic that determines which venues appear on which days.

### One-Time Events (`frequency: "once"`)

A one-time event matches if the `schedule.date` string (YYYY-MM-DD) equals the formatted date. Only the date matters; times are not evaluated for matching purposes.

**Example:** `{ frequency: "once", date: "2026-03-15" }` matches March 15, 2026 only.

### Recurring Events

For recurring events, matching follows two steps:

**Step 1 — Day of week check:**
The day-of-week of the target date must match `schedule.day` (case-insensitive). If it doesn't, the schedule does not match.

**Step 2 — Frequency check:**

| Frequency | Logic | Example |
|-----------|-------|---------|
| `"every"` | Always matches (every occurrence of that day) | Every Friday |
| `"first"` | Date falls on days 1–7 of the month | First Saturday (the 1st–7th) |
| `"second"` | Date falls on days 8–14 | Second Tuesday (the 8th–14th) |
| `"third"` | Date falls on days 15–21 | Third Wednesday (the 15th–21st) |
| `"fourth"` | Date falls on days 22–28 | Fourth Monday (the 22nd–28th) |
| `"fifth"` | Date falls on days 29–31 | Fifth occurrence (rare, days 29–31) |
| `"last"` | Adding 7 days crosses into the next month | Last Friday of the month |

**Nth-weekday calculation:** `Math.ceil(date.getDate() / 7)` gives the occurrence number (1 = first, 2 = second, etc.).

**Last occurrence:** Determined by checking if `date + 7 days` is in a different month. If so, this is the last occurrence of that weekday in the month.

### Boundary Cases

- **Midnight crossing:** Times (e.g., `startTime: "21:00"`, `endTime: "01:00"`) are stored for display only. The venue appears on the **start date's** day, not the next day. `scheduleMatchesDate()` does not evaluate times.
- **Null endTime:** Indicates "until close." Matching is unaffected (endTime is display-only).
- **Fifth occurrence:** Only possible on dates 29–31. Not every month has a fifth occurrence of every weekday.
- **Last vs. fourth:** These can overlap (e.g., if the 4th Friday is also the last Friday). A venue scheduled for "last Friday" will match correctly even if it's also the 4th Friday.

### Date Range Filtering

Separate from schedule matching. If a venue has `dateRange`, it only appears when the current viewing date is within `dateRange.start` and `dateRange.end` (both inclusive). Checked via `isDateInRange()`.

### Time Formatting

- Internal storage: 24-hour format `"HH:MM"`
- Display: 12-hour format via `formatTime12()` — e.g., `"21:00"` displays as `"9:00 PM"`
- Time ranges: `formatTimeRange()` — e.g., `"9:00 PM - 1:00 AM"` or `"9:00 PM - Close"` (when endTime is null)

---

## 14. Karaoke Bingo Game

**Files:** `bingo.html`, `js/bingo.js`, `css/bingo.css`

A standalone karaoke-themed bingo game.

### Card Layout

- 5x5 grid (25 cells)
- Center cell is always **FREE** (pre-marked, cannot be toggled)
- 24 remaining cells randomly selected from a pool of 25+ karaoke-themed phrases

### Word Pool

Karaoke performance scenarios: forgot lyrics, mic drop fail, wrong song, crowd sings louder, voice cracked, danced off stage, fell off stage, feedback screech, sang off-key, air guitar, awkward silence, tripped on cord, started too early, missed cue, sang wrong verse, forgot chorus, crowd joined, sang quietly, headbanging, forgot tune, sang laughing, long intro, loud scream, crowd backup, crowd harmony.

### Gameplay

- **Click cell** — toggles marked/unmarked state
- **Visual feedback** — flip animation on toggle
- **Haptic feedback** — vibration on mobile devices
- **Undo button** — visible when moves have been made; reverts the last toggle

### Win Detection

Checks after each toggle for a complete line:
- Any row (5 possible)
- Any column (5 possible)
- Either diagonal (2 possible)

Detects the **first** winning line only. Further toggling is prevented after bingo.

### Celebration Effects

On bingo detection:
- Screen flash effect
- Confetti particles (animated fall)
- Firework bursts (20–35 particles each)
- Star emojis scattered
- Multiple waves over ~1.2 seconds
- Strong haptic feedback pattern: [100, 50, 100, 50, 200]ms

### Controls

| Button | Behavior |
|--------|----------|
| NEW GAME | Generates fresh card, clears all marks and celebrations |
| UNDO | Reverts last move (hidden when no moves to undo) |
| Reset | Only visible after bingo achieved |

### Persistence

State saved to `localStorage` key `karaokeBingoState`:
- Card words and layout
- Marked cell indices
- Bingo achieved flag
- Winning cells
- Full move history (for undo)

Automatically restored on page load.

---

## 15. Venue Submission Form

**File:** `submit.html`

Two-tab form: "New Venue" and "Report Issue."

### New Venue Tab

#### Fields

| Section | Field | Required | Notes |
|---------|-------|----------|-------|
| Venue Info | Venue Name | Yes | |
| Venue Info | Dedicated Karaoke | No | Checkbox |
| Tags | Tag checkboxes | No | 13 tags available in grid layout |
| Tags | Age restriction | No | Radio: not sure, 21+, 18+, all-ages, family-friendly |
| Address | Street | Yes | |
| Address | City | Yes | Default: "Austin" |
| Address | State | No | Default: "TX" |
| Address | ZIP | No | Pattern validation (5 or 5+4 digits) |
| Schedule | Frequency | Yes | Select: every, first, second, third, fourth, last |
| Schedule | Day | Yes | Select: Sunday–Saturday |
| Schedule | Start time | Yes | Default: 21:00 |
| Schedule | End time | Yes | Default: 01:00 |
| Host | Host Name | No | |
| Host | Company | No | |
| Host | Website | No | URL |
| Socials | Website, Facebook, Instagram, Twitter | No | URL fields |
| Notes | Additional notes | No | Textarea |
| Submitter | Type | Yes | Radio: "Just a fan" (default) or "I'm the KJ/Host" |
| Submitter | Name | Conditional | Required if KJ/Host |
| Submitter | Contact preferences | Conditional | Checkboxes: email, phone text, phone call, other |

- Schedule entries are dynamic — "Add Another Day" button creates additional entries
- Each schedule entry has a remove button

#### Bot Protection

Hidden honeypot field `website_url` with `aria-hidden` and `tabindex=-1`. If filled, submission is rejected.

#### Rate Limiting

- Maximum 3 submissions per hour per browser
- Tracked via `localStorage` key `karaoke-submit-history`
- Warning shown when approaching limit
- Submit button disabled at limit
- Countdown timer shows when submissions will be available again

#### Submission Flow

1. Validates all required fields; scrolls to first error if validation fails
2. Checks honeypot and rate limit
3. POSTs to Google Apps Script backend (no-cors mode)
4. **On success:** Shows success message, saves timestamp, updates rate limit counter
5. **On failure:** Offers fallback options:
   - Open in email app (pre-formatted mailto: link with venue JSON)
   - Copy to clipboard (formatted text in textarea)

#### JSON Preview

"Preview JSON" button opens a modal showing the formatted venue data as JSON, with a copy button.

### Report Issue Tab

| Field | Required | Notes |
|-------|----------|-------|
| Venue Name | Yes | Text input |
| Issue type | Yes (at least 1) | Checkboxes: Closed, Wrong address, Wrong hours, Event cancelled, Host changed, Other |
| Additional details | No | Textarea |
| Reporter email | No | Email input |

Submit button posts to the same Google Apps Script endpoint.

---

## 16. Venue Editor

**Files:** `editor.html`, `editor/editor.js`, `css/editor.css`

A development tool for editing venue data with live preview.

### Core Workflow

1. Load venues from `js/data.js` on page load
2. Select a venue from the sidebar list (or create new)
3. Edit fields in the form
4. Preview changes in real-time (card preview, modal preview, or JSON)
5. Save to in-memory array
6. Copy full JSON output for pasting into `js/data.js`

### Sidebar — Venue List

- Searchable by name or city
- Sorted alphabetically (ignoring articles)
- Shows active/inactive and unsaved indicators
- Venue count displayed
- Click to select and load venue into form

### Form Fields

All fields from the venue data model are editable:
- **Basic:** ID, Name, Dedicated checkbox, Active checkbox
- **Tags:** Dynamic checkboxes from tag definitions
- **Address:** Street, City, State (default TX), ZIP, Neighborhood
- **Coordinates:** Latitude, Longitude + "Geocode Address" button
- **Schedule:** Dynamic entries with add/remove
  - Frequency select (including "once")
  - Day select (hidden for "once" entries)
  - Date picker and event name (shown for "once" entries)
  - Start/end time inputs
  - Event URL
- **Host:** Name, Company, Website
- **Socials:** Website, Facebook, Instagram, Twitter, TikTok, YouTube
- **Date Range:** Start and end dates for seasonal venues

### Geocoding

"Geocode Address" button in the coordinates section:
- Uses US Census Geocoder API (free, public, CORS-enabled)
- Reads street, city, state, and ZIP from the form
- Populates latitude and longitude fields on success
- Shows status: "Looking up...", success with coordinates, or error message

### Preview Panel

Toggleable panel (eye icon) with three tabs:

| Tab | Content |
|-----|---------|
| Card Preview | Live compact venue card rendering |
| Modal Preview | Simulated detail view |
| JSON Preview | Formatted JSON with copy button |

- Default: hidden on mobile, visible on desktop (1200px+)
- Visibility state saved to localStorage
- Updates in real-time as form fields change

### Tag Definitions Editor

Collapsible sidebar section for managing the tag system itself:
- Add new tags (prompted for ID, label auto-generated)
- Edit existing: label, background color, text color (color pickers)
- Remove tags (with confirmation; cascading removal from all venues)
- Changes propagate immediately to tag selector and preview

### Validation

- ID: required, lowercase/numbers/hyphens only, no duplicates
- Name: required
- Address: street and city required
- Schedule: at least 1 entry required
- Inline error messages on validation failure

### Save & Export

- **Save button** — persists changes to in-memory array, clears unsaved indicator
- **Copy JSON button** — exports ALL venues as `const karaokeData = { tagDefinitions, listings }` ready to paste into `data.js`. Venues sorted alphabetically.

### Draft Management

- Auto-saves form state to localStorage on changes
- Manual "Save Local" button
- On startup, prompts to load draft if found (shows timestamp)
- Draft includes: all venues, tag definitions, selected venue ID

### Unsaved Changes

- Visual "unsaved" dot on sidebar venue items
- `window.beforeunload` warning if unsaved
- Prompt when switching venues with unsaved changes

---

## 17. About Page

**File:** `about.html`

Static informational page.

### Sections

1. **About Us** — Mission statement, current venue count (69+), disclaimer to verify with venues
2. **What You Can Do** — Seven feature highlights with icons (weekly calendar, A-Z listing, interactive map, search, venue tags, special events, karaoke bingo)
3. **Submit a Venue** — Link to `submit.html`
4. **Submit Feedback** — Link to Google Form
5. **Contact Us** — Social links: Facebook Group, Instagram (@karaokedirectory)

### Header

- Title: "Greater Austin Karaoke Directory"
- Tagline: "NOTE HOLIDAY MAY CHANGE AVAILABILITY, CALL VENUE FIRST"
- Navigation link back to `index.html`

---

## 18. Debug Mode

**File:** `js/utils/debug.js`

### Enabling

- URL parameter: `?debug=1`
- Or console: `localStorage.setItem('debug', '1')`

### Behavior When Enabled

- **Debug indicator** — "Debug Mode" badge in the top-right corner
- **Venue cards** — show schedule match reason (e.g., "Every Friday", "First Saturday", "Once: 2026-03-15")
- **Hover info** — detailed match information on card hover

### Test Suite

`tests/index.html` provides:
- Automated schedule matching tests (`scheduleMatchesDate()`)
- Date utility tests (week calculations, formatting)
- Venue filtering and sorting tests
- Interactive date picker to check which venues appear on any date and why

---

## 19. Responsive Design

### Breakpoints

| Width | Behavior |
|-------|----------|
| Base (mobile) | Single column, modal for venue details, stacked navigation |
| 768px+ | Enhanced spacing and layout |
| 1024px+ | Wider cards, more horizontal space |
| 1200px+ | Side-by-side layouts where applicable |
| 1400px+ | Desktop venue detail pane visible alongside main content; mobile modal suppressed |

### Mobile-Specific Behaviors

- Venue details in full-screen modal overlay
- Scroll lock when modal open
- Haptic feedback in bingo game
- Touch-friendly tap targets

### Desktop-Specific Behaviors (1400px+)

- Venue detail pane as sticky right sidebar
- Modal suppressed (pane used instead)
- Wider cards and multi-column layouts

### Map View

Map view is always immersive (full viewport) regardless of screen size, with its own floating controls replacing the hidden navigation.

---

## 20. Security

### XSS Prevention

- All user-provided content rendered through `escapeHtml()` (uses DOM `textContent` technique)
- All URLs sanitized through `sanitizeUrl()`:
  - Blocks `javascript:` and `data:` protocol URLs
  - Auto-adds `https://` if no protocol specified
  - Returns `null` for invalid URLs

### Bot Protection

Submission form uses a honeypot field (`website_url`) hidden with `aria-hidden` and `tabindex=-1`.

### Rate Limiting

Submission form limits to 3 submissions per hour per browser via `localStorage`.

### Data Safety

- No API keys or secrets in code
- No server-side data storage (data is a static JS file)
- Form submissions go to Google Apps Script (no-cors POST)

---

## 21. State Management & Events

### State (`js/core/state.js`)

Centralized state with observer pattern.

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `venues` | array | `[]` | All active venues |
| `filteredVenues` | array | `[]` | Filtered venue results |
| `filters` | object | `{ day: null, city: null, search: '', dedicatedOnly: false }` | Filter settings |
| `view` | string | `'weekly'` | Current view: `weekly`, `alphabetical`, or `map` |
| `weekStart` | Date | Today | Start date for weekly view |
| `showDedicated` | boolean | `true` | Whether dedicated venues are shown |
| `searchQuery` | string | `''` | Current search text |
| `selectedVenue` | object/null | `null` | Currently selected venue |
| `isLoading` | boolean | `false` | Loading indicator |

### API

- `getState(key)` — read a state value (or entire state without key)
- `setState(updates)` — update state and notify subscribers
- `subscribe(key, callback)` — subscribe to changes for a specific key; returns unsubscribe function
- `subscribeAll(callback)` — subscribe to all state changes
- `navigateWeek(weeks)` — move weekStart by N weeks
- `goToCurrentWeek()` — reset weekStart to today

### Events (`js/core/events.js`)

Pub/sub event bus for component communication.

| Event | Constant | Trigger |
|-------|----------|---------|
| `venue:selected` | `VENUE_SELECTED` | User clicks/selects a venue |
| `venue:closed` | `VENUE_CLOSED` | Venue detail dismissed |
| `venue:detail-shown` | `VENUE_DETAIL_SHOWN` | Venue detail displayed |
| `view:changed` | `VIEW_CHANGED` | User switches views |
| `week:changed` | `WEEK_CHANGED` | Week navigation occurs |
| `filter:changed` | `FILTER_CHANGED` | Any filter state changes |
| `search:changed` | `SEARCH_CHANGED` | Search query changes |
| `modal:open` | `MODAL_OPEN` | Modal opens |
| `modal:close` | `MODAL_CLOSE` | Modal closes |
| `data:loaded` | `DATA_LOADED` | Venue data loaded successfully |
| `data:error` | `DATA_ERROR` | Data loading failed |

### API

- `on(event, callback)` — subscribe; returns unsubscribe function
- `once(event, callback)` — subscribe for one execution
- `off(event, callback)` — unsubscribe specific callback
- `emit(event, data)` — fire event to all subscribers (errors caught per-handler)
- `clear(event?)` — remove listeners for one or all events

---

## 22. Known Discrepancies

> Items listed here represent differences found between existing documentation and code during the initial spec creation. Each must be validated and resolved.

| # | Area | Issue | Resolution | Status |
|---|------|-------|------------|--------|
| 1 | Detail pane breakpoint | CLAUDE.md said "1200px+", code uses 1400px | CLAUDE.md updated to 1400px | **Resolved 2026-02** |
| 2 | Social platforms | `url.js` supports bluesky but it was missing from CLAUDE.md venue schema | Added `bluesky` to socials in CLAUDE.md and functional spec | **Resolved 2026-02** |
| 3 | Day name casing | Data file used lowercase day names ("friday"), docs showed capitalized ("Friday") | All 115 day entries in `data.js` standardized to initial capital ("Friday"). Matching code uses `.toLowerCase()` so no breakage. | **Resolved 2026-02** |

---

## 23. Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-02 | 1.0 | Initial Functional Specification created from codebase audit | Claude Code |
| 2026-02 | 1.0.1 | Resolved 3 discrepancies: breakpoint 1200px→1400px, added bluesky social, standardized day name casing | Claude Code |
| 2026-02 | 1.0.2 | Added Docsify documentation portal (`docs/index.html`). Updated Section 1 pages table. | Claude Code |

---

*This document is the authoritative record of application behavior. See `CLAUDE.md` for development workflow, architecture decisions, and project history. See `README.md` for public-facing documentation.*
