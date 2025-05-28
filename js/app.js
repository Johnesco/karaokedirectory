// ======================
// CONSTANTS & CONFIG
// ======================
const TODAY = new Date().toDateString();
let currentWeekStart = new Date();
let showDedicated = true;

// ======================
// HELPER FUNCTIONS
// ======================
const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

const getDayName = (date) => date.toLocaleDateString("en-US", { weekday: "long" });

const formatDateShort = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const isCurrentDay = (date) => date.toDateString() === TODAY;

// ======================
// MODAL FUNCTIONS
// ======================
function showVenueDetails(venue) {
  const modal = document.getElementById("venue-modal");
  const venueName = document.getElementById("modal-venue-name");
  const venueInfo = document.getElementById("modal-venue-info");

  venueName.textContent = venue.VenueName;
  venueInfo.innerHTML = createModalContent(venue);
  modal.style.display = "block";

  setupModalEventListeners(modal);
}

function createModalContent(venue) {
  return `
    
    <div class="modal-address">
    <strong>Address:</strong><br>
      <div class="venue-address"><a href="${createMapLink(venue)}" target="_blank" title="View on Google Maps">${formatAddress(venue)}</a></div>
    </div>
    <div class="modal-schedule">
      <strong>Schedule:</strong>
      ${createScheduleList(venue.schedule)}
    </div>
    <div><strong>Venue Social Media:</strong><br>
      ${createSocialLinks(venue)}</div>  
    </div>
    <div class="modal-kj">
    <hr>
    <strong>Karaoke Info:</strong><br>
      ${venue.KJ.Company ? `<strong>Hosted By: </strong>${venue.KJ.Company}<br>` : ""}
      ${venue.KJ.Host ? `<strong>KJ:</strong> ${venue.KJ.Host}<br>` : ""}
      ${venue.KJ.Website ? `<a href="${venue.KJ.Website}">${venue.KJ.Website}</a>` : ""}
      ${venue.KJ.socials ? `<strong>Karaoke Social Media:</strong><br>${createSocialLinks({ socials: venue.KJ.socials })}` : ""}
    </div>
  `;
}

function createScheduleList(schedule) {
  if (schedule.length === 0) return "";

  const items = schedule.map((event) => {
    const [cadence, day] = event.day;
    const pluralDay = cadence === "every" ? day : `${day}s`;
    return `<li class="modal-schedule-item">${capitalizeFirstLetter(cadence)} ${pluralDay}: ${event.time}</li>`;
  });

  return `<ul>${items.join("")}</ul>`;
}

function setupModalEventListeners(modal) {
  // Handle close button
  document.querySelector(".close-modal").onclick = () => (modal.style.display = "none");

  // Handle backdrop clicks ONLY (ignores all content)
  modal.addEventListener("click", function (e) {
    // Check if clicked directly on the modal backdrop (not children)
    if (e.target === this) {
      modal.style.display = "none";
    }
  });
}

// ======================
// DATE UTILITIES
// ======================
function formatWeekRange(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  return `Viewing: ${formatDateShort(startDate)} - ${formatDateShort(endDate)} ${endDate.getFullYear()}`;
}

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

// ======================
// VENUE UTILITIES
// ======================
function hasKaraokeOnDate(venue, date) {
  const dayName = getDayName(date);

  for (const event of venue.schedule) {
    const [ordinal, ordinalDay] = event.day;
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

function createMapLink(venue) {
  const address = `${venue.VenueName} ${venue.Address.Street}, ${venue.Address.City} ${venue.Address.State} ${venue.Address.Zip}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function formatAddress(venue) {
  return `${venue.Address.Street}<br>${venue.Address.City}, ${venue.Address.State}, ${venue.Address.Zip}`;
}

function createSocialLinks(item) {
  // Handle case where we pass just socials object (for KJ)
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

  const socials = [];

  // Only add map link if this is a venue (not KJ)
  if (item.Address) {
    socials.push(
      `<a href="${createMapLink(item)}" target="_blank" title="View on Google Maps"><i class="fas fa-map-marker-alt"></i></a>`
    );
  }

  for (const [platform, info] of Object.entries(socialPlatforms)) {
    if (socialsObj[platform]) {
      socials.push(
        `<a href="${socialsObj[platform]}" target="_blank" title="${info.title}"><i class="${info.icon}"></i></a>`
      );
    }
  }

  return `<div class="social-links">${socials.join("")}</div>`;
}

// ======================
// DOM RENDERING
// ======================
function renderWeek() {
  updateWeekDisplay();
  clearContainer();
  renderAllDays();
}

function updateWeekDisplay() {
  document.getElementById("week-display").textContent = formatWeekRange(currentWeekStart);
}

function clearContainer() {
  document.getElementById("schedule-container").innerHTML = "";
}

function renderAllDays() {
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
    const article = articles.find((a) => lowerName.startsWith(a));
    return article ? name.slice(article.length) : name;
  };

  return karaokeData.listings
    .map((venue) => {
      const { hasEvent, timeInfo } = hasKaraokeOnDate(venue, date);
      return hasEvent ? { ...venue, timeInfo } : null;
    })
    .filter((venue) => {
      if (!venue) return false;
      
      // Check if venue should be excluded based on showDedicated flag
      if (!showDedicated && venue.Dedicated) return false;
      
      // Check timeframe validity
      const timeframe = venue.Timeframe;
      if (timeframe) {
        // Ensure date is in YYYY-MM-DD format for comparison
        const renderDate = date instanceof Date ? date.toISOString().split('T')[0] : date;
        
        // If no StartDate and no EndDate, show venue
        if (!timeframe.StartDate && !timeframe.EndDate) {
          // Show venue (no restrictions)
        }
        // If only EndDate exists, show if EndDate hasn't passed
        else if (!timeframe.StartDate && timeframe.EndDate) {
          if (renderDate > timeframe.EndDate) return false;
        }
        // If only StartDate exists, show if render date is that day or date has passed
        else if (timeframe.StartDate && !timeframe.EndDate) {
          if (renderDate < timeframe.StartDate) return false;
        }
        // If both StartDate and EndDate exist
        else if (timeframe.StartDate && timeframe.EndDate) {
          if (renderDate < timeframe.StartDate) return false;
          if (renderDate > timeframe.EndDate) return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => getSortableName(a.VenueName).localeCompare(getSortableName(b.VenueName)));
}

function createDayHTML(date, venues) {
  return `
    
    <div class="day-card">
    <div class="day-header ${isCurrentDay(date) ? "today" : ""}">
      <span>${getDayName(date)}</span>
      <span class="date-number ${isCurrentDay(date) ? "today" : ""}">
        ${formatDateShort(date)} ${isCurrentDay(date) ? "(today)" : ""}
      </span>
    </div>
      <div class="venue-list">
        ${venues.length > 0 ? createVenuesList(venues) : '<div class="no-events">No karaoke venues scheduled</div>'}
      </div>
    </div>
  `;
}

function createVenuesList(venues) {
  return venues
    .map(
      (venue) => `
    <div class="venue-item">
      <div class="venue-name">${venue.VenueName}</div>
      <div class="venue-kj">${venue.KJ.Company ? `${venue.KJ.Company}<br>` : ""}${venue.KJ.Host ? ` with ${venue.KJ.Host}` : ""}</div>
      <div class="venue-time">${venue.timeInfo.time}${
        venue.timeInfo.description ? ` <span class="time-description"><br>(${venue.timeInfo.description})</span>` : ""
      }</div>
      <div class="venue-address"><a href="${createMapLink(venue)}" target="_blank" title="View on Google Maps">${formatAddress(venue)}</a></div>
      <button class="details-btn" onclick="showVenueDetails(${JSON.stringify(venue).replace(/"/g, "&quot;")})">
        See Details
      </button>
    </div>
  `
    )
    .join("");
}

function appendDayToContainer(html) {
  document.getElementById("schedule-container").insertAdjacentHTML("beforeend", html);
}

// ======================
// EVENT LISTENERS
// ======================
function setupEventListeners() {
  const backToTopButton = document.getElementById("backToTop");

  window.addEventListener("scroll", () => {
    backToTopButton.classList.toggle("visible", window.pageYOffset > 300);
  });

  backToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

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

  document.getElementById("dedicated-toggle").addEventListener("change", (e) => {
    showDedicated = e.target.checked;
    renderWeek();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("venue-modal").style.display === "block") {
      document.getElementById("venue-modal").style.display = "none";
    }
  });
}

// ======================
// INITIALIZATION
// ======================
function init() {
  setupEventListeners();
  renderWeek();
}

// Start the application
init();
