# Austin Karaoke Directory

A mobile-friendly web application for discovering karaoke venues in and around Austin, Texas. Find local karaoke spots, check schedules, view venue details, and get directions — all in one place.

## Features

- **Weekly Calendar View** — See which venues have karaoke each night across a 7-day schedule with week navigation, plus extended sections showing Next Week, This Month, and Next Month
- **Alphabetical Listing** — Browse all 70+ venues sorted A-Z with letter index for quick jumps
- **Interactive Map** — Full-screen immersive map with floating controls and venue cards (Leaflet.js)
- **Global Search** — Filter venues by name, city, neighborhood, host, company, or tags across all views
- **Venue Details** — View addresses, schedules, host/KJ info, and social media links (mobile modal / desktop side pane)
- **Venue Tags** — 19 color-coded badges showing venue characteristics (LGBTQ+, 21+, Dive Bar, Live Band, etc.)
- **Special Events** — One-time karaoke events with specific dates, event names, and event page links
- **Seasonal Venues** — Date range support for seasonal or temporary events
- **Quick Directions** — One-tap access to Google Maps navigation
- **Dedicated Venue Filter** — Toggle to show only dedicated karaoke bars
- **Karaoke Bingo** — A fun bingo card game with karaoke-themed scenarios
- **Venue Submissions** — Community-driven venue suggestions via web form
- **Venue Editor** — Full-featured editor tool with live preview, tag management, and address geocoding
- **Debug Mode** — Schedule troubleshooting overlay via `?debug=1` URL parameter

## Tech Stack

- **HTML5** / **CSS3** / **Vanilla JavaScript** (ES6 modules)
- **Leaflet.js** for interactive maps
- **Font Awesome** for icons
- No frameworks — lightweight and fast
- No build step — edit and refresh

## Getting Started

This is a static site with no build step required.

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/karaokedirectory.git
   cd karaokedirectory
   ```

2. Serve the files with any static server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve
   ```

3. Open `http://localhost:8000` in your browser

### Deployment

Deploy to any static hosting service (GitHub Pages, Netlify, Vercel, etc.) — just upload the files as-is.

## Project Structure

```
├── index.html          # Main application (SPA)
├── about.html          # About page
├── bingo.html          # Karaoke bingo game
├── submit.html         # Venue submission form
├── editor.html         # Venue data editor tool
├── codeexplained.html  # Interactive code documentation
├── css/
│   ├── base.css        # CSS variables, reset, typography
│   ├── layout.css      # Header, navigation, page structure
│   ├── components.css  # Buttons, cards, modals, forms, search
│   ├── views.css       # View-specific styles (weekly, map, etc.)
│   ├── bingo.css       # Bingo game styles
│   ├── editor.css      # Editor page styles
│   ├── submit.css      # Submission form styles
│   └── docs.css        # Documentation page styles
├── js/
│   ├── app.js          # Application entry point
│   ├── data.js         # Venue database (70+ venues)
│   ├── bingo.js        # Bingo game logic
│   ├── core/           # State management & event bus
│   ├── components/     # UI components (Navigation, DayCard, VenueCard, etc.)
│   ├── views/          # View controllers (Weekly, Alphabetical, Map)
│   ├── services/       # Data services (venue search, filtering)
│   └── utils/          # Utilities (date, string, tags, url, render, debug, validation)
├── editor/
│   └── editor.js       # Venue editor functionality
├── scripts/            # Developer tools
│   ├── geocode-venues.js   # Batch geocode venues (Node.js)
│   └── validate-data.js    # Validate venue data integrity
└── assets/images/      # Static images
```

## Adding a Venue

Know a karaoke spot that's missing? You can:

1. Use the [submission form](submit.html) on the site
2. Use the [venue editor](editor.html) to create and export venue JSON
3. Open an issue with the venue details
4. Submit a PR with the venue added to `js/data.js`

### Venue Data Format

```javascript
{
  id: "venue-name",           // Unique, lowercase, hyphenated
  name: "Venue Name",
  active: true,               // Optional: false to hide venue (default: true)
  dedicated: false,           // true if karaoke-only venue
  tags: ["lgbtq", "21+"],     // Optional: venue characteristic tags
  address: {
    street: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    neighborhood: "Downtown"  // Optional: helps with search filtering
  },
  coordinates: {              // Optional: for map view
    lat: 30.2672,
    lng: -97.7431
  },
  schedule: [
    {
      frequency: "every",     // "every", "first", "second", "third", "fourth", "last", "once"
      day: "Friday",          // Day name, capitalized (for recurring events)
      startTime: "21:00",     // 24-hour format
      endTime: "01:00",       // Can cross midnight (optional)
      eventUrl: "https://..." // Optional: link to event page
    },
    {
      frequency: "once",      // One-time special event
      date: "2026-03-15",     // Specific date
      startTime: "20:00",
      endTime: "23:00",
      eventName: "Karaoke Night",  // Optional: event display name
      eventUrl: "https://..."      // Optional: event page link
    }
  ],
  dateRange: {                // Optional: for seasonal venues
    start: "2026-06-01",
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

### Available Tags

Tags are defined in `js/data.js` with custom colors. Search works with both tag IDs and display labels.

| Tag ID | Display Label | Description |
|--------|---------------|-------------|
| `dedicated` | Dedicated | Dedicated karaoke venue (auto-added) |
| `lgbtq` | LGBTQ+ | LGBTQ+ friendly venue |
| `dive` | Dive Bar | Dive bar atmosphere |
| `sports-bar` | Sports Bar | Sports bar venue |
| `country-bar` | Country Bar | Country/western bar |
| `21+` | 21+ | 21 and over only |
| `18+` | 18+ | 18 and over only |
| `all-ages` | All Ages | No age restriction |
| `family-friendly` | Family | Family-friendly venue |
| `smoking-inside` | Smoking Inside | Indoor smoking allowed |
| `restaurant` | Restaurant | Primarily a restaurant |
| `outdoor` | Outdoor | Significant outdoor/patio space |
| `live-band-karaoke` | Live Band | Live band karaoke venue |
| `billiards` | Billiards | Pool hall / billiards focus |
| `brewery` | Brewery | Brewery or distillery |
| `games` | Games | Arcade, bowling, entertainment |
| `craft-cocktails` | Craft Cocktails | Upscale craft cocktail bar |
| `neighborhood` | Neighborhood Bar | Casual neighborhood bar |
| `special-event` | Special Event | One-time special events |

## Venue Editor

The editor tool (`editor.html`) provides a full GUI for managing venue data:

- **Venue list sidebar** with search
- **Complete form editor** for all venue fields
- **Schedule management** with support for recurring and one-time events
- **Tag selector** with visual checkboxes
- **Tag definitions editor** for adding/modifying/removing tags
- **Address geocoding** via Nominatim/OpenStreetMap API (no API key needed)
- **Live preview** with Card, Modal, and JSON tabs
- **JSON export** (Copy to Clipboard) and **draft saving** (localStorage)

## Debug Mode

Append `?debug=1` to the URL to see schedule match reasons on venue cards.

## Contributing

Contributions are welcome! Feel free to:

- Report bugs or suggest features via issues
- Submit PRs for venue updates or code improvements
- Share feedback through the site's feedback form

## License

MIT

---

Built for the Austin karaoke community.
