// ======================
// SECURITY UTILITIES
// ======================
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

// ======================
// CONSTANTS & STATE
// ======================
const TODAY = new Date().toDateString();
let currentWeekStart = new Date();
let showDedicated = true;

// ======================
// HELPERS
// ======================
const capitalizeFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1);
const getDayName = (date) => date.toLocaleDateString("en-US", { weekday: "long" });
const formatDateShort = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const isCurrentDay = (date) => date.toDateString() === TODAY;

function formatWeekRange(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  return `Viewing: ${formatDateShort(startDate)} - ${formatDateShort(endDate)} ${endDate.getFullYear()}`;
}

function createMapLink(venue) {
  const address = `${venue.VenueName} ${venue.Address.Street}, ${venue.Address.City} ${venue.Address.State} ${venue.Address.Zip}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function createSocialLinks(item) {
  const socialsObj = item.socials || item;
  const socialPlatforms = {
    Facebook: { icon: "fa-brands fa-facebook", title: "Facebook" },
    Instagram: { icon: "fa-brands fa-instagram", title: "Instagram" },
    Bluesky: { icon: "fa-solid fa-b", title: "Bluesky" },
    Tiktok: { icon: "fa-brands fa-tiktok", title: "TikTok" },
    Twitter: { icon: "fa-brands fa-twitter", title: "Twitter" },
    Youtube: { icon: "fa-brands fa-youtube", title: "YouTube" },
    Website: { icon: "fa-solid fa-globe", title: "Website" }
  };

  const links = [];

  if (item.Address) {
    links.push(`
      <a href="${escapeHtml(createMapLink(item))}" target="_blank" rel="noopener noreferrer" title="View on Google Maps">
        <i class="fas fa-map-marker-alt"></i>
      </a>
    `);
  }

  for (const [platform, info] of Object.entries(socialPlatforms)) {
    if (socialsObj[platform]) {
      const safeUrl = sanitizeUrl(socialsObj[platform]);
      if (safeUrl) {
        links.push(`
          <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(info.title)}">
            <i class="${escapeHtml(info.icon)}"></i>
          </a>
        `);
      }
    }
  }

  return `<div class="social-links">${links.join('')}</div>`;
}

// ======================
// DATE & SCHEDULE LOGIC
// ======================
function isOrdinalDate(date, ordinal, dayName) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return false;

  const validOrdinals = ["first", "second", "third", "fourth", "fifth", "last", "every"];
  if (!validOrdinals.includes(ordinal)) return false;
  if (ordinal === "every") return true;

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayIndex = weekdays.indexOf(dayName);
  if (targetDayIndex === -1) return false;

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Get all occurrences of dayName in this month
  const occurrences = [];
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();

  let firstOccurrence = 1 + ((targetDayIndex - firstDayOfWeek + 7) % 7);
  for (let d = firstOccurrence; d <= 31; d += 7) {
    const testDate = new Date(year, month, d);
    if (testDate.getMonth() !== month) break;
    occurrences.push(d);
  }

  if (ordinal === "last") return day === occurrences[occurrences.length - 1];

  const ordinalIndex = ["first", "second", "third", "fourth", "fifth"].indexOf(ordinal);
  return ordinalIndex < occurrences.length && day === occurrences[ordinalIndex];
}

function hasKaraokeOnDate(venue, date) {
  const dayName = getDayName(date);

  for (const event of venue.schedule) {
    const [ordinal, ordinalDay] = event.day;
    // Add default description if missing
    event.description = event.description || `${capitalizeFirstLetter(ordinal)} ${ordinalDay}`;

    if (ordinalDay === dayName && isOrdinalDate(date, ordinal, ordinalDay)) {
      return {
        hasEvent: true,
        timeInfo: {
          time: event.time,
          description: event.description
        }
      };
    }
  }
  return { hasEvent: false };
}

// ======================
// DOM RENDERING
// ======================
function updateWeekDisplay() {
  document.getElementById("week-display").textContent = formatWeekRange(currentWeekStart);
}

function clearScheduleContainer() {
  const container = document.getElementById("schedule-container");
  container.innerHTML = '';
}

function renderWeek() {
  updateWeekDisplay();
  clearScheduleContainer();
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    const venues = getVenuesForDate(date);
    appendDayToContainer(createDayHTML(date, venues));
  }
}

function getVenuesForDate(date) {
  const getSortableName = (name) => {
    const articles = ["the ", "a ", "an ", "la ", "el ", "le "];
    const lowerName = name.toLowerCase();
    const article = articles.find(a => lowerName.startsWith(a));
    return article ? name.slice(article.length) : name;
  };

  return karaokeData.listings
    .map(venue => {
      const { hasEvent, timeInfo } = hasKaraokeOnDate(venue, date);
      return hasEvent ? { ...venue, timeInfo } : null;
    })
    .filter(venue => {
      if (!venue) return false;

      if (!showDedicated && venue.Dedicated) return false;

      const timeframe = venue.Timeframe;
      if (timeframe) {
        const renderDate = date.toISOString().split('T')[0];

        if (timeframe.StartDate && renderDate < timeframe.StartDate) return false;
        if (timeframe.EndDate && renderDate > timeframe.EndDate) return false;
      }
      return true;
    })
    .sort((a, b) => getSortableName(a.VenueName).localeCompare(getSortableName(b.VenueName)));
}

function createDayHTML(date, venues) {
  return `
    <div class="day-card">
      <div class="day-header ${isCurrentDay(date) ? 'today' : ''}">
        <span>${escapeHtml(getDayName(date))}</span>
        <span class="date-number ${isCurrentDay(date) ? 'today' : ''}">
          ${escapeHtml(formatDateShort(date))} ${isCurrentDay(date) ? '(today)' : ''}
        </span>
      </div>
      <div class="venue-list">
        ${venues.length ? createVenuesList(venues) : '<div class="no-events">No karaoke venues scheduled</div>'}
      </div>
    </div>
  `;
}

function createVenuesList(venues) {
  return venues.map(venue => `
    <div class="venue-item">
      <div class="venue-name">${escapeHtml(venue.VenueName)}</div>
      <div class="venue-kj">
        ${venue.KJ.Company ? escapeHtml(venue.KJ.Company) + '<br>' : ''}
        ${venue.KJ.Host ? `with ${escapeHtml(venue.KJ.Host)}` : ''}
      </div>
      <div class="venue-time">${escapeHtml(venue.timeInfo.time)}
        ${venue.timeInfo.description ? `<span class="time-description"><br>(${escapeHtml(venue.timeInfo.description)})</span>` : ''}
      </div>
      <div class="venue-address">
        <a href="${escapeHtml(createMapLink(venue))}" target="_blank" rel="noopener noreferrer" title="View on Google Maps">
          ${escapeHtml(venue.Address.Street)}<br>
          ${escapeHtml(venue.Address.City)} ${escapeHtml(venue.Address.State)}, ${escapeHtml(venue.Address.Zip)}
        </a>
      </div>
      <button class="details-btn" data-id="${escapeHtml(venue.id)}">See Details</button>
    </div>
  `).join('');
}

function appendDayToContainer(html) {
  const container = document.getElementById("schedule-container");
  container.insertAdjacentHTML("beforeend", DOMPurify.sanitize(html));
}

// ======================
// MODAL LOGIC
// ======================
function showVenueDetails(venue) {
  const modal = document.getElementById("venue-modal");
  const venueNameElem = document.getElementById("modal-venue-name");
  const venueInfoElem = document.getElementById("modal-venue-info");

  venueNameElem.textContent = venue.VenueName;
  venueInfoElem.innerHTML = createModalContent(venue);

  modal.style.display = "block";
}

function createModalContent(venue) {
  return `
    <div class="modal-venue">
      <strong>Address:</strong><br>
      <div class="venue-address">
        <a href="${escapeHtml(createMapLink(venue))}" target="_blank" rel="noopener noreferrer" title="View on Google Maps">
          ${escapeHtml(venue.Address.Street)}<br>
          ${escapeHtml(venue.Address.City)} ${escapeHtml(venue.Address.State)}, ${escapeHtml(venue.Address.Zip)}
        </a>
      </div>
      <div class="modal-schedule">
        <strong>Schedule:</strong>
        ${createScheduleList(venue.schedule)}
      </div>
      <div>
        <strong>Venue Social Media:</strong><br>
        ${createSocialLinks(venue)}
      </div>
    </div>
    <div class="modal-kj">
      <hr>
      <strong>Karaoke Info:</strong><br>
      ${venue.KJ.Company ? `<strong>Hosted By: </strong>${escapeHtml(venue.KJ.Company)}<br>` : ''}
      ${venue.KJ.Host ? `<strong>KJ:</strong> ${escapeHtml(venue.KJ.Host)}<br>` : ''}
      ${venue.KJ.Website ? `<a href="${escapeHtml(sanitizeUrl(venue.KJ.Website))}" target="_blank" rel="noopener noreferrer">${escapeHtml(venue.KJ.Website)}</a><br>` : ''}
      ${venue.KJ.KJsocials ? `<strong>Karaoke Social Media:</strong><br>${createSocialLinks({ socials: venue.KJ.KJsocials })}` : ''}
    </div>
  `;
}

function createScheduleList(schedule) {
  if (!schedule.length) return '';

  const items = schedule.map(event => {
    const [cadence, day] = event.day;
    const pluralDay = cadence === 'every' ? day : `${day}s`;
    return `<li class="modal-schedule-item">${escapeHtml(capitalizeFirstLetter(cadence))} ${escapeHtml(pluralDay)}: ${escapeHtml(event.time)}</li>`;
  });

  return `<ul>${items.join('')}</ul>`;
}

function setupModalEventListeners() {
  const modal = document.getElementById("venue-modal");
  const closeBtn = modal.querySelector(".close-modal");

  // Close on click close button
  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Close on clicking outside modal content
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // Close on ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "block") {
      modal.style.display = "none";
    }
  });
}

// ======================
// EVENT LISTENERS & INIT
// ======================
function setupEventListeners() {
  // Back to top button
  const backToTop = document.getElementById("backToTop");
  window.addEventListener("scroll", () => {
    backToTop.classList.toggle("visible", window.pageYOffset > 300);
  });
  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Week navigation buttons
  document.getElementById("prev-week").addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderWeek();
  });
  document.getElementById("next-week").addEventListener("click", () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderWeek();
  });
  document.getElementById("this-week").addEventListener("click", () => {
    currentWeekStart = new Date();
    renderWeek();
  });

  // Dedicated toggle
  document.getElementById("dedicated-toggle").addEventListener("change", (e) => {
    showDedicated = e.target.checked;
    renderWeek();
  });

  // Venue details buttons (event delegation)
  document.getElementById("schedule-container").addEventListener("click", (e) => {
    if (e.target.classList.contains("details-btn")) {
      const venueId = e.target.dataset.id;
      const venue = karaokeData.listings.find(v => v.id === venueId);
      if (venue) {
        showVenueDetails(venue);
      }
    }
  });
}

function init() {
  if (typeof DOMPurify !== 'object') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js';
    script.onload = () => {
      setupModalEventListeners();
      setupEventListeners();
      renderWeek();
    };
    document.head.appendChild(script);
  } else {
    setupModalEventListeners();
    setupEventListeners();
    renderWeek();
  }
}

init();
