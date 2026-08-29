# Spike: does the entity graph pay off in the SPA?

> **Status:** Analysis complete — verdicts below, follow-ups filed
> **Date:** 2026-08-28
> **Type:** Spike (research/investigation)
> **Issue:** [#222](https://github.com/Johnesco/karaokedirectory/issues/222)
> **Frame:** [ADR-013](../adr/013-show-centric-presentation.md) — storage's unit is the venue, identity's unit is the registries, presentation's unit is the show. Every candidate below is judged as "does this grouping-of-shows earn a link?"

## Question

ADR-011 settled identity — every linkable thing is `{type, id}` over a registry —
and has zero consumers in the SPA. Which of its downstream links are worth
building, and in what order?

## Verdicts

| # | Candidate | Verdict | Effort | Sequenced |
|---|---|---|---|---|
| 1 | Host name → dossier link | **Go** — detail surfaces; compact card deferred | S | after #244 merges |
| 2 | Tag chips → `?tag=` | **Defer — ownership transferred to #37** | — | with #37 modality 8 |
| 3 | Generated pages → SPA deep links | **Go** — one direction only | S | immediately |
| 4 | "Tonight" entry point | **No-Go** | — | — |
| 5 | Map marker encoding | **No-Go** | — | — |
| 6 | City as a real entity | **Defer** — trigger named | — | — |

Two Gos, both S. Follow-ups filed for each; #37 updated with the ownership
transfer and the city note.

---

### 1. Host name → dossier link — **Go** (detail surfaces), card **deferred**

Everything is already built except the `<a>`. The destination exists
(`KJDossierView`); `?kj=` resolves registry ids exactly, and
`hostMatches` (`js/services/venues.js:226-238`) answers an id query by id alone
— **for both `kjId` and `companyId`**, so KJ links and company links are the
same mechanism. The hydrated host carries both ids for exactly this purpose
(`js/utils/hosts.js:66-67`).

**Where:** `renderHostSection`'s name and affiliation lines become links —
name → `/?kj=<kjId>`, affiliation → `/?kj=<companyId>`. That covers all four
detail surfaces at once, since #223 rebuilt the section on one renderer. This
**blocks on #244** (the #223 PR): it rewrote `renderHostSection` venue-based,
and building on the pre-#244 shape would be immediately-conflicting work.

**The card question the ticket asked:** deferred, not decided-yes. The compact
card is the primary scanning surface and just had its hierarchy tuned
(#224/#230); the detail modal is one tap away, so a detail-surface link puts
any host two taps from any card. The delegated card click already excludes
links (spec §6), so a card link is *compatible* — the deferral is editorial,
not technical. Trigger to revisit: detail links shipped and any signal (Clarity
click data, an owner request) that two taps is one too many.

### 2. Tag chips — **Defer here; #37 owns it**

The boundary call the ticket demanded: **the destination view is filter work,
and #37 (modality 8) owns filter work.** The identity line's contribution is
already finished — `renderTagBadge({ href })` exists and waits
(`js/utils/tags.js`). When #37 ships a tag-filter destination, the chip href is
a one-line consumer of it. Recording this in both tickets closes the overlap.

Two data points for whenever #37 schedules it. Density is thinner than the
vocabulary suggests: 15 of 19 tags are in live use, but 5 of those sit on ≤2
venues, 10 of 75 active venues carry no tags at all, and the average is 1.12
per venue — a `?tag=live-band-karaoke` page would show exactly one venue.
And **two ids are not slug-safe** (`21+`, `18+` — flagged in ADR-011 §1), which
must be settled before any `?tag=<id>` URL exists.

### 3. Generated pages → SPA — **Go**, one direction, link-only

The 93 generated pages and the SPA are two disconnected sites over one dataset
— but the disconnection is asymmetric, and so is the fix.

**Pages link INTO the equivalent SPA state.** Today every page's escape hatch
is `href="/"` (`scripts/build-pages.js:561,573`) — a visitor who lands on
`/kj/kj-stephanie/` from search and wants the live app is dumped at the
calendar with their context discarded. The fix: `/kj/<id>/` and
`/company/<id>/` link to `/?kj=<id>` (both resolve — see candidate 1), and
`/venue/<id>/` links to the venue share deep-link (`venueShareUrl` format,
`#view=weekly&venue=<id>`).

**The SPA does not link out to pages.** #174 positioned the pages as the
crawlable, self-canonicalizing SEO surface (`build-pages.js:538`) and the SPA
as the app humans use and share (`venueShareUrl` deliberately pins the SPA
URL). Sending app users out to static snapshots of data they are already
looking at live would be duplication as UX.

**The L-sized option — collapsing the two rendering paths — is rejected**, not
deferred: ADR-012 adopted generation from the same `js/data.json` precisely so
the two surfaces cannot drift in facts, and ADR-013 names them as different
groupings of the same shows. Two renderers over one dataset is the design,
not a defect.

### 4. "Tonight" entry point — **No-Go**

The question is real — Display Philosophy §6 names it as *the* use case — but
it is already answered three ways: the default landing **is** today (the
weekly view opens on the current week and auto-scrolls to today's card, spec
§2); the map has a Today filter (#215); and the jump-to-today FAB exists on
the calendar. A `?view=tonight` route would add a fourth nav destination to
answer a question the landing state already answers, and a tonight-only list
is the one view that *hides* the rest of the week — against Philosophy §3,
where the week is the heartbeat and tonight is its loudest beat, not a
separate organ.

### 5. Map marker encoding — **No-Go**

Every candidate dimension is either already a *filter* or is editorial. Time:
the map's date buttons **remove** non-matching venues entirely (#215/#217) —
strictly stronger signal than any per-marker glyph. Dedicated: a toggle,
same argument. Tags: an encoding would elevate some tags over others, which
Philosophy §1/§5 exists to prevent. And marker clustering collapses nearby
pins into count bubbles, so per-marker signal dies exactly where the map is
densest. Trigger to revisit: the map drops clustering, or gains a legend
surface — neither is proposed anywhere.

### 6. City as a real entity — **Defer**, trigger named

The registry's real job today is the validation whitelist #170 built it for,
and it does that job with display-name matching. Promoting `address.city` to
ids is a small data migration **plus** a curator-master migration, a
`submit.html` datalist change (#212 emits names), and validator rework — real
cost, and the payoff is a destination view nobody has scheduled. The geography
need is real (36 of 75 active venues sit outside Austin proper; the largest
non-Austin city holds 6) but it reads as *filter* work — #37's location
modality — where proximity, not municipality, is the likely right answer, and
no geolocation exists anywhere in the codebase to build on yet.

**Trigger:** when a city destination or location filter is actually scheduled,
the id migration happens **first**, as its own S ticket, under ADR-011's
existing contract. Until then the registry stays a whitelist and its 17
unreferenced ids stay unreferenced — that is a held reservation, not drift.

---

## Sequencing

1. **Now:** candidate 3 (pages → SPA links) — `scripts/build-pages.js` only,
   collides with nothing in flight.
2. **After #244 merges:** candidate 1 (host links in `renderHostSection`).
3. **With #37, whenever it schedules:** candidate 2's destination (chip href
   rides along), candidate 6's migration-first rule.
4. **Closed:** candidates 4 and 5, each with a written trigger if the ground
   shifts.

## What this spike did not do

No code. The verdicts above are decisions; the two Gos are filed as their own
tickets with acceptance criteria, and everything deferred names the condition
that reopens it.
