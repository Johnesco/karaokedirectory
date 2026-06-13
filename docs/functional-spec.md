# Austin Karaoke Directory — Functional Specification

> **Status:** Living document — must be updated with every code change.
> **Authority:** This is the single source of truth for application behavior. Code must match this spec; any discrepancy must be flagged and resolved.

**Version:** 1.0
**Last updated:** February 2026
**Application:** Austin Karaoke Directory
**Live site:** https://www.karaokedirectory.com

---

---

## 1 Overview

### Purpose

A mobile-friendly web application helping users discover karaoke venues in and around Austin, Texas. Users can browse venues by weekly schedule, alphabetical listing, or interactive map. The site provides schedule details, venue tags, host/KJ information, and social links.

### Target Users

Karaoke enthusiasts looking for venues, schedules, and event details in the greater Austin area.

### Architecture

- **Vanilla JavaScript** (ES6 modules), HTML5, CSS3 — currently no build step
- **Mobile-first responsive design** — base styles target mobile, enhanced for larger screens
- **Data layer** — all venue data in a single JavaScript file (`js/data.js`), currently 79 venues; Supabase wiring exists but is dormant (see §11 *Storage and Data Flow*)
- **Component-based** — `Component` base class with state management and event bus
- **Balanced calendar visibility** — daily venues must not overwhelm less frequent shows in the weekly calendar view; Alphabetical and Map views show everything equally

### Pages

| Page | File | Purpose |
|------|------|---------|
| Main app | `index.html` | Single-page app with all three views |
| About | `about.html` | Project info, feature overview, contact |
| Bingo | `bingo.html` | Karaoke bingo game |
| Submit | `submit.html` | Venue submission form |
| Spec viewer | `docs/index.html` | Docsify-powered documentation portal (renders this spec) |

---

## 2 Weekly Calendar View

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
- One venue card per **matching schedule entry** (a venue with two events on the same date renders two cards, each showing its own event name, time, and host)
- Footer with **unique venue count** (e.g., "14 venues" even if 15 cards rendered because one venue had two events)
- **Venue card layout:** single column on mobile (≤768px); at 769px+ cards flow into a responsive grid (`repeat(auto-fill, minmax(320px, 1fr))` — 2 columns at ~1024px, up to 4 on large screens). Cards in the same grid row stretch to equal height. The same grid applies to letter cards in the Alphabetical view.

### Sorting

- **Special events first** — schedule entries with `frequency: "once"` matching that date sort to the top
- **Then alphabetical** — remaining entries sorted by `getSortableName()` (ignores articles like "The", "A", etc.)
- **Ties** broken by `startTime` so multiple events at the same venue read chronologically

### "Also …" Indicator (Other Nights)

Below the time row, each card shows a small calendar icon and an "Also …" line listing the venue's other dates/days. To avoid confusing self-reference, this list **excludes any schedule entry that also matches the current card's date** — so a card rendered for May 30 will never list "May 30" in its Also line, even if the venue has another event that day (which would render as a separate card immediately adjacent).

### Interaction

- **Click past day header** — toggles expand/collapse
- **Click venue card** (except links) — emits `VENUE_SELECTED` event, opens venue detail
- **Links** (address, event URLs) — open directly, do not trigger venue detail

### Auto-Scroll

When viewing the current week, the page scrolls to today's day card after render using `scrollIntoView({ behavior: 'instant', block: 'start' })`.

> **Implementation note:** WeeklyView creates day cards via `renderDayCard()` — a template helper that instantiates a temporary DayCard, calls `template()`, and returns an HTML string (no persistent component instance). Extended sections use `renderExtendedSection()` with a shared `seenVenues` Set passed across all three sections for deduplication. Auto-scroll to today runs in `afterRender()`. See [Architecture: Component Hierarchy](architecture.md#2-component-hierarchy) for the template helper pattern.

### Filtering

- Respects the "Show dedicated" toggle
- Respects the search query — day cards with no matching venues collapse to `.day-card--empty`
- Re-renders on `FILTER_CHANGED` event

### Extended Sections

Below the current 7-day week, three additional collapsible sections display venues on future dates. These sections are always visible — both when browsing and when searching.

#### Sections

| Section | Date Range | Deduplication |
|---------|------------|---------------|
| **Next Week** | Full 7 days following the current week | None — shows all venues |
| **Later in [Month]** | Days after next week through end of current month | First occurrence only (skip if seen above) |
| **[Next Month]** | Following calendar month (capped at 60 days from today) | First occurrence only (skip if seen above) |

#### Behavior

- Each section has a header showing title and venue count badge
- Sections are collapsible — click header to toggle
- Collapse state persists in `localStorage` (key: `extendedSection_{title-slug}_collapsed`)
- Empty sections (no venues in date range) are not rendered
- Day cards within sections use the same format as the current week
- Maximum lookahead is 60 days from today

#### Deduplication Logic

- Track venue IDs in a `Set` as sections render in order
- "This Week" and "Next Week": add all venue IDs to set, show all
- "Later in [Month]" and "[Next Month]": skip venues already in set, then add new ones
- When deduplication removes venues, a notice appears: "Plus X recurring venues already shown above" (styled as `.extended-section__dedup-notice`)
- The notice only appears in sections with `deduplicate: true` and only when at least one venue was hidden

This prevents the same weekly-recurring venue from appearing multiple times across sections.

#### Implementation

- Component: `ExtendedSection` (`js/components/ExtendedSection.js`)
- CSS classes: `.extended-section`, `.extended-section__header`, `.extended-section__content`, `.extended-section--collapsed`, `.extended-section__dedup-notice`
- WeeklyView method: `renderExtendedSections()`

---

## 3 Alphabetical View

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
- **Desktop (769px+):** letters wrap across rows, centered
- **Mobile (≤768px):** letters stay on a single horizontally-scrollable row (~54px tall vs. ~131px wrapped), with 40px touch targets; the `--az-index-height` observer keeps letter headings pinned directly below the strip regardless of its height

> **Implementation note:** Alphabetical sorting uses `getSortableName()` from `js/utils/string.js`, which strips leading articles ("The", "A", "An", etc.) for sort ordering while preserving the original name for display. The sticky index height is dynamically measured via `ResizeObserver` and written to `--az-index-height` so CSS can position letter group headings below it without hardcoding pixel values.

### Empty State

If no venues match the current search/filter, displays "No venues match your search." with no letter index.

### Filtering

- Respects the "Show dedicated" toggle
- Respects the search query
- Re-renders on `FILTER_CHANGED` event

---

## 4 Map View

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

> **Implementation note:** Leaflet and MarkerClusterGroup are loaded lazily — CDN script tags are injected on first map render, not on page load. The custom purple marker icon is created as an `L.divIcon` (CSS-styled div, not an image file). The floating venue card is managed as component-local state within MapView, not via VenueModal — `VenueModal` checks `getState('view') !== 'map'` and skips opening when the map is active.

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
| **Details** (expanded) | Full location, schedule, host, socials, contact info, "Share" button |

- Close button (X) hides the card
- "Details" button expands the card and shows a back arrow
- "Back to Summary" returns to compact view
- Clicking the map background (not a marker or card) dismisses the card
- **Sizing:** full-width bottom sheet on mobile; on desktop (≥1024px) a fixed 350px-wide card anchored right (explicit width so it doesn't shrink to its content). The floating "Hide Dedicated" map control and the analytics consent-banner buttons are ≥44px tall (touch targets).

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

## 5 Navigation and Controls

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

Visible inline on desktop **and phablets** (561px+). On phones (≤560px) the input collapses behind a magnifying-glass toggle button — see Section 9 (Search) for full behavior.

### Dedicated Venue Filter

Always visible. Label reads "Show dedicated venues" on desktop/phablet, compact "Dedicated" on phones (≤560px). See Section 10 (Filtering) for full behavior.

### Responsive Layout Tiers

The navigation has three tiers, sharing the desktop markup:

| Tier | Width | Layout |
|------|-------|--------|
| **Desktop** | 769px+ | Single roomy bar; labeled tabs; inline search; full toggle label |
| **Phablet** | 561–768px | Desktop-style labeled nav — tabs + week nav on row one, inline search + toggle on row two (~115–130px) |
| **Phone** | ≤560px | Compact two rows (~102px, sticky): icon-only tabs (40px min-height) on row one; week nav + compact "Dedicated" toggle + search toggle button on row two (wraps to a third row when the "Today" button is present) |

On phones, the search toggle button (40×40, `aria-expanded`) expands the search input as a full-width row and focuses it. The row stays open while a query is active (including across re-renders). Collapsing via the toggle also **clears any active query** so a filter can never remain applied while its input is hidden.

### Navigation Height Tracking

The navigation bar's height is tracked by a `ResizeObserver` and stored as CSS variable `--nav-height`, used for sticky positioning in child views.

---

## 6 Venue Cards

**File:** `js/components/VenueCard.js`

Venue cards appear in two modes depending on context.

### Compact Mode

Used in: Weekly Calendar day cards, Map floating card summary.

Displays:
- **Venue name** — clickable button
- **Special event indicator** — star icon + event name (for `frequency: "once"` events). If `eventUrl` is set, event name is a link. Adds `.venue-card--special-event` class and injects `special-event` tag.
- **Frequency + time** — clock icon + frequency label + time range. Format: "Every Friday · 9:00 PM - 1:00 AM" or "First Saturday · 9:00 PM - 1:00 AM". Frequency label is wrapped in `.venue-card__frequency` span with muted color. Skipped for `frequency: "once"` events (they already have event name line). If `eventUrl` is set (and not already shown as special event link), shows arrow link icon.
- **Additional schedule indicator** — Shows which other days/dates a venue has karaoke, replacing the old "+N more" count. Format depends on schedule composition:
  - **"Everyday"** — When all 7 weekdays are covered by `frequency: "every"` entries. No icon, just the text.
  - **"Also [days]"** — For 2–6 additional entries. Calendar-days icon + comma-separated abbreviated day names: "Also Tue, Wed". Ordinal frequencies include prefix: "Also 2nd & 4th Fri". One-time events show abbreviated date: "Also Mar 15".
  - Same-day ordinals are grouped with "&": "2nd & 4th Fri" instead of "2nd Fri, 4th Fri".
  - Only shown when `showSchedule` is true and venue has more than one schedule entry.
  - CSS class: `.venue-card__more-nights`.
- Both the frequency label and "Also ..." indicator are produced by `getScheduleContext()` in `js/utils/render.js`.
- **Address** — location icon + full address as Google Maps link
- **Host** — "Presented by [host display]" (compact format: company name, or name if no company)
- **Tags** — color-coded badge list

### Full Mode

Used in: Alphabetical View.

Displays everything in compact mode plus:
- **Complete schedule** — all schedule entries listed (not just the one matching today)
- **Host section** — full host name, company, website
- **Social links** — all venue social media icons
- **Active period notice** — if venue has active period

### Debug Info

When debug mode is enabled (`?debug=1`), compact cards show the schedule match reason at the top (e.g., "Every Friday", "First Saturday").

### Click Behavior

- Clicking the venue name button emits `VENUE_SELECTED`
- Clicking links (address, social, event URL) opens the link directly without triggering venue detail
- In Weekly and Alphabetical views, clicking anywhere on the card (except links) also triggers `VENUE_SELECTED`

> **Implementation note:** Compact cards are rendered via `renderVenueCard()`, which creates a temporary VenueCard instance, calls `template()`, and returns the HTML string — no persistent component instance is kept. Schedule display uses `getScheduleForDate()` which prioritizes `once` entries (special events) over recurring entries for the matching date. Full-mode cards (Alphabetical view) render all schedule entries. The `formatHostDisplay()` function from `js/utils/render.js` generates the compact "Presented by" line.

---

## 7 Venue Detail (Mobile Modal)

**File:** `js/components/VenueModal.js`

Full-screen modal overlay for viewing venue details on smaller screens.

### When It Opens

The modal opens only when ALL of these conditions are met:
- A `VENUE_SELECTED` event fires
- Window width is **less than 1400px**
- The current view is **not** the map view (map uses its own floating card)

> **Implementation note:** The open guard in VenueModal checks `window.innerWidth < 1400` AND `getState('view') !== 'map'`. Schedule tables, host sections, and active period notices are rendered using shared utilities from `js/utils/render.js` (`renderScheduleTable()`, `renderHostSection()`, `renderActivePeriod()`) — the same functions used by VenueDetailPane and MapView's expanded card.

### Content Sections

| Section | Content |
|---------|---------|
| Header | Venue name, event name (if special event), tags |
| Location | Full address, "View Map" button, "Directions" button, "Share" button |
| Schedule | Schedule table (all entries) + active period notice if applicable |
| Host | Host name, company, website, social links |
| Social Media | Venue social links (if any) |
| Contact | Phone number link (if venue has phone field) |

Schedule tables, host sections, and active period notices are rendered using shared utilities from `js/utils/render.js`.

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

## 8 Venue Detail (Desktop Pane)

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

## 9 Search

The app includes a global search bar that filters venues across all views.

### Search Input

Located in the Navigation component. Visible inline on desktop and phablets (561px+); on phones (≤560px) hidden behind a magnifying-glass toggle button in the navigation bar.
- **Placeholder:** "Search venues, tags, hosts..."
- **Clear button** (X icon) appears when search has text; clicking clears input and refocuses it
- Typing updates the `searchQuery` state and emits `FILTER_CHANGED`
- **Phone toggle (≤560px):** opening expands the input as a full-width row and focuses it; closing the toggle while a query is active clears the query (prevents invisible active filters). The row stays expanded while a query is active.

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

### Search Behavior by View

- **Weekly:** Day cards with no matching venues collapse to `.day-card--empty`. Days with matches show only matching venues. Extended sections also filter to show only matching venues (see [Section 2: Extended Sections](#extended-sections)).
- **Alphabetical:** Letter groups only show matching venues. Letters with no matches disappear. Empty results show "No venues match your search."
- **Map:** Only matching venues with coordinates appear as markers.

### Extended Sections and Search

The Weekly view's extended sections (Next Week, Later in Month, Next Month) are always visible — see [Section 2: Extended Sections](#extended-sections) for full details. When a search query is active, the extended sections filter to show only matching venues, just like the current week's day cards.

### Preservation of Input Focus

The Navigation component does **not** re-render when search changes, to preserve keyboard focus in the input field. Only the views re-render.

> **Implementation note:** Navigation updates `searchQuery` state and emits `FILTER_CHANGED` but does NOT subscribe to `searchQuery` — this prevents Navigation from re-rendering (which would destroy and recreate the input element, losing keyboard focus). Views subscribe to `FILTER_CHANGED` via the event bus and independently call `this.render()`. The search matching logic lives in `venueMatchesSearch()` in `js/services/venues.js`, which handles all field matching (name, city, neighborhood, host, company, tags by ID and label, dedicated keyword).

---

## 10 Filtering

### Dedicated Venue Filter

- **UI:** Checkbox labeled "Show dedicated venues" in Navigation
- **Default state:** `showDedicated: true` (dedicated venues are shown)
- **When unchecked:** Venues with `dedicated: true` are excluded from all views
- **Map view:** A floating "Show/Hide Dedicated" button replaces the checkbox

### Active Period Filtering

Venues with an `activePeriod` field only appear when the current date falls within `activePeriod.start` and `activePeriod.end` (inclusive). This is automatic — no user control.

### KJ Index (`?kj=all`)

- **URL-driven:** `index.html?kj=all` renders `KJIndexView` — an alphabetical directory of every unique KJ name in the dataset.
- **Source:** Walks every active venue and collects names from `venue.host.{name,company}` and per-show `schedule[N].host.{name,company}`. Case-insensitive de-dupe (display name preserved from first occurrence).
- **Each entry:** KJ name + venue count, linking to `?kj=<encoded name>` (real anchor — page reloads into `KJDossierView`).
- **Chip:** Reads "All KJs" (special-cased) instead of the literal "all". × exits to weekly view.
- **Empty state:** "No KJs found in the directory." (renders when data has zero host fields populated).

### KJ Dossier (`?kj=<name>`)

- **Audience:** KJs auditing their own listings ("what do I have up on karaokedirectory?"). Not a customer-facing filter.
- **URL-driven:** Append `?kj=<name>` to `index.html` (e.g. `index.html?kj=xpider`). Discoverable via `?kj=all`.
- **Match scope:** Case-insensitive substring against `venue.host.{name,company}` and per-show `schedule[N].host.{name,company}` only. Does NOT match venue name, city, tags, or event names.
- **Replaces the normal views:** `KJDossierView` renders in place of weekly/alphabetical/map. Navigation collapses to a minimal bar showing just the `KJ: <name>` chip with a × close button (clearing the chip exits dossier mode and strips `?kj=` from the URL).
- **Layout per venue:**
  - Venue name + address
  - All recurring slots that belong to this KJ (one entry per slot, sorted Sunday → Saturday)
  - All upcoming one-time events that belong to this KJ (sorted chronologically, with weekday + date + time + event name). Past one-times are excluded.
- **Multi-host venues:** Only entries whose per-show host matches the KJ are shown. A venue with 4 events split 2/2 between two KJs shows only that KJ's 2 entries in their dossier.
- **Empty state:** "No venues currently listed" with a hint to check spelling or contact the directory.
- **State:** `hostFilter` key. URL ↔ state sync via `history.replaceState`. Re-renders the view (not just the data) on change, because dossier and normal views are different view classes.

### Filter Event Flow

1. User changes filter (dedicated toggle, search input) or loads a URL with `?kj=`
2. State updated (`showDedicated`, `searchQuery`, or `hostFilter`)
3. `FILTER_CHANGED` event emitted
4. All views re-render with filtered results

---

## 11 Venue Data Model

**Source files:** `js/data.json` (canonical authoring source — #102, ADR-006), `js/data.js` (browser runtime wrapper, auto-generated from `data.json` by `scripts/sync-data-js.js`), Supabase tables `venues` and `tags` (future runtime source of truth — currently disabled). Dev scripts read `data.json` directly; CI fails if `data.js` is out of sync.

The shape `{ tagDefinitions, listings }` is the contract — both the local file and the Supabase service expose data this way. See [Storage and Data Flow](#storage-and-data-flow) below for how the two stay in sync. The full venue object schema lives in [`schema/venue.schema.json`](../schema/venue.schema.json) — see ADR-005.

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

  activePeriod          object        OPTIONAL  Limits when venue appears
    activePeriod.start  string        "YYYY-MM-DD"
    activePeriod.end    string        "YYYY-MM-DD"

  host                  object|null   OPTIONAL
    host.name           string        OPTIONAL  Individual KJ name
    host.affiliation    string        OPTIONAL  Parent company/org (e.g. "Starling Karaoke")
    host.website        string        OPTIONAL  Host/KJ personal website

  socials               object|null   OPTIONAL
    socials.website     string        OPTIONAL
    socials.facebook    string        OPTIONAL
    socials.instagram   string        OPTIONAL
    socials.twitter     string        OPTIONAL
    socials.tiktok      string        OPTIONAL
    socials.youtube     string        OPTIONAL
    socials.bluesky     string        OPTIONAL

  phone                 string        OPTIONAL  Venue phone number (displayed in detail views)
}
```

### Venue Count

As of April 2026: **79 venues** in the listings array.

### Active/Inactive

Venues default to active. Setting `active: false` hides the venue from all views, searches, and counts. The venue remains in data but `getAllVenues()` and all query functions exclude it.

### Sortable Name

The `getSortableName()` utility strips leading articles for sorting purposes. "The Highball" becomes "Highball, The" and sorts under "H". Recognized articles include English (a, an, the), French, Spanish, Italian, and Portuguese articles.

### Storage and Data Flow

Venue data is stored in two places:

- **`js/data.js`** — the canonical authoring source AND the **currently active runtime source**. Hand-edited or written by the venue editor.
- **Supabase** — fully wired but **currently disabled** via `useSupabase: false` in `js/config.js`. The infrastructure (schema migrations, seed pipeline, service layer) is in place for when expansion (#17 National Expansion) requires it. See issue #47 for the JSONB redesign that's ready to push.

Runtime fetch priority (configured in `js/config.js` via the `useSupabase` flag):

1. `sessionStorage` cache (30-minute TTL)
2. Supabase via `js/services/supabase.js` `fetchVenueData()`
3. `window.karaokeData` global from `js/data.js` script tag (fallback)
4. ES module import of `js/data.js` (legacy fallback)

The debug indicator (`?debug=1`) shows which source served the current page: `cache`, `supabase`, or `local-fallback`.

#### Supabase Schema (issue #47 — JSONB redesign)

Two tables only. The `venues.data` JSONB column holds the bulk of the venue object; `id`, `name`, and `active` are pulled out as columns for primary-key / sort / RLS-filter use.

| Table | Columns |
|-------|---------|
| `tags` | `id` (text PK), `label` (text), `color` (text), `text_color` (text) |
| `venues` | `id` (text PK), `name` (text), `active` (bool), `data` (jsonb) |

The `data` JSONB matches the Venue Object Schema above minus the three top-level columns: `dedicated`, `tags[]`, `address{}`, `coordinates{}`, `host{}`, `socials{}`, `schedule[]`, `activePeriod{}`.

RLS: tags publicly readable; venues filtered to `active = true` for anonymous access.

Migration history: `001_initial_schema.sql` (original 5-table normalized model), `002_rls_policies.sql`, `003_scale_indexes.sql`, `004_jsonb_redesign.sql` (current — collapses to 2 tables).

#### Reseeding from data.js

When `js/data.js` changes, regenerate Supabase from it:

1. `node scripts/audit-for-supabase.js` — validates data.js against logical rules (duplicate IDs, valid tag refs, schedule shape, etc.)
2. `node supabase/seed-from-data.js > supabase/seed.sql` — emits `INSERT INTO tags` + `INSERT INTO venues (id, name, active, data) VALUES (..., '{json}'::jsonb)` rows
3. Run `004_jsonb_redesign.sql` followed by the regenerated `seed.sql` in the Supabase SQL editor (the migration drops + recreates tables, so the seed runs against an empty schema)

There is no automatic sync. data.js → Supabase is a manual push by an authorized editor.

---

## 12 Tag System

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

## 13 Schedule Matching

**File:** `js/utils/date.js` — `scheduleMatchesDate(schedule, date)`

This is the core logic that determines which venues appear on which days.

### One-Time Events (`frequency: "once"`)

A one-time event matches if the `schedule.date` string (YYYY-MM-DD) equals the formatted date. Only the date matters; times are not evaluated for matching purposes.

**Example:** `{ frequency: "once", date: "2026-03-15" }` matches March 15, 2026 only.

### Recurring Events

For recurring events, matching follows two steps:

**Step 1 — Day of week check:**
The day-of-week of the target date must match `schedule.day`. Comparison is **case-insensitive** (e.g., "Friday" and "friday" both match). If the day doesn't match, the schedule does not match.

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

> **Implementation note:** `scheduleMatchesDate()` in `js/utils/date.js` performs all matching. Nth-weekday occurrence is computed as `Math.ceil(date.getDate() / 7)` — day 1–7 = first, 8–14 = second, etc. "Last" detection checks if `date + 7 days` crosses the month boundary (`nextWeek.getMonth() !== date.getMonth()`). Day-of-week comparison is case-insensitive via `.toLowerCase()`. See [Patterns: Add a Schedule Frequency](patterns.md#recipe-add-a-schedule-frequency) for the full switch statement.

### Active Period Filtering

Separate from schedule matching. If a venue has `activePeriod`, it only appears when the current viewing date is within `activePeriod.start` and `activePeriod.end` (both inclusive). Checked via `isDateInRange()`.

### Time Formatting

- Internal storage: 24-hour format `"HH:MM"`
- Display: 12-hour format via `formatTime12()` — e.g., `"21:00"` displays as `"9:00 PM"`
- Time ranges: `formatTimeRange()` — e.g., `"9:00 PM - 1:00 AM"` or `"9:00 PM - Close"` (when endTime is null)

---

## 14 Karaoke Bingo Game

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

## 15 Venue Submission Form

**File:** `submit.html`

Single-purpose mobile-first form for community submissions of new karaoke venues. Optimized for KJs/fans on a phone with limited time. Single column on mobile (<768px), multi-column on tablet+. Touch targets ≥44×44 px, native input types for keyboard intent (`type="time"`, `type="url"`, `type="email"`, `type="tel"`, `inputmode="numeric"` on ZIP), 16px input font-size to prevent iOS auto-zoom, sticky submit button always reachable.

The City / State / ZIP row uses an explicit `2fr 1fr 1fr` template at ≥561px (City wider; State/ZIP narrow, with `min-width: 0` so they shrink below the inputs' intrinsic width rather than clamping equal), stacking to one column below that. This keeps the three fields on one row without orphaning ZIP — the generic `auto-fit` floor otherwise fit only two columns and its min-content overflowed the form near 760px.

### Required vs optional split

The form is structured as a short required-fields zone, then a single `<details>` toggle ("Add more details") containing everything optional. Selecting "I'm the KJ/Host" auto-expands the details and scrolls the contact section into view.

**Required (blocks submission):**

| Field | Notes |
|-------|-------|
| Venue Name | |
| Street | `autocomplete="street-address"` |
| City | Default "Austin", `autocomplete="address-level2"` |
| ZIP | `pattern="\d{5}(-\d{4})?"`, `inputmode="numeric"` |
| Schedule (≥ 1 entry) | First entry needs a day (recurring) or date (one-time); start/end times default to 21:00 / 01:00 |

**Optional, always visible:**

| Field | Notes |
|-------|-------|
| State | Default "TX", `maxlength="2"` |
| Submitter type radio | Default "Just a fan / patron"; selecting "I'm the KJ / Host" reveals required indicators on Name + Contact and auto-opens the details panel |
| Add another night | Schedule entries are dynamic; each beyond the first has a remove button |

**Optional, collapsed under "Add more details":**

| Section | Fields |
|---------|--------|
| Tags | Tag checkboxes (chip-style) generated at load from `karaokeData.tagDefinitions` — adding a tag to data.js auto-surfaces here, no parallel hardcoded list. System tags (`dedicated`, `special-event`) and age tags are excluded from the grid; age restriction is its own radio (not sure / 21+ / 18+ / all-ages / family-friendly) whose value joins the `tags: []` array at submit time, matching the schema's "age is a tag" shape. |
| Host / KJ Info | Host name, company, host website |
| Venue Social Links | Website, Facebook, Instagram (3 fields — other platforms intentionally cut to reduce friction; curator can add via editor) |
| Notes | Free-text textarea |
| Your Contact Info | Submitter name (required if KJ); contact methods checkboxes (email, phone text, phone call, other), each reveals its input on check |

**Removed from the form (handled by curator out-of-band):**

- Coordinates (lat/lng) — geocoded by curator
- Neighborhood — only ~50% filled in current data; curator adds when relevant
- Dedicated checkbox — curator decides
- Active period dates — only ~6% used in current data
- Twitter, TikTok, YouTube, Bluesky social fields — low submitter uptake; curator adds if surfaced
- Report Issue tab — removed entirely (focus on new-venue submissions; report flow may return as a separate page later)
- "Preview JSON" button — low value on mobile

### Bot protection

Hidden honeypot field `website_url` (positioned offscreen via `.hp-field` CSS) with `aria-hidden` and `tabindex=-1`. If filled, `collectFormData()` returns null and submission silently fails (bots get no signal of detection).

### Rate Limiting

- Maximum 3 submissions per hour per browser
- Tracked via `localStorage` key `karaoke-submit-history`
- Warning shown when approaching limit
- Submit button disabled at limit
- Countdown shows when submissions will be available again

### Submission Flow

1. Inline-validate required fields; scroll to and highlight first offender if missing (form uses `novalidate` so the JS controls UX rather than the native browser bubble)
2. KJ-specific validation: name + at least one contact method
3. Check honeypot and rate limit
4. POST to Google Apps Script backend (`mode: 'no-cors'` — opaque response is treated as success)
5. **On success:** Shows success message, saves timestamp, updates rate limit counter
6. **On failure:** Offers fallback options:
   - Open in email app (pre-formatted `mailto:` link with venue JSON in body)
   - Copy to clipboard (formatted text in textarea)

### Email body format

`formatEmailBody()` produces a structured plaintext email containing the full venue object as JSON between two `----...----` delimiter lines, plus submitter metadata and a TODO checklist (verify info, geocode, add to data.js). The JSON block is intended to be copy-paste-ready for the curator's editor workflow.

### Payload shape contract (#101)

The `venue` object inside the Apps Script payload validates against [`schema/venue.schema.json`](../schema/venue.schema.json) as a **partial venue** — the same schema the curator targets and CI enforces (ADR-005). Fields submit does not collect (coordinates, neighborhood, activePeriod, per-show host override, the four less-common social platforms, `dedicated`) are simply absent; the schema marks them optional. Empty-string defaults and `null` placeholders are suppressed at assembly time so the curator never has to translate "blank" into "absent". A future ticket may add an Ajv-based pre-send check in the browser; today the shape is verified end-to-end by piping the captured payload through the schema in a Node script (see issue #101).

---

## 16 Venue Editing (out of scope for this repo)

**Status:** The in-repo `editor.html` was removed. Venue editing now happens in a **local-only curator tool** maintained by the project owner outside this repo. That tool is a single-page HTML app that holds the venue data plus private curator metadata (sources, contacts, notes, last-verified dates), and exports a public-stripped `js/data.js` to publish.

This spec section previously described the in-repo editor's UI in detail; that content is no longer applicable. If you're a contributor who needs to add or modify a venue and don't have access to the curator tool, edit `js/data.js` directly per the schema in §11 and open a PR — the owner will reconcile your change with the curator master.

---

## 17 About Page

**File:** `about.html`

Static informational page.

### Sections

1. **About Us** — Mission statement, disclaimer to verify with venues
2. **What You Can Do** — Seven feature highlights with icons (weekly calendar, A-Z listing, interactive map, search, venue tags, special events, karaoke bingo)
3. **Submit a Venue** — Link to `submit.html`
4. **Submit Feedback** — Link to Google Form
5. **For Developers** — Link to Functional Specification (`docs/index.html`)
6. **Contact Us** — Social links: Facebook Group, Instagram (@karaokedirectory)

### Footer

Includes a "Documentation" link to `docs/index.html`.

### Header

- Title: "Greater Austin Karaoke Directory"
- Tagline: "NOTE HOLIDAY MAY CHANGE AVAILABILITY, CALL VENUE FIRST"
- Navigation link back to `index.html`

### Reading Measure

The `<body>` carries the `page--readable` class, which constrains `.main-content` to a 600px max-width (centered) so running prose holds a comfortable ~74-character line length instead of the app's 1400px grid width (~165 chars). The class is reusable for any future content/prose page.

---

## 18 Debug Mode

**File:** `js/utils/debug.js`

### Enabling

- URL parameter: `?debug=1`
- Or console: `localStorage.setItem('debug', '1')`

### Behavior When Enabled

- **Debug indicator** — "Debug Mode" badge in the top-right corner
- **Venue cards** — show schedule match reason (e.g., "Every Friday", "First Saturday", "Once: 2026-03-15")
- **Hover info** — detailed match information on card hover

---

## 19 Responsive Design

### Breakpoints

| Width | Behavior |
|-------|----------|
| Phone (≤560px) | Single column, modal for venue details; compact two-row navigation (~102px sticky) with collapsible search; single-row scrollable A–Z index |
| Phablet (561–768px) | Desktop-style labeled navigation with inline search (~115–130px); single column content |
| 769px+ | Venue cards flow into a multi-column grid (`auto-fill, minmax(320px, 1fr)`) inside day/letter cards; labeled nav buttons |
| 1024px+ | More grid columns as space allows |
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

## 20 Security

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

## 21 State Management and Events

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

### URL Hash Sync and Shareable Links

**File:** `js/app.js`, `js/utils/url.js`

Venue selections are reflected in the URL hash, enabling shareable direct links to specific venues.

#### Hash Format

`#view=weekly&venue={venue-id}` — e.g., `index.html#view=weekly&venue=egos`

#### Behavior

| Action | URL Effect |
|--------|-----------|
| User selects a venue (click, marker, etc.) | Hash updates to `#view=weekly&venue={id}` via `replaceState` |
| User closes venue detail (modal, pane, card) | Hash is cleared via `replaceState` |
| Page loads with `#view=weekly&venue={id}` | Switches to weekly view, then opens venue detail |
| Bare `#venue={id}` (no view param) | Defaults to weekly view, then opens venue detail |
| Page loads with `#view=weekly`, `#view=map`, etc. | Switches to that view |
| Legacy `#weekly`, `#alphabetical`, `#map` | Still supported for backwards compatibility |

- `history.replaceState` is used (not `location.hash`) to avoid creating back-button entries for each venue click and to prevent recursive `hashchange` events.
- On initial page load, `handleHashChange()` is called after views are initialized to handle deep links.

#### Share Button

All three venue detail surfaces include a "Share" button alongside "View Map" and "Directions":

| Surface | Button Class | Location |
|---------|-------------|----------|
| Mobile modal (`VenueModal`) | `.venue-modal__share` | Location section map-links |
| Desktop pane (`VenueDetailPane`) | `.detail-pane__share` | Location section map-links |
| Map card (`MapView`) | `.map-venue-card__share` | Expanded details map-links |

**Behavior:**
- **Mobile** (Web Share API available): Opens the native share sheet with venue name and URL
- **Desktop** (no Web Share API): Copies the venue URL to clipboard and shows "Copied!" feedback on the button for 2 seconds

The `shareVenue(venue, buttonEl)` utility in `js/utils/url.js` handles both paths.

> **Implementation note:** State subscriptions in components use the pattern `this.subscribe(subscribe('key', cb))` — the inner `subscribe()` (from state.js) returns an unsubscribe function, and the outer `this.subscribe()` (from Component.js) stores that function in `_subscriptions[]`. On `destroy()`, Component iterates `_subscriptions` and calls each stored function, automatically cleaning up all listeners. There are three state tiers: **global** (state.js `setState`/`subscribe`), **component-local** (`this.setState` on Component base class — triggers re-render and `onStateChange`), and **service-level** (module-scoped variables in venues.js, mutated by `initVenues()`). See [Architecture: State Management](architecture.md#5-state-management) for diagrams.

---

## 22 SEO and Social Metadata

### Meta Descriptions

Each public-facing page includes a `<meta name="description">` tag with a concise summary (~150 characters) for search engine result snippets.

| Page | Description |
|------|-------------|
| `index.html` | "Find karaoke in Austin, TX. Browse 70+ venues by day, search by name or neighborhood, and explore the interactive map." |
| `about.html` | "Learn about the Greater Austin Karaoke Directory — a community-sourced guide to karaoke nights across Austin, Texas." |
| `submit.html` | "Submit a karaoke venue to the Greater Austin Karaoke Directory. Help us keep Austin's karaoke scene up to date." |
| `bingo.html` | "Play Karaoke Bingo at your next karaoke night! A fun interactive game from the Austin Karaoke Directory." |

### Open Graph and Twitter Card Tags

Each public page includes Open Graph (`og:title`, `og:description`, `og:type`, `og:url`) and Twitter Card (`twitter:card`, `twitter:title`, `twitter:description`) meta tags. These control how links appear when shared on social media. No `og:image` or `twitter:image` is set — shares use text-only cards until a social preview image is added.

### Canonical URLs

Each public page includes a `<link rel="canonical">` tag pointing to its canonical URL on `https://karaokedirectory.com/`. This prevents duplicate content issues if the site is accessible from multiple domains or with query parameters.

### Crawler Directives

**`robots.txt`** (project root):
- Allows all crawlers to index public pages
- Disallows `/docs/` (internal tools)
- References `sitemap.xml`

**`sitemap.xml`** (project root):
- Lists all 5 public pages for search engine discovery
- Does not include `docs/`


### Pages Excluded from Indexing

| Page | Reason | Mechanism |
|------|--------|-----------|
| `docs/index.html` | Developer documentation (Docsify) | `robots.txt` |

---

## 23 Known Discrepancies

> Items listed here represent differences found between existing documentation and code during the initial spec creation. Each must be validated and resolved.

| # | Area | Issue | Resolution | Status |
|---|------|-------|------------|--------|
| 1 | Detail pane breakpoint | CLAUDE.md said "1200px+", code uses 1400px | CLAUDE.md updated to 1400px | **Resolved 2026-02** |
| 2 | Social platforms | `url.js` supports bluesky but it was missing from CLAUDE.md venue schema | Added `bluesky` to socials in CLAUDE.md and functional spec | **Resolved 2026-02** |
| 3 | Day name casing | Data file used lowercase day names ("friday"), docs showed capitalized ("Friday") | All day entries in `data.js` standardized to initial capital ("Friday"). Matching code uses `.toLowerCase()` so no breakage. Two missed entries fixed in v1.0.5. | **Resolved 2026-02** |

---

## 24 Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-02 | 1.0 | Initial Functional Specification created from codebase audit | Claude Code |
| 2026-02 | 1.0.1 | Resolved 3 discrepancies: breakpoint 1200px→1400px, added bluesky social, standardized day name casing | Claude Code |
| 2026-02 | 1.0.2 | Added Docsify documentation portal (`docs/index.html`). Updated Section 1 pages table. | Claude Code |
| 2026-02 | 1.0.3 | Fixed case-sensitivity bug in day name matching for VenueCard and editor. Added `.toLowerCase()` to comparisons. | Claude Code |
| 2026-02 | 1.0.4 | Removed references to non-existent test suite (`tests/index.html`) from all documentation. | Claude Code |
| 2026-02 | 1.0.5 | Spec audit: Added live site URL, updated venue count to 70, fixed 2 lowercase "thursday" entries in data.js, removed unimplemented event name search from Section 9, added phone field to schema. | Claude Code |
| 2026-02 | 1.0.6 | Taiga #6: Added documentation links to about.html ("For Developers" section) and footer. Updated Section 17. | Claude Code |
| 2026-02 | 1.0.7 | Taiga #20: Fixed day name casing in submit.html - dropdown values now capitalized ("Sunday" not "sunday"). | Claude Code |
| 2026-02 | 1.0.8 | Taiga #16: Added Bluesky field to editor.html and submit.html. Updated editor.js to read/write bluesky. | Claude Code |
| 2026-02 | 1.0.9 | Taiga #17: Added TikTok and YouTube fields to submit.html. Updated collectFormData(). Section 15 now lists all 7 social platforms. | Claude Code |
| 2026-02 | 1.0.10 | Taiga #18: Added Neighborhood field to submit.html Address section. Updated collectFormData() and Section 15. | Claude Code |
| 2026-02 | 1.0.11 | Taiga #19: Added special event support to submit.html. "Once" frequency with date/eventName/eventUrl fields. Updated Section 15. | Claude Code |
| 2026-02 | 1.0.12 | Added extended search results in Weekly view. When searching, shows Next Week, This Month, and Next Month sections with collapsible day cards. Updated Section 9. | Claude Code |
| 2026-02 | 1.0.13 | Migrated project management from Taiga to GitHub Issues + Projects. All work items now tracked as GitHub Issues with labels, milestones, and a Projects kanban board. Issue templates enforce documentation-first workflow. Commit convention changed from `Taiga #XX` to `#XX` (GitHub issue numbers). | Claude Code |
| 2026-02 | 1.0.14 | #16: Added frequency labels to venue cards ("Every Friday · 9:00 PM – 1:00 AM") and dedup notice to extended sections ("Plus X recurring venues already shown above"). | Claude Code |
| 2026-02 | 1.0.15 | #17: Extended sections (Next Week, Later in Month, Next Month) now always visible in Weekly view, not just during search. #18: Renamed SearchSection component to ExtendedSection. Updated Section 2 with Extended Sections subsection, rewrote Section 9 to reference it. | Claude Code |
| 2026-02 | 1.0.16 | #21: Added "+N more" indicator to compact venue cards. Shows when venue has multiple schedule entries. Updated Section 6. | Claude Code |
| 2026-02 | 1.0.17 | #22: Added implementation note blockquotes to sections 2, 3, 4, 6, 7, 9, 13, 21. Created `docs/architecture.md` and `docs/patterns.md`. Added Mermaid plugin to Docsify portal. Updated sidebar. | Claude Code |
| 2026-02 | 1.0.18 | #30: Unified frequency label and "+N more" indicator into `getScheduleContext()` in `render.js`. Removed inline logic from `VenueCard.compactTemplate()`. Updated Section 6. | Claude Code |
| 2026-02 | 1.0.19 | #31: Added Display Principle #5 — Balance Visibility. Documented in CLAUDE.md Display Philosophy section. | Claude Code |
| 2026-02 | 1.0.20 | #32: Replaced "+N more" with smart "Also [days]" / "Everyday" schedule indicator on compact venue cards. Added `buildAlsoText()` and `abbreviateDay()` helpers in `render.js`. Updated Section 6. | Claude Code |
| 2026-02 | 1.0.21 | Shareable venue links: URL hash syncs with venue selection (`#venue={id}`), share button on all detail surfaces (modal, pane, map card) with Web Share API / clipboard fallback. Added `shareVenue()` to `url.js`. Updated Sections 4, 7, 21. | Claude Code |
| 2026-02 | 1.0.22 | SEO quick wins: Added meta descriptions, Open Graph tags, Twitter Card tags, and canonical URLs to all 5 public pages. Created `robots.txt` and `sitemap.xml`. Added `noindex` to `editor.html`. New Section 22. Renumbered Sections 22–23 → 23–24. | Claude Code |

---

*This document is the authoritative record of application behavior. See `CLAUDE.md` for development workflow, architecture decisions, and project history. See `README.md` for public-facing documentation.*
