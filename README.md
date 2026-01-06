# Austin Karaoke Directory

A mobile-friendly web application for discovering karaoke venues in and around Austin, Texas. Find local karaoke spots, check schedules, view venue details, and get directions — all in one place.

## Features

- **Weekly Calendar View** — See which venues have karaoke each night across a 7-day schedule
- **Alphabetical Listing** — Browse all 59+ venues sorted A-Z
- **Interactive Map** — Find venues near you with an OpenStreetMap-powered map
- **Venue Details** — View addresses, schedules, host/KJ info, and social media links
- **Quick Directions** — One-tap access to Google Maps navigation
- **Dedicated Venue Filter** — Toggle to show only dedicated karaoke bars
- **Karaoke Bingo** — A fun bingo card game with karaoke-themed scenarios
- **Venue Submissions** — Community-driven venue suggestions

## Tech Stack

- **HTML5** / **CSS3** / **Vanilla JavaScript** (ES6 modules)
- **Leaflet.js** for interactive maps
- **Font Awesome** for icons
- No frameworks — lightweight and fast

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
├── index.html          # Main application
├── about.html          # About page
├── bingo.html          # Karaoke bingo game
├── submit.html         # Venue submission form
├── css/
│   ├── base.css        # Global styles & variables
│   ├── layout.css      # Header, navigation, layout
│   ├── components.css  # Buttons, cards, modals
│   └── views.css       # View-specific styles
├── js/
│   ├── app.js          # Application entry point
│   ├── data.js         # Venue database
│   ├── core/           # State management & events
│   ├── components/     # UI components
│   ├── views/          # View controllers
│   ├── services/       # Data services
│   └── utils/          # Utility functions
└── scripts/            # Developer tools
```

## Adding a Venue

Know a karaoke spot that's missing? You can:

1. Use the [submission form](submit.html) on the site
2. Open an issue with the venue details
3. Submit a PR with the venue added to `js/data.js`

### Venue Data Format

```javascript
{
  id: "venue-name",
  name: "Venue Name",
  address: "123 Main St, Austin, TX 78701",
  coordinates: { lat: 30.2672, lng: -97.7431 },
  schedule: [
    { day: "Friday", startTime: "9:00 PM", endTime: "1:00 AM" }
  ],
  dedicated: false,
  host: { name: "DJ Name", company: "Company" },
  social: {
    website: "https://example.com",
    facebook: "https://facebook.com/venue",
    instagram: "https://instagram.com/venue"
  }
}
```

## Contributing

Contributions are welcome! Feel free to:

- Report bugs or suggest features via issues
- Submit PRs for venue updates or code improvements
- Share feedback through the site's feedback form

## License

MIT

---

Built for the Austin karaoke community.
