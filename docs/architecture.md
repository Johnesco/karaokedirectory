# Architecture Reference

> Visual guide to the Austin Karaoke Directory codebase. Diagrams are rendered via Mermaid.js in the Docsify portal.

---

## 1 Module Dependency Graph

The application is organized into five layers. Dependencies flow downward — upper layers import from lower layers, never the reverse.

```mermaid
graph TD
    subgraph App Layer
        APP[app.js]
    end

    subgraph Views
        WV[WeeklyView.js]
        AV[AlphabeticalView.js]
        MV[MapView.js]
    end

    subgraph Components
        NAV[Navigation.js]
        DC[DayCard.js]
        VC[VenueCard.js]
        VM[VenueModal.js]
        VDP[VenueDetailPane.js]
        ES[ExtendedSection.js]
        COMP[Component.js]
    end

    subgraph Services
        VS[venues.js]
    end

    subgraph Core
        STATE[state.js]
        EVENTS[events.js]
    end

    subgraph Utils
        DATE[date.js]
        STR[string.js]
        URL[url.js]
        TAGS[tags.js]
        DEBUG[debug.js]
        RENDER[render.js]
        VALID[validation.js]
    end

    APP --> WV
    APP --> AV
    APP --> MV
    APP --> NAV
    APP --> VM
    APP --> VDP
    APP --> VS
    APP --> STATE
    APP --> EVENTS
    APP --> DEBUG
    APP --> TAGS

    WV --> COMP
    WV --> DC
    WV --> ES
    WV --> STATE
    WV --> EVENTS
    WV --> DATE
    WV --> VS

    AV --> COMP
    AV --> VC
    AV --> STATE
    AV --> EVENTS
    AV --> VS
    AV --> STR

    MV --> COMP
    MV --> STATE
    MV --> EVENTS
    MV --> VS
    MV --> STR
    MV --> DATE
    MV --> URL
    MV --> TAGS
    MV --> RENDER

    NAV --> COMP
    NAV --> STATE
    NAV --> EVENTS
    NAV --> DATE

    DC --> COMP
    DC --> VC
    DC --> DATE
    DC --> VS
    DC --> STATE

    VC --> COMP
    VC --> STR
    VC --> DATE
    VC --> URL
    VC --> EVENTS
    VC --> DEBUG
    VC --> TAGS
    VC --> RENDER

    VM --> COMP
    VM --> STR
    VM --> URL
    VM --> EVENTS
    VM --> STATE
    VM --> TAGS
    VM --> RENDER

    VDP --> COMP
    VDP --> STR
    VDP --> URL
    VDP --> EVENTS
    VDP --> TAGS
    VDP --> RENDER

    ES --> DC
    ES --> DATE
    ES --> VS
    ES --> STATE

    VS --> DATE
    VS --> STR
    VS --> TAGS

    RENDER --> STR
    RENDER --> DATE
    RENDER --> URL

    DEBUG --> DATE

    style APP fill:#6366f1,color:#fff
    style STATE fill:#10b981,color:#fff
    style EVENTS fill:#10b981,color:#fff
    style VS fill:#f59e0b,color:#fff
```

### Leaf Modules (No Local Imports)

These utility modules have zero imports from the project — they depend only on browser APIs:

| Module | Purpose |
|--------|---------|
| `js/core/state.js` | Centralized state with observer pattern |
| `js/core/events.js` | Pub/sub event bus |
| `js/utils/date.js` | Date formatting, schedule matching |
| `js/utils/string.js` | Text manipulation, escaping |
| `js/utils/url.js` | URL building, sanitization |
| `js/utils/tags.js` | Tag config and rendering |
| `js/utils/validation.js` | Form validation |

### Modules With Local Imports

| Module | Imports From |
|--------|-------------|
| `js/utils/render.js` | string.js, date.js, url.js |
| `js/utils/debug.js` | date.js |
| `js/services/venues.js` | date.js, string.js, tags.js |

---

## 2 Component Hierarchy

```mermaid
graph TD
    APP["app.js (entry point)"]

    subgraph Singletons ["Singleton Components (created once)"]
        NAV["Navigation"]
        VM["VenueModal"]
        VDP["VenueDetailPane"]
    end

    subgraph Views ["Views (destroyed/recreated on switch)"]
        WV["WeeklyView"]
        AV["AlphabeticalView"]
        MV["MapView"]
    end

    subgraph Templates ["Template Helpers (HTML generators, not instances)"]
        RDC["renderDayCard()"]
        RVC["renderVenueCard()"]
        RES["renderExtendedSection()"]
    end

    subgraph PureFns ["Pure Rendering Functions"]
        RST["renderScheduleTable()"]
        RHS["renderHostSection()"]
        RDR["renderDateRange()"]
        RT["renderTags()"]
        CSL["createSocialLinks()"]
        FHD["formatHostDisplay()"]
    end

    APP --> NAV
    APP --> VM
    APP --> VDP
    APP --> WV
    APP --> AV
    APP --> MV

    WV --> RDC
    WV --> RES
    RDC --> RVC
    RES --> RDC
    AV --> RVC

    VM --> RST
    VM --> RHS
    VM --> RDR
    VM --> RT

    VDP --> RST
    VDP --> RHS
    VDP --> RDR
    VDP --> RT

    MV --> RST
    MV --> RHS
    MV --> RDR
    MV --> RT
    MV --> CSL

    RVC --> RT
    RVC --> FHD

    style APP fill:#6366f1,color:#fff
    style NAV fill:#818cf8,color:#fff
    style VM fill:#818cf8,color:#fff
    style VDP fill:#818cf8,color:#fff
```

### Component Types

| Type | Lifecycle | Examples |
|------|-----------|---------|
| **Singleton** | Created once in `app.js init()`, persists for entire session | Navigation, VenueModal, VenueDetailPane |
| **View** | Created on view switch, destroyed when switching away | WeeklyView, AlphabeticalView, MapView |
| **Template helper** | Function that creates a temporary Component instance, calls `template()`, returns HTML string — no persistent state | `renderDayCard()`, `renderVenueCard()`, `renderExtendedSection()` |
| **Pure function** | Stateless function that returns an HTML string from data | `renderScheduleTable()`, `renderTags()`, `createSocialLinks()` |

### Template Helper Pattern

DayCard, VenueCard, and ExtendedSection export both a `class` and a `render*()` function. The render function is used by parent views to generate HTML without managing component instances:

```javascript
// In DayCard.js
export function renderDayCard(date, options) {
    const card = new DayCard(document.createElement('div'), { date, ...options });
    return card.template();
}
```

The parent view calls `renderDayCard()` inside its own `template()` method, concatenates the returned HTML strings, then injects the combined result into the DOM.

---

## 3 Data Flow: Page Load to Render

```mermaid
sequenceDiagram
    participant Browser
    participant app.js
    participant venues.js
    participant state.js
    participant tags.js
    participant Navigation
    participant WeeklyView
    participant DayCard
    participant VenueCard

    Browser->>app.js: DOMContentLoaded
    app.js->>app.js: initDebugMode()
    app.js->>app.js: loadData()
    app.js->>tags.js: initTagConfig(tagDefinitions)
    app.js->>venues.js: initVenues(karaokeData)
    venues.js->>venues.js: Store listings in module-level array

    app.js->>Navigation: new Navigation('#navigation')
    Navigation->>Navigation: render()

    app.js->>app.js: renderView('weekly')
    app.js->>WeeklyView: new WeeklyView(container)
    WeeklyView->>WeeklyView: template()

    loop For each of 7 days
        WeeklyView->>DayCard: renderDayCard(date, options)
        DayCard->>venues.js: getVenuesForDate(date, options)
        venues.js-->>DayCard: matching venues[]

        loop For each venue
            DayCard->>VenueCard: renderVenueCard(venue, date)
            VenueCard-->>DayCard: HTML string
        end

        DayCard-->>WeeklyView: HTML string
    end

    WeeklyView->>WeeklyView: Render extended sections
    WeeklyView->>WeeklyView: container.innerHTML = html
    WeeklyView->>WeeklyView: afterRender() — scroll to today
```

---

## 4 Event Lifecycle Map

### All Events

| Event Constant | String | Emitted By | Listened By | Payload |
|---------------|--------|------------|-------------|---------|
| `VENUE_SELECTED` | `venue:selected` | app.js, VenueCard, WeeklyView, AlphabeticalView | app.js, VenueModal, VenueDetailPane | venue object |
| `VENUE_CLOSED` | `venue:closed` | VenueModal | app.js, VenueDetailPane | — |
| `VENUE_DETAIL_SHOWN` | `venue:detail-shown` | VenueDetailPane | — | venue object |
| `VIEW_CHANGED` | `view:changed` | Navigation, MapView | — | view name string |
| `WEEK_CHANGED` | `week:changed` | Navigation | — | — |
| `FILTER_CHANGED` | `filter:changed` | Navigation, MapView | WeeklyView, AlphabeticalView, MapView | — |
| `SEARCH_CHANGED` | `search:changed` | — | — | _(defined but unused)_ |
| `MODAL_OPEN` | `modal:open` | VenueModal | — | — |
| `MODAL_CLOSE` | `modal:close` | — | VenueModal | _(defined but unused as emitter)_ |
| `DATA_LOADED` | `data:loaded` | app.js | — | karaokeData object |
| `DATA_ERROR` | `data:error` | app.js | — | error object |

### Venue Selection Flow

```mermaid
sequenceDiagram
    participant User
    participant VenueCard
    participant EventBus as Event Bus
    participant app.js
    participant VenueModal
    participant VenueDetailPane

    User->>VenueCard: Click venue name
    VenueCard->>EventBus: emit(VENUE_SELECTED, venue)

    EventBus->>app.js: VENUE_SELECTED handler
    app.js->>app.js: Highlight selected card (.venue-card--selected)

    alt Window width < 1400px AND view !== 'map'
        EventBus->>VenueModal: VENUE_SELECTED handler
        VenueModal->>VenueModal: Show modal with venue data
        VenueModal->>EventBus: emit(MODAL_OPEN)
    end

    alt Window width >= 1400px
        EventBus->>VenueDetailPane: VENUE_SELECTED handler
        VenueDetailPane->>VenueDetailPane: Show venue in sidebar
        VenueDetailPane->>EventBus: emit(VENUE_DETAIL_SHOWN, venue)
    end

    Note over User: User closes detail view

    alt Modal was open
        VenueModal->>EventBus: emit(VENUE_CLOSED)
        EventBus->>app.js: Remove .venue-card--selected
        EventBus->>VenueDetailPane: Clear to empty state
    end
```

### Filter Change Flow

```mermaid
sequenceDiagram
    participant User
    participant Navigation
    participant EventBus as Event Bus
    participant state.js
    participant WeeklyView
    participant AlphabeticalView
    participant MapView

    User->>Navigation: Type in search / toggle dedicated
    Navigation->>state.js: setState({ searchQuery }) or setState({ showDedicated })
    Navigation->>EventBus: emit(FILTER_CHANGED)

    par All views re-render
        EventBus->>WeeklyView: FILTER_CHANGED handler
        WeeklyView->>WeeklyView: render()
    and
        EventBus->>AlphabeticalView: FILTER_CHANGED handler
        AlphabeticalView->>AlphabeticalView: render()
    and
        EventBus->>MapView: FILTER_CHANGED handler
        MapView->>MapView: updateMarkers()
    end

    Note over Navigation: Navigation does NOT re-render (preserves input focus)
```

---

## 5 State Management

### State Keys

| Key | Type | Default | Writers | Readers | Subscribers |
|-----|------|---------|---------|---------|-------------|
| `venues` | array | `[]` | app.js (via initVenues) | venues.js | — |
| `filteredVenues` | array | `[]` | — | — | — |
| `filters` | object | `{...}` | — | — | — |
| `view` | string | `'weekly'` | Navigation, MapView, app.js | Navigation, MapView | app.js → renderView() |
| `weekStart` | Date | today | Navigation | WeeklyView, Navigation | WeeklyView → render(), Navigation → render() |
| `showDedicated` | boolean | `true` | Navigation, MapView | All views, Navigation | WeeklyView, AlphabeticalView, MapView, Navigation |
| `searchQuery` | string | `''` | Navigation | All views (via getVenuesForDate/getVenuesSorted) | — _(uses FILTER_CHANGED event instead)_ |
| `selectedVenue` | object/null | `null` | VenueModal, VenueDetailPane | — | — |
| `isLoading` | boolean | `false` | — | — | — |

### Three Mutation Patterns

```mermaid
graph LR
    subgraph "1. Global State (state.js)"
        A[setState] -->|notifies| B[subscribe callbacks]
    end

    subgraph "2. Component-Local State"
        C[this.setState] -->|triggers| D[this.render + this.onStateChange]
    end

    subgraph "3. Service-Level State"
        E["venues.js: let venues = []"] -->|accessed via| F[exported functions]
    end

    style A fill:#10b981,color:#fff
    style C fill:#818cf8,color:#fff
    style E fill:#f59e0b,color:#fff
```

| Pattern | Where | How | Cleanup |
|---------|-------|-----|---------|
| **Global** | `state.js` | `setState({key: value})` triggers `subscribe(key, cb)` | Via `Component.subscribe()` auto-cleanup |
| **Component-local** | `Component.setState()` | `this.setState({...})` merges into `this.state`, calls `render()` + `onStateChange()` | Cleared on `destroy()` |
| **Service-level** | `venues.js` | Module-scoped `let venues = []`, mutated by `initVenues()`, read by all query functions | Lives for page lifetime |

### Subscription Auto-Cleanup

Components use `this.subscribe()` to register unsubscribe functions. On `destroy()`, all stored functions are called automatically:

```javascript
// In a component's init() method:
this.subscribe(subscribe('weekStart', () => this.render()));
this.subscribe(on(Events.FILTER_CHANGED, () => this.render()));

// Component.subscribe() stores the unsubscribe function:
subscribe(subscribeFn) {
    this._subscriptions.push(subscribeFn);
}

// Component.destroy() calls them all:
destroy() {
    this._subscriptions.forEach(fn => fn());
    this._subscriptions = [];
}
```

---

## 6 CSS Architecture

### Loading Order

Every page loads CSS in this specific order. Later files override earlier ones.

```mermaid
graph LR
    FA["Font Awesome (CDN)"] --> BASE["base.css<br/>Variables, reset, typography"]
    BASE --> LAYOUT["layout.css<br/>Header, nav, footer, grid"]
    LAYOUT --> COMP["components.css<br/>Cards, modals, forms, tags"]
    COMP --> PAGE["Page-specific CSS<br/>views.css / bingo.css / etc."]

    style FA fill:#374151,color:#d1d5db
    style BASE fill:#6366f1,color:#fff
    style LAYOUT fill:#818cf8,color:#fff
    style COMP fill:#a78bfa,color:#fff
    style PAGE fill:#c4b5fd,color:#1f2937
```

### Page CSS Requirements

| Page | CSS Files (in order) |
|------|---------------------|
| `index.html` | base, layout, components, views |
| `about.html` | base, layout, components, views |
| `submit.html` | base, layout, components, views, submit |
| `bingo.html` | base, layout, components, bingo |
| `editor.html` | base, layout, components, editor |
| `codeexplained.html` | base, layout, components, docs |

### CSS Variable Hierarchy

All variables defined in `base.css`:

| Category | Examples | Usage |
|----------|---------|-------|
| **Colors** | `--color-primary`, `--color-secondary` | Theme colors (indigo/purple palette) |
| **Backgrounds** | `--bg-card`, `--bg-body` | Surface colors |
| **Text** | `--text-primary`, `--text-muted` | Typography colors |
| **Borders** | `--border-color`, `--border-radius` | Consistent borders |
| **Spacing** | `--spacing-xs` through `--spacing-2xl` | Consistent spacing scale |
| **Typography** | `--font-size-sm` through `--font-size-2xl` | Font size scale |
| **Transitions** | `--transition-fast`, `--transition-normal` | Animation timing |

### Responsive Breakpoints

```mermaid
graph LR
    MOBILE["Mobile Base<br/>(default styles)"]
    TABLET["768px<br/>Enhanced spacing"]
    DESKTOP["1024px<br/>Wider cards"]
    WIDE["1400px<br/>Dual-pane layout"]

    MOBILE --> TABLET --> DESKTOP --> WIDE

    style MOBILE fill:#ef4444,color:#fff
    style TABLET fill:#f59e0b,color:#fff
    style DESKTOP fill:#10b981,color:#fff
    style WIDE fill:#6366f1,color:#fff
```

| Breakpoint | Key Changes |
|------------|-------------|
| **Base** (mobile) | Single column, modal for details, stacked nav |
| **768px** | Enhanced spacing, horizontal nav layout |
| **1024px** | Wider cards, more horizontal space |
| **1400px** | **Major shift** — dual-pane layout. VenueDetailPane sidebar appears. VenueModal suppressed. CSS grid: `1fr 400px` |

### BEM Naming Convention

Components use Block-Element-Modifier naming:

```
.venue-card                    /* Block */
.venue-card__header            /* Element */
.venue-card__name              /* Element */
.venue-card__more-nights       /* Element */
.venue-card--compact           /* Modifier */
.venue-card--special-event     /* Modifier */
.venue-card--selected          /* Modifier */

.day-card                      /* Block */
.day-card__header              /* Element */
.day-card__content             /* Element */
.day-card--today               /* Modifier */
.day-card--past                /* Modifier */
.day-card--empty               /* Modifier */
.day-card--expanded            /* Modifier */

.extended-section              /* Block */
.extended-section__header      /* Element */
.extended-section__content     /* Element */
.extended-section__dedup-notice /* Element */
.extended-section--collapsed   /* Modifier */
```

---

*This document is part of the [Austin Karaoke Directory documentation](functional-spec.md). See also [Code Patterns](patterns.md) for implementation recipes.*
