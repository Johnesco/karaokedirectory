# Code Pattern Cookbook

> Annotated recipes for common implementation tasks. Each recipe lists the files involved, step-by-step instructions, real code examples, and common gotchas.

---

## Recipe: Add a New Venue

**When:** A new karaoke venue needs to be added to the directory.

**Files:** `js/data.js`, optionally `editor.html`

### Steps

1. Open `js/data.js` and find the `listings` array inside the `karaokeData` object.
2. Add a new venue object (see format below). Insert alphabetically by venue name for consistency.
3. Run `node scripts/validate-data.js` to check the data format.
4. If the venue needs map coordinates, either:
   - Use the editor (`editor.html`) — click "Geocode Address" button
   - Run `node scripts/geocode-venues.js` to batch-geocode all venues missing coordinates

### Code

Minimal required fields:

```javascript
{
  id: "new-venue-slug",           // Unique, lowercase, hyphenated
  name: "New Venue Name",
  dedicated: false,               // true if karaoke-only
  address: {
    street: "123 Main St",
    city: "Austin",
    state: "TX"
  },
  schedule: [
    {
      frequency: "every",         // "every", "first", "second", "third", "fourth", "last", "once"
      day: "Friday",              // Full day name, capitalized
      startTime: "21:00",         // 24-hour format
      endTime: "01:00"            // Can cross midnight, or null for "until close"
    }
  ]
}
```

Full venue with all optional fields:

```javascript
{
  id: "the-highball",
  name: "The Highball",
  active: true,
  dedicated: false,
  tags: ["lgbtq", "craft-cocktails"],
  address: {
    street: "1120 S Lamar Blvd",
    city: "Austin",
    state: "TX",
    zip: "78704",
    neighborhood: "South Lamar"
  },
  coordinates: { lat: 30.2531, lng: -97.7654 },
  schedule: [
    {
      frequency: "every",
      day: "Friday",
      startTime: "21:00",
      endTime: "01:00",
      eventUrl: "https://example.com/event"
    },
    {
      frequency: "once",
      date: "2026-03-15",
      startTime: "20:00",
      endTime: "23:00",
      eventName: "Special Karaoke Night",
      eventUrl: "https://example.com/special"
    }
  ],
  dateRange: {                    // Optional: seasonal venues only
    start: "2026-06-01",
    end: "2026-08-31"
  },
  host: {
    name: "DJ Karaoke",
    company: "Austin KJ Services",
    website: "https://example.com"
  },
  socials: {
    website: "https://thehighball.com",
    facebook: "https://facebook.com/thehighball",
    instagram: "https://instagram.com/thehighball",
    twitter: "https://twitter.com/thehighball",
    tiktok: "https://tiktok.com/@thehighball",
    youtube: "https://youtube.com/@thehighball",
    bluesky: "https://bsky.app/profile/thehighball"
  }
}
```

### Gotchas

- The `id` must be unique across all venues. Use lowercase, hyphenated slugs.
- Day names must be capitalized ("Friday", not "friday"). The matching code uses `.toLowerCase()` internally, but the data convention is capitalized.
- Times are 24-hour format strings. "9:00 PM" is `"21:00"`, not `"9:00 PM"`.
- The `dedicated` field is required (not optional). Set to `false` for non-karaoke-only venues.
- If you add `coordinates`, both `lat` and `lng` are required — a venue with only one will be excluded from the map.

---

## Recipe: Add a New View

**When:** A new way to browse venues is needed (e.g., a "Nearby" view or "Favorites" view).

**Files:** `js/views/NewView.js` (create), `js/app.js`, `js/components/Navigation.js`, `css/views.css`

### Steps

1. Create a new view file extending `Component`.
2. Register it in `app.js`'s view map.
3. Add a navigation tab in `Navigation.js`.
4. Add view-specific styles in `css/views.css`.

### Code

**Step 1 — Create the view (`js/views/NewView.js`):**

```javascript
import { Component } from '../components/Component.js';
import { getState, subscribe } from '../core/state.js';
import { on, Events } from '../core/events.js';

export class NewView extends Component {
    init() {
        // Subscribe to filter changes so the view re-renders
        this.subscribe(on(Events.FILTER_CHANGED, () => this.render()));
    }

    template() {
        const searchQuery = getState('searchQuery');
        const showDedicated = getState('showDedicated');

        return `
            <div class="new-view">
                <h2>New View</h2>
                <!-- Your content here -->
            </div>
        `;
    }

    afterRender() {
        // Attach event listeners to rendered DOM elements
    }
}
```

**Step 2 — Register in `app.js`:**

```javascript
import { NewView } from './views/NewView.js';

const views = {
    weekly: WeeklyView,
    alphabetical: AlphabeticalView,
    map: MapView,
    newview: NewView     // Add here
};
```

**Step 3 — Add nav tab in `Navigation.js`:**

Find the view switcher buttons in `template()` and add a new button:

```html
<button class="nav-btn ${view === 'newview' ? 'nav-btn--active' : ''}"
        data-view="newview" title="New View">
    <i class="fas fa-icon-name"></i>
    <span>NEW</span>
</button>
```

The existing click handler in Navigation uses `dataset.view` to emit `VIEW_CHANGED` — no additional JS needed.

**Step 4 — Add styles in `css/views.css`:**

```css
/* === New View === */
.new-view { /* ... */ }
```

### Gotchas

- Views are destroyed and recreated on every view switch. Don't store important state in `this.state` — use global state or localStorage.
- The `init()` method is called in the constructor. Don't access `this.container` in `init()` — it exists but the DOM isn't rendered yet.
- Always subscribe to `FILTER_CHANGED` so search and dedicated filter work.
- If your view needs map-like immersive mode, toggle a body class in `app.js`'s `renderView()` function.

---

## Recipe: Add a New Component

**When:** A reusable UI element needs its own encapsulated logic.

**Files:** `js/components/NewComponent.js` (create), parent view/component that uses it

### Steps

1. Create a new component file extending `Component`.
2. Implement the lifecycle methods you need.
3. Import and use it in the parent.

### Code

```javascript
import { Component } from './Component.js';
import { on, Events } from '../core/events.js';
import { subscribe } from '../core/state.js';

export class NewComponent extends Component {
    // 1. init() — called once in constructor, set up subscriptions
    init() {
        this.subscribe(subscribe('someKey', (value) => {
            this.render();
        }));
        this.subscribe(on(Events.FILTER_CHANGED, () => {
            this.render();
        }));
    }

    // 2. template() — return HTML string
    template() {
        return `
            <div class="new-component">
                <button class="new-component__action">Click me</button>
            </div>
        `;
    }

    // 3. afterRender() — attach event listeners to DOM
    afterRender() {
        this.addEventListener('.new-component__action', 'click', this.handleClick);
    }

    handleClick(e) {
        console.log('Clicked!', e.target);
    }

    // 4. onDestroy() — optional cleanup beyond auto-cleanup
    onDestroy() {
        // Component.destroy() already handles:
        //   - Removing event listeners (from addEventListener/delegate)
        //   - Calling unsubscribe functions (from this.subscribe)
        //   - Clearing container innerHTML
        // Add custom cleanup here only if needed
    }
}
```

### Component Lifecycle

```
constructor(container, props)
  └── init()                    ← Set up subscriptions, initial state
       └── (caller) render()
             ├── template()     ← Return HTML string
             ├── container.innerHTML = html
             └── afterRender()  ← Attach event listeners
                   └── (later) destroy()
                         ├── Remove event listeners
                         ├── Call unsubscribe functions
                         ├── Clear container
                         └── onDestroy()  ← Custom cleanup
```

### Template Helper Pattern

If the component is used inside another component's `template()` (like VenueCard inside DayCard), export a render function:

```javascript
export function renderNewComponent(data) {
    const temp = new NewComponent(document.createElement('div'), data);
    return temp.template();
}
```

### Gotchas

- `init()` runs in the constructor before `render()`. Don't query the DOM in `init()`.
- Always use `this.addEventListener()` or `this.delegate()` instead of raw `element.addEventListener()` — the component's auto-cleanup only tracks listeners registered through these methods.
- Always wrap state/event subscriptions with `this.subscribe()` for auto-cleanup.
- `afterRender()` is called every time `render()` runs, not just the first time. Previously attached listeners are NOT automatically cleaned up between renders — `this.addEventListener()` adds to the list each time. If this is a concern, use event delegation via `this.delegate()` instead.

---

## Recipe: Add a New Tag

**When:** A new category badge is needed for venues (e.g., "Pool Party", "Karaoke Contest").

**Files:** `js/data.js` (tagDefinitions), optionally venues in the listings array

### Steps

1. Add the tag definition to `tagDefinitions` in `js/data.js`.
2. Add the tag ID to relevant venues' `tags` arrays.
3. That's it — rendering and search matching are automatic.

### Code

**Step 1 — Define the tag in `js/data.js`:**

```javascript
const karaokeData = {
    tagDefinitions: {
        // ... existing tags ...
        'pool-party': {
            label: 'Pool Party',
            color: '#00bcd4',       // Badge background color
            textColor: '#ffffff'     // Badge text color
        }
    },
    listings: [ /* ... */ ]
};
```

**Step 2 — Apply to venues:**

```javascript
{
    id: "some-venue",
    name: "Some Venue",
    tags: ["outdoor", "pool-party"],  // Add tag ID here
    // ...
}
```

### How It Works

- `initTagConfig(tagDefinitions)` in `js/utils/tags.js` stores the definitions at startup.
- `renderTags(tags)` generates HTML badges using the stored config.
- `venueMatchesSearch()` in `js/services/venues.js` automatically searches both tag IDs and labels — searching "pool party" or "Pool Party" will match.
- The `dedicated` tag is special — it's auto-prepended when `venue.dedicated === true`.
- The `special-event` tag is injected at render time for `frequency: "once"` events.

### Gotchas

- Tag IDs must be lowercase with hyphens. They're used as both object keys and search targets.
- Choose colors with sufficient contrast. The `textColor` should be readable against the `color` background.
- If using the editor, the tag will appear automatically in the tag checkboxes after page reload.

---

## Recipe: Add a New Event

**When:** Components need to communicate about a new type of interaction.

**Files:** `js/core/events.js` (define), emitter file, listener file(s)

### Steps

1. Add the event constant to `Events` in `events.js`.
2. Emit the event from the source component/module.
3. Listen for the event in consuming components.
4. Wrap subscriptions with `this.subscribe()` for cleanup.

### Code

**Step 1 — Define the constant:**

```javascript
// In js/core/events.js
export const Events = {
    // ... existing events ...
    VENUE_FAVORITED: 'venue:favorited'
};
```

**Step 2 — Emit from source:**

```javascript
import { emit, Events } from '../core/events.js';

// When the user favorites a venue:
emit(Events.VENUE_FAVORITED, { venueId: venue.id, isFavorite: true });
```

**Step 3 — Listen in consumer:**

```javascript
import { on, Events } from '../core/events.js';

// In a component's init():
init() {
    this.subscribe(on(Events.VENUE_FAVORITED, (data) => {
        console.log(`Venue ${data.venueId} favorited:`, data.isFavorite);
        this.render();
    }));
}
```

### Gotchas

- Always use `this.subscribe(on(...))` in components — not bare `on(...)`. Without `this.subscribe()`, the listener leaks when the component is destroyed.
- Event handlers are wrapped in try/catch by the event bus. One failing handler won't break others.
- Events are synchronous — all handlers run before `emit()` returns.
- The event string is just a convention (`namespace:action`). The `Events` constant object exists for autocomplete and typo prevention.

---

## Recipe: Read and Write State

**When:** A component needs to react to global state changes or update shared state.

**Files:** `js/core/state.js`, any component

### Steps

1. Import `getState`, `setState`, and `subscribe` from `state.js`.
2. Read state with `getState('key')`.
3. Write state with `setState({ key: value })`.
4. Subscribe to changes with `subscribe('key', callback)`.
5. In components, wrap subscriptions with `this.subscribe()`.

### Code

**Reading state:**

```javascript
import { getState } from '../core/state.js';

const currentView = getState('view');           // 'weekly'
const allState = getState();                     // { view, weekStart, ... }
```

**Writing state (triggers subscribers):**

```javascript
import { setState } from '../core/state.js';

setState({ view: 'alphabetical' });              // Single key
setState({ view: 'weekly', weekStart: new Date() }); // Multiple keys
```

**Subscribing in a component:**

```javascript
import { subscribe } from '../core/state.js';

init() {
    // subscribe() returns an unsubscribe function
    // this.subscribe() stores it for auto-cleanup on destroy()
    this.subscribe(subscribe('weekStart', (newDate) => {
        this.render();
    }));

    // Subscribe to ALL state changes:
    this.subscribe(subscribe('*', (fullState, changedKey) => {
        console.log(`${changedKey} changed`);
    }));
}
```

### State Keys Reference

| Key | Type | Read By | Written By |
|-----|------|---------|------------|
| `view` | string | Navigation, app.js | Navigation, MapView, app.js |
| `weekStart` | Date | WeeklyView, Navigation | Navigation |
| `showDedicated` | boolean | All views, Navigation | Navigation, MapView |
| `searchQuery` | string | All views (via service functions) | Navigation |
| `selectedVenue` | object/null | — | VenueModal, VenueDetailPane |

### Gotchas

- `setState()` uses reference equality (`!==`) to detect changes. Mutating an object in place and passing it back won't trigger subscribers — always create a new object.
- Subscribers are notified after ALL updates in a single `setState()` call are applied. This means a subscriber for key A can safely read key B's new value if both were updated together.
- Navigation intentionally does NOT subscribe to `searchQuery` — it emits `FILTER_CHANGED` instead so views re-render without the Navigation component itself re-rendering (which would steal keyboard focus from the search input).

---

## Recipe: Add a Schedule Frequency

**When:** A new recurrence pattern is needed (e.g., "alternate" for every other week, "biweekly").

**Files:** `js/utils/date.js` — `scheduleMatchesDate()` function

### Steps

1. Open `js/utils/date.js` and find the `scheduleMatchesDate()` function.
2. Add a new case to handle your frequency.
3. Update `js/data.js` venue schedules to use the new frequency.
4. Update the editor frequency dropdown if applicable.

### Code

The matching logic in `scheduleMatchesDate()`:

```javascript
export function scheduleMatchesDate(schedule, date) {
    // One-time events: exact date match
    if (schedule.frequency === 'once') {
        const dateStr = date.toISOString().split('T')[0];
        return schedule.date === dateStr;
    }

    // Recurring: first check day-of-week
    const dayName = getDayName(date);  // Returns lowercase: "friday"
    if (schedule.day.toLowerCase() !== dayName) {
        return false;
    }

    // Then check frequency
    const dayOfMonth = date.getDate();
    const occurrence = Math.ceil(dayOfMonth / 7);  // 1=first, 2=second, etc.

    switch (schedule.frequency) {
        case 'every':  return true;
        case 'first':  return occurrence === 1;
        case 'second': return occurrence === 2;
        case 'third':  return occurrence === 3;
        case 'fourth': return occurrence === 4;
        case 'fifth':  return occurrence === 5;
        case 'last':
            // Last = adding 7 days crosses into next month
            const nextWeek = new Date(date);
            nextWeek.setDate(dayOfMonth + 7);
            return nextWeek.getMonth() !== date.getMonth();
        default:
            return false;
    }
}
```

To add a new frequency (e.g., "alternate" for every other week), add a case to the switch:

```javascript
case 'alternate':
    // Example: match if the ISO week number is even
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return weekNum % 2 === 0;
```

### Gotchas

- `scheduleMatchesDate()` does NOT evaluate times — it only determines if a venue appears on a given date. Time display is handled separately by `formatTimeRange()`.
- The "last" detection works by checking if the date + 7 days crosses a month boundary. This is correct even when "last" and "fourth" overlap.
- Day comparison is always case-insensitive (`.toLowerCase()`). Store day names capitalized in data but don't rely on case in matching logic.

---

## Recipe: Add a Social Platform

**When:** A new social media platform needs to be supported (e.g., Threads, Mastodon).

**Files:** `js/utils/url.js`, `js/data.js` (venue socials), `editor/editor.js`, `editor.html`, `submit.html`

### Steps

1. Add the platform to `SOCIAL_PLATFORMS` in `url.js`.
2. Add the field to venue socials in `js/data.js`.
3. Add the form field to `editor.html` and `submit.html`.
4. Update `editor.js` to read/write the new field.

### Code

**Step 1 — Add to `SOCIAL_PLATFORMS` in `js/utils/url.js`:**

```javascript
export const SOCIAL_PLATFORMS = {
    // ... existing platforms ...
    threads: {
        icon: 'fab fa-threads',      // Font Awesome icon class
        label: 'Threads',
        cssClass: 'social-threads'
    }
};
```

The `createSocialLinks(socials)` function iterates over `SOCIAL_PLATFORMS` and generates link HTML for any matching key in the venue's `socials` object. No additional code changes needed in that function.

**Step 2 — Add to venue data in `js/data.js`:**

```javascript
socials: {
    // ... existing fields ...
    threads: "https://threads.net/@venuename"
}
```

**Step 3 — Add form field to `editor.html`:**

```html
<div class="form-group">
    <label for="social-threads">Threads</label>
    <input type="url" id="social-threads" placeholder="https://threads.net/@...">
</div>
```

**Step 4 — Update `editor.js`** to read from and write to the new field:

In the `loadVenueIntoForm()` function, add:
```javascript
document.getElementById('social-threads').value = venue.socials?.threads || '';
```

In the `collectFormData()` function, add:
```javascript
socials.threads = document.getElementById('social-threads').value.trim() || undefined;
```

### Gotchas

- Font Awesome must have an icon for the platform. Check [Font Awesome icons](https://fontawesome.com/icons) first. If no brand icon exists, use a generic icon like `fas fa-link`.
- The `createSocialLinks()` function uses `sanitizeUrl()` on every URL — this blocks `javascript:` and `data:` schemes automatically.
- Update both `editor.html` and `submit.html` — they are separate forms.
- Update the Functional Specification (Section 11 schema, Section 15 submit form, Section 16 editor) and CLAUDE.md.

---

## Recipe: Style a New BEM Component

**When:** A new visual component needs CSS styling.

**Files:** `css/components.css` (or `css/views.css` for view-specific styles), `css/base.css` (reference)

### Steps

1. Choose the BEM block name (e.g., `.favorite-button`).
2. Add styles to `css/components.css` (for reusable components) or `css/views.css` (for view-specific elements).
3. Use CSS variables from `base.css` for consistency.
4. Add responsive overrides for breakpoints.

### Code

```css
/* === Favorite Button === */

.favorite-button {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
}

/* Element */
.favorite-button__icon {
    color: var(--text-muted);
    transition: color var(--transition-fast);
}

.favorite-button__count {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
}

/* Modifier — active state */
.favorite-button--active {
    border-color: var(--color-primary);
    background: rgba(99, 102, 241, 0.1);
}

.favorite-button--active .favorite-button__icon {
    color: var(--color-primary);
}

/* Responsive — larger touch target on mobile */
@media (max-width: 768px) {
    .favorite-button {
        padding: var(--spacing-sm) var(--spacing-md);
        min-height: 44px;  /* Touch-friendly */
    }
}
```

### BEM Naming Rules

| Part | Convention | Example |
|------|-----------|---------|
| **Block** | Lowercase, hyphen-separated noun | `.venue-card`, `.day-card` |
| **Element** | Block + `__` + element name | `.venue-card__header` |
| **Modifier** | Block + `--` + modifier name | `.venue-card--compact` |

### Gotchas

- Always use CSS variables from `base.css` for colors, spacing, and typography. Don't hardcode values.
- Mobile-first: write base styles for mobile, then add `@media (min-width: ...)` for larger screens.
- The project uses four breakpoints: 768px, 1024px, 1200px (editor only), 1400px. Most components only need 768px and 1400px.
- Check existing components in `components.css` for patterns. Most follow the same structure: block → elements → modifiers → responsive.

---

## Recipe: Add a Utility Function

**When:** A reusable helper is needed across multiple components.

**Files:** `js/utils/` — existing file or new file

### Steps

1. Decide which utility file it belongs in (or create a new one).
2. Write the function as a named export.
3. Import it where needed.

### Code

**Adding to an existing utility file (e.g., `js/utils/string.js`):**

```javascript
/**
 * Pluralize a word based on count
 * @param {number} count - The count
 * @param {string} singular - Singular form
 * @param {string} [plural] - Plural form (default: singular + 's')
 * @returns {string} Pluralized string with count
 */
export function pluralize(count, singular, plural) {
    const word = count === 1 ? singular : (plural || singular + 's');
    return `${count} ${word}`;
}
```

**Importing in a component:**

```javascript
import { pluralize } from '../utils/string.js';

// Usage
const text = pluralize(5, 'venue');  // "5 venues"
```

### Utility File Organization

| File | Purpose | Leaf? |
|------|---------|-------|
| `date.js` | Date formatting, schedule matching, date ranges | Yes |
| `string.js` | Text manipulation, escaping, search highlighting | Yes |
| `url.js` | URL building, sanitization, social links | Yes |
| `tags.js` | Tag configuration storage and badge rendering | Yes |
| `debug.js` | Debug mode detection and debug HTML | No (imports date.js) |
| `render.js` | Shared HTML rendering for detail views | No (imports string.js, date.js, url.js) |
| `validation.js` | Form and data validation | Yes |

### Gotchas

- If your utility has no local imports, it's a **leaf module** — keep it that way if possible. Leaf modules are easier to test and have no circular dependency risk.
- If your utility needs to import from other local modules, consider putting it in `render.js` (for HTML rendering helpers) or creating a new file.
- All utilities use ES6 module exports (`export function ...`). No default exports.
- Security: if the function handles user input or URLs, use `escapeHtml()` or `sanitizeUrl()` as appropriate.

---

*This document is part of the [Austin Karaoke Directory documentation](functional-spec.md). See also [Architecture](architecture.md) for visual diagrams of the codebase.*
