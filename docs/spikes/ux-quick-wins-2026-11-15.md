# UX quick wins audit (2026-11-15)

A verified UI/UX audit of the public site. Each item below is a ticket, #399 to #457, tracked by the umbrella issue #398 in the same tier order. Line numbers are as of commit `123d5a3`.

## Do first: high impact, XS/S

1. **Show an error when the schedule fails to load, not an empty week** (XS)
   - Why: if `data.json` fails to load (bad bar signal, bad deploy), the page shows seven empty days, which reads as "no karaoke this week".
   - Touch: `js/app.js` `init()` (~70-74, 146) and `loadData()` (~181-221).
   - Fix: make `loadData()` return false on failure and stop `init()` before `renderView()`. Show "Couldn't load the schedule. Check your connection." (or "You appear to be offline" when `navigator.onLine` is false) with a Retry button that calls `location.reload()`. Drop the raw `<pre>`. Add an e2e test that aborts the data request.

2. **Stop jumping back to today on every filter change or search keystroke** (XS)
   - Why: someone reading Friday who flips Dedicated or types a search is thrown about 6,000px back to today.
   - Touch: `js/views/WeeklyView.js:22-24, 139-155`.
   - Fix: track `this._scrolledWeek = getWeekStart(weekStart).toDateString()` and call `scrollToToday()` only when that value changes (first render or week navigation). The FAB keeps its own scroll.

3. **Keep "tonight" as tonight until 4 AM** (S)
   - Why: at 12:45 AM, Friday's still-running shows are dimmed and collapsed, and Saturday is labelled Today.
   - Touch: `js/utils/date.js:32` (`isToday`), `js/components/DayCard.js:26-32`, `WeeklyView.scrollToToday`, `js/components/fabs.js`, `test/date.test.mjs`, spec §2.
   - Fix: add `displayToday()` = now minus `NIGHT_ROLLOVER_HOUR` (4). Use it only for the today/past card classes, the scroll target and the FAB. Leave matching, Ended and the 30-day clocks on calendar dates. Test the 00:00-04:00 window, including Sunday morning, which belongs to the previous week's Saturday.

4. **Lift the map venue card above the consent banner** (S)
   - Why: on a first visit on a phone, the banner covers the card's Directions and Details buttons.
   - Touch: `css/views.css:1059-1063`, `css/components.css:1435`, optionally `js/analytics.js`.
   - Fix: below 1024px, add `body:has(.consent-banner) .map-venue-card { bottom: calc(var(--spacing-sm) + <banner height>) }`. Or have `analytics.js` set a `--consent-height` variable, which the FABs can use too.

5. **Lead the map card with "Tonight: 9 PM – 2 AM"** (S)
   - Why: the card lists the whole week, nightly venues take 7 identical lines (277px on a phone), and the user still has to find today.
   - Touch: `js/views/MapView.js:513-514`, `js/utils/render.js:177-185`.
   - Fix: put a "Tonight: …" line first (or "Next: Thu 9 PM"), using `getVenueEventsForDate` for today. In the map card only, collapse identical times across all 7 days into "Every night".

6. **Make the phone Back button close the venue modal** (S)
   - Why: Android Back, the most common way to dismiss a sheet, leaves the site, because opening a modal adds no history entry.
   - Touch: `js/core/router.js:166-172`, `js/app.js:92-116` and `262`, CLAUDE.md URL section, spec §21.
   - Fix: add a router `pushVenue` used only when the modal is opened by a tap. On popstate with no venue, close the modal. Close by X, Esc or backdrop calls `history.back()` when an entry was pushed. `handleHashChange` should close the modal when there is no venueId. Update the "only replaceState caller" docs.

7. **Give the icon-only phone nav accessible names** (XS)
   - Why: at ≤560px the view tabs, the about/submit/generated-page "Back to Directory" link and the map switcher are unnamed (screen readers hear "button, button…"), and the KJs and Bingo icons are hard to guess.
   - Touch: `css/views.css:763-769` (unscoped `.nav-btn span {display:none}`), `css/views.css:1066-1068`, `Navigation.js:184-200`, `MapView.js:168-175`, `scripts/build-pages.js:589`.
   - Fix: scope the rule to `.navigation__views .nav-btn span`, so back links keep their text, and replace `display:none` in both rules with the `.sr-only` clip pattern (`base.css:287`). Add `aria-hidden` to the icons. Visible labels at 375px are an owner call (spec §5 says icon-only).

8. **Fix the CSS order that hides the "Today" FAB label** (XS)
   - Why: the main way back to tonight shows as a bare calendar icon on phones.
   - Touch: `css/layout.css:334-348`.
   - Fix: move `.fab-group__btn .fab-label { display:none }` above the ≤768px media query. The label markup already exists (`index.html:143`).

9. **Show a message when a calendar search matches nothing** (XS)
   - Why: seven empty headers look broken, and there is no hint to clear the search.
   - Touch: `js/views/WeeklyView.js` `template()`, plus `views.css:36` for context.
   - Fix: when `searchQuery` is set and no day or extended range matches, render `<p role="status">No shows match "<escaped query>"</p>` and a Clear search button (`setState({searchQuery:''})`). Make sure the input clears too. Reuse the `.alphabetical-view__empty` styling. A match count is optional.

10. **Expand Next Week and the month sections while searching** (XS)
    - Why: on phones, matches outside this week sit behind collapsed headers.
    - Touch: `js/components/ExtendedSection.js:56-77`.
    - Fix: treat a section as expanded whenever `searchQuery` is non-empty, and don't save that state.

11. **Hide spent one-time events in the detail schedule** (XS)
    - Why: the modal, the A–Z cards and the host section list past events (The Highball: 7, Austin Deaf Club: 1) as the venue's schedule.
    - Touch: `js/utils/render.js:43` (`getVenueHosts`), `:92-97` (`renderScheduleTable`), `:178` (`renderScheduleCompact`), `test/render.test.mjs`.
    - Fix: use `activeEntries(...).filter(e => !isPastOnceEvent(e))` in all three (already imported). Optionally sort recurring rows by weekday, then one-time rows by date. Note it on #169.

12. **Keep the modal close button on screen** (XS)
    - Why: in long modals the X scrolls away, and at ≤480px there is no backdrop to tap.
    - Touch: `css/components.css:576-592`.
    - Fix: make `.venue-modal__close` sticky (`top:0; float:right; z-index:1; background: var(--bg-card)`), or use a sticky header bar. While there, add `100dvh` after the `100vh` max-heights (`:583, 989-995`) and `overscroll-behavior: contain`.

13. **Start loading `data.json` in parallel** (XS)
    - Why: the data request waits behind an 8-level module chain, which costs most on high-latency mobile networks.
    - Touch: `index.html` `<head>`.
    - Fix: add `<link rel="preload" href="/js/data.json" as="fetch" crossorigin="anonymous">` and `<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>`.

14. **Make the search field behave on phones** (XS)
    - Why: it has no label, Enter doesn't dismiss the keyboard (which covers about 40% of the screen), and Esc doesn't clear it.
    - Touch: `js/components/Navigation.js:113-121, ~248, 283-294`.
    - Fix: add `aria-label`, `type="search"` (hide the WebKit cancel button), `enterkeyhint="search"` and `autocomplete="off"`. Enter blurs the field; Esc clears it the way the clear button does. Add `aria-label` to the clear button in both places it is built.

15. **Guard every `localStorage` call** (XS)
    - Why: when site storage is blocked, the module-load migration throws and the calendar renders nothing.
    - Touch: `js/components/ExtendedSection.js:34-49, 72, 88`, `js/utils/debug.js:18`.
    - Fix: add a `safeStorage` helper in `js/utils` (try/catch, returning null or doing nothing) and use it in both files.

16. **Stop the submit form dropping extra nights that have no day** (XS)
    - Why: a reported second-Saturday show disappears with no error.
    - Touch: `js/submit.js:1030-1040` (validation), `575/586` (`collectFormData`), `457/470` (template labels).
    - Fix: validate every `.schedule-entry` (Day, or Date for a one-time night) and show an inline error on the first one that fails. Add the required `*` to the template labels.

17. **Stop the submit form offering the user's home address** (XS)
    - Why: the street-address, address-level and postal-code tokens invite autofilling the submitter's own address into a public venue record.
    - Touch: `submit.html:83/93/98/102`.
    - Fix: use non-matching tokens (e.g. `autocomplete="off"` plus a non-address name, or `autocomplete="venue-street"`). Keep the city datalist.

## Worth doing

- **Add a weekday jump row** (S). Reaching Friday on a phone takes 10,000+ px of scrolling. Touch `Navigation.js`. Add 7 day chips under the week range that call `scrollIntoView` on `.day-card--<day>`, reusing the existing `scroll-margin-top`. Account for the sticky nav height and collapsed past days.
- **Make the whole extended-section header tappable** (XS). It has `cursor:pointer`, but only a 32px chevron toggles it. Touch `views.css:328-341` and `ExtendedSection.js:209`. Give the header `position:relative` and stretch the toggle button over it (`inset:0`), as `.day-card__toggle` already does.
- **Keep the user's map zoom when a filter changes** (S). Every filter or Dedicated tap re-fits the map to the whole metro. Touch `MapView.js:486-490`. Fit only on the first `updateMarkers()`, or when no new marker is inside `map.getBounds()`.
- **Make map selection follow the URL** (S). A `#view=map&venue=` link opens no card, and closing the card leaves `venue=` in the hash. Touch `MapView.js:590-603` and `initMap`. Emit `VENUE_CLOSED` from `hideVenueCard()` (idempotently), and open the card for `readLocation().venueId` after the first marker render.
- **Tell the user when the map can't load** (S). A slow or blocked Leaflet leaves a blank grey screen with no message. Touch `MapView.js:143, 200, 287-316`. Show "Loading map…" until `initMap`. Add a `.catch` that shows "The map couldn't load" with Calendar and A–Z buttons, and remove the failed script tags.
- **Put the modal's Location buttons in one row** (XS). At ≤480px, three stacked full-width buttons push the schedule to the middle of the sheet, and View Map and Directions both open Google Maps. Touch `components.css:~998`. Drop the `flex-direction:column` override and let the row wrap. Check 320px.
- **Enlarge the critical tap targets** (S). The card's event or Tickets icon is 20x22 inside a tappable card, so a near miss opens the modal. Other small controls: search clear 24px, KJ chip clear 20px, Dedicated checkbox 18px, week Today button 29px tall, view tabs 40px, map switcher 39x26, Leaflet zoom 30px. Touch `components.css:81-84, 130-142, 193-207, 280-294, 1170-1183`, `views.css:752`, the map switcher, `.leaflet-control-zoom a`, and `render.js` `renderEventLink`. Give each a 44px hit area using padding with a negative margin, or a transparent `::after` with `inset:-10px`. Add an `aria-label` to the icon-only event link.
- **Make KJ index counts match the dossier** (S). 7 hosts disagree with their dossier, and Story-Oke leads to "check spelling". Touch `KJIndexView.js:226-232` and `render.js:40-47`. Attribute hosts per live entry (`activeEntries` minus `isPastOnceEvent`, then `resolveHostFor`) and drop hosts with 0 venues. Add a unit test in `test/venues.test.mjs` that the index count equals the dossier count.
- **Drop past one-time events from the generated pages** (S). The `/kj/`, `/company/` and `/venue/` landing pages list stale events with raw ISO dates, out of order, and inflate the venue counts. Touch `scripts/build-pages.js:102, 206-222, 490`. In `showsOf`, skip one-time entries dated before today. Format the date ("Sat, Aug 29") and sort one-time entries by date. Extend `test/build-pages.test.mjs`.
- **Let dossier venues open the venue modal** (S). A fan who arrives through a KJ page can't get to details or directions. Touch `KJDossierView.js:206-224`. Add `data-venue-id` and call `attachVenueSelectionListener(this)` in `afterRender`. Add an e2e test.
- **Add a branded 404 page** (S). Pruned venue and KJ pages fall through to Netlify's generic 404. Add a root `/404.html` with absolute asset paths, linking "See karaoke tonight" and "Browse A–Z". The `chrome.js` footer uses relative hrefs, so make them absolute or give this page its own footer. Add the page to `check-css-load-order` and to the CLAUDE.md page table.
- **Make the submit "Submit" read as step 2** (S). It shows green success before anything is sent, and three re-composes lock the user out for an hour. Touch `js/submit.js:922-923, 257, 410-415`. Hide the form after composing, title the panel "Almost done: send it" in a neutral colour, add "Edit my answers", and count the rate limit only when the mailto link or Copy is used.
- **Flag untouched default times** (S). The prefilled 9 PM – 1 AM is reported as fact. Touch `submit.html:152/156`, `submit.js:484/488, 571-572`. Track whether each time was changed and add "Times not given (defaults shown)" to the email, or start the fields empty.
- **Add a "next night" line to the detail schedule** (S). Daily venues show 7 identical rows with no "tonight" cue. Touch `render.js:94-148`. Add "Next: Tonight 8 PM" via `nextOccurrence`, or a `--today` row class. Collapse rows into "Every night" only when the per-show host, link and `lastVerified` are identical.
- **Add a tap-only "Near me" map button** (S). Touch `MapView.js:338`, `views.css`, spec §4. A `.map-controls__btn` calls `map.locate({setView:true, maxZoom:13})` and draws one circle marker, with an inline error on failure. Nothing is stored. It is a new feature, so it needs its own ticket.
- **Name the map markers and clusters, and fix map Escape** (XS). Tabbing through the map announces "button" 14 times. Touch `MapView.js:262-268, 369-373, 447-450`. Use `L.marker({icon, title: venue.name, alt: venue.name})`. Clusters render `<span aria-hidden>N</span><span class="sr-only">N venues, zoom in</span>`. Escape should collapse an expanded card before closing it.
- **Rewrite the no-shows copy** (XS). "No schedule information available" suggests missing data. Touch `render.js:97` and `build-pages.js:500`. Use "No karaoke nights currently listed. Check with the venue." Check e2e for the old string first.

## Polish

- **Move the day count into the sticky header** (XS). Touch `DayCard.js:101-122`. Show "11/19 · 21 venues", keep the `.day-card__count` class (e2e uses it), and drop the repeated weekday.
- **Drop "Every Thursday ·" on weekly shows in calendar cards** (XS), so nth-week shows stand out. Touch `render.js:391` (`getScheduleContext`) and `test/render.test.mjs`. A compact time format ("8 PM – 2 AM") is optional and limited to the card.
- **Drop the current year from the week range** (XS). It keeps the phone nav at two rows off the current week. Touch `date.js:68-80` and the spec §5 note. Keep "Today" as text.
- **Explain the day-card groups** (XS). Add a "How each day is grouped" section to `about.html` and link it from the section titles in `sections.js:39-45` and `DayCard.js:138`. No per-card captions. Featured wording is the owner's call (ADR-017).
- **Make the Dedicated control self-explanatory** (XS). Touch `Navigation.js:129-137` and `MapView.js:80-87, 158-164`. Add a `title="Karaoke-only venues"` hint and the desktop label "Show karaoke-only venues". The map button gets a fixed label plus `aria-pressed`. Any rename has to be applied everywhere (tag, search keyword, spec §10), so it is an owner call.
- **Bump Font Awesome to 6.5.2+** (XS). The X/Twitter icon is blank on 8 venues. Touch `index.html:31`, `about.html:30`, `submit.html:30`, `bingo.html:32`, `build-pages.js:572`. Switch bluesky to `fa-bluesky` (`url.js:17`).
- **Name the title-only icon links** (XS). Add `aria-label` to the week arrows (`Navigation.js:95/99`), social links (`url.js:119`), footer links (`chrome.js:92-99`) and the about.html Contact icons, with `aria-hidden` on the `<i>`.
- **Add Share fallbacks** (XS). Touch `url.js:179-198`. Wrap the clipboard call in try/catch, fall back to `prompt('Copy this link', url)`, and announce "Copied!" through `aria-live`.
- **Add a Call button** (XS) to the modal's Location row when `venue.phone` is set (only 1 venue today). Touch `render.js:157-165`.
- **Fit the map with padding for the overlay controls** (XS) so edge-of-metro pins clear them. Touch `MapView.js:489`. Use `fitBounds(b, {paddingTopLeft:[24, <controls bottom + 16>], paddingBottomRight:[24,24]})`.
- **Manage focus on the map card** (S). Touch `MapView.js:493, 590-603`. Focus the close button on open, restore focus on close, and add `role="region"` with the venue name as its label.
- **Improve the A–Z letter strip on phones** (XS/S). Touch `views.css:440, 453-467` and `AlphabeticalView.afterRender`. Add a right-edge fade mask (XS). An IntersectionObserver for the active letter, with `aria-current` and `scrollIntoView({inline:'nearest'})`, is the S half.
- **Fix the dossier copy** (XS). Touch `KJDossierView.js:~86-105`. Label "Company:" / "KJ:" / "Host:" by registry, change "recurring slots" to "recurring nights", link "Contact the directory" to `/submit.html`, and remove the `<code>host</code>` jargon.
- **Collapse identical daily rows in the dossier** (S). Touch `KJDossierView.js:218`, plus a pure helper in `date.js` with a test. Group only entries whose host and per-show fields match.
- **Add missing facts to generated pages** (XS–S). Touch `build-pages.js:583`. The tagline should use the venue's `address.city` (XS correctness fix), then add a website/socials row, tags, a directions link and left-aligned `th`.
- **Submit form polish** (XS–S each). Enforce the ZIP pattern in the `submit.js:1014-1027` loop. Remove the `scrollIntoView` on choosing "I'm the KJ" (`submit.js:288-294`). Add "Night N" headers and an outline Remove button (`submit.css:223-233`). Tie labels to controls with generated ids and fieldsets (`submit.js:443-494`).
- **Section headings and landmarks** (XS/S). Touch `DayCard.js:137-139`. Drop the `aria-label` on `<section>`. Optionally pass a `headingLevel` so venue names under a heading render as `h4`. Check `e2e/day-card-sections.spec.js`.
- **Add a skip link** (XS). Put `<a class="skip-link" href="#main-content">Skip to listings</a>` in the `chrome.js` header, add `tabindex="-1"` on `main` (`index.html:124`), and check about.html and submit.html have a matching main id.
- **Honour prefers-reduced-motion** (S). Add a `base.css` media block (scroll-behavior auto, near-zero transitions). Touch `fabs.js:54` and the cluster-click `flyToBounds` (`MapView.js:413-416`). In Bingo, skip the celebration and the white `.screen-flash` (`bingo.css:370`, `bingo.js ~300`).
- **Raise the dimming on Ended cards** (XS). Touch `components.css:1079-1081`. Change opacity from 0.4 (about 2.5:1 contrast) to about 0.6. This changes ADR-020's look, so the owner signs off.
- **Reserve space for the injected header** (XS). It causes 0.08–0.10 CLS on about, submit and bingo. Touch `css/layout.css`. Add `[data-site-header]:empty { min-height: <measured> }`, per breakpoint.
- **Add an analytics opt-out** (XS). Touch `js/analytics.js` and `about.html:118`. Add a reset function (`removeItem` plus reload) and a "Change analytics choice" button that shows the current choice.
- **Fix the About copy** (XS). Touch `about.html:57, 66, 78, 80, 104, 132-140`. Remove the tag-filter and "nearby" claims, make the holiday notice evergreen, merge Contact Us into the feedback panel, and fix "no-nonsense" and "Austin, Texas".
- **Header and footer** (XS). Wrap the `chrome.js:61-77` title in `<a href="/">`. Add Directory and Bingo links to the footer with absolute hrefs (`chrome.js:26-30`), and align labels with `build-pages.js:602-603`. Which site name is canonical, and whether Documentation stays in the footer, are owner calls.
- **Bingo** (XS–S). Always show New Card, with `confirm()` when the card has marks (`bingo.css:232-236`). Expand the 25-phrase pool to about 50 kind, observable phrases and drop the mocking ones (`bingo.js:2-8`). Render cells as `<button aria-pressed>` with `:focus-visible` and `role="status"` on the win message.

## Considered and dropped

- **Modal doesn't say which show was tapped.** Threading entry identity through the card, the event payload, the map and deep links goes beyond a quick win. The cheap first step is deleting the dead `venue.eventName` branch at `VenueModal.js:79`.
- **First-load auto-scroll hides the site name.** Jumping to tonight is the core use case (#6), and the title and share metadata still name the site. It is a product call, not a fix.
- **Denser A–Z cards on mobile.** The full card is A–Z's deliberate "show everything" surface, and making it denser needs owner input on what the card contains.
- **Contact methods need a checkbox tap first.** Fixing it changes the email payload the curator reads, for minor friction on one path.
- **Long cache lifetimes for static images.** Revalidating them costs cheap parallel 304s that are off the data critical path, so the user gain is negligible.