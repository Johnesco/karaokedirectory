// ======================
// CONSTANTS & CONFIG
// ======================
const today = new Date().toDateString();
let currentWeekStart = new Date();
let showDedicated = true;

// ======================
// MODAL FUNCTIONS
// ======================
function showVenueDetails(venue) {
  const modal = document.getElementById('venue-modal');
  const venueName = document.getElementById('modal-venue-name');
  const venueInfo = document.getElementById('modal-venue-info');
  
  venueName.textContent = venue.VenueName;
  
  let infoHTML = `
    <div class="modal-address">
      <strong>Address:</strong><br>
      <div class="venue-address"><a href="${createMapLink(venue)}" target="_blank" title="View on Google Maps">${formatAddress(venue)}</a></div>
    </div>
    <div class="modal-kj">
      ${venue.KJ.Company ? `<strong>KJ:</strong> <div class="venue-kj">${venue.KJ.Company}<br>` : ""}${venue.KJ.Host ? ` with ${venue.KJ.Host}` : ""}</div>
    </div>
    
    <div class="modal-schedule">
      <h3>Schedule:</h3>`;
  
  const weeklyDays = Object.entries(venue.schedule.weekly);
  if (weeklyDays.length > 0) {
    infoHTML += `<h4>Weekly:</h4><ul>`;
    weeklyDays.forEach(([day, time]) => {
      infoHTML += `<li class="modal-schedule-item">Every ${day}: ${time}</li>`;
    });
    infoHTML += `</ul>`;
  }
  
  if (venue.schedule.ordinal.length > 0) {
    infoHTML += `<h4>Special Events:</h4><ul>`;
    venue.schedule.ordinal.forEach(event => {
      infoHTML += `<li class="modal-schedule-item">${event.description}: ${event.time}</li>`;
    });
    infoHTML += `</ul>`;
  }
  
  venueInfo.innerHTML = infoHTML + `<strong>Social Media:</strong>${createSocialLinks(venue)}</div>`;
  modal.style.display = 'block';
  
  document.querySelector('.close-modal').onclick = () => {
    modal.style.display = 'none';
  };
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// ======================
// DATE UTILITIES
// ======================
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

function isToday(date) {
    return date.toDateString() === today;
}

function formatWeekRange(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const options = { month: "short", day: "numeric" };
    const startStr = startDate.toLocaleDateString("en-US", options);
    const endStr = endDate.toLocaleDateString("en-US", { ...options, year: "numeric" });

    return `Viewing: ${startStr} - ${endStr}`;
}

function isOrdinalDate(date, ordinal, dayName) {
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const lastDay = new Date(year, month + 1, 0).getDate();

    const occurrences = [];
    for (let d = 1; d <= lastDay; d++) {
        const testDate = new Date(year, month, d);
        if (testDate.toLocaleDateString("en-US", { weekday: "long" }) === dayName) {
            occurrences.push(d);
        }
    }

    const ordinalIndex = { first: 0, second: 1, third: 2, fourth: 3, last: occurrences.length - 1 }[ordinal];
    return occurrences[ordinalIndex] === day;
}

// ======================
// VENUE UTILITIES
// ======================
function hasKaraokeOnDate(venue, date) {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });

    if (venue.schedule.weekly[dayName]) {
        return {
            hasEvent: true,
            timeInfo: {
                time: venue.schedule.weekly[dayName],
                description: "Weekly karaoke"
            }
        };
    }

    for (const ordinalEvent of venue.schedule.ordinal) {
        const [ordinal, ordinalDay] = ordinalEvent.day;
        if (ordinalDay === dayName && isOrdinalDate(date, ordinal, ordinalDay)) {
            return {
                hasEvent: true,
                timeInfo: {
                    time: ordinalEvent.time,
                    description: ordinalEvent.description
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

function createSocialLinks(venue) {
    const socials = [];
    const socialPlatforms = {
        Facebook: { icon: "fa-brands fa-facebook", title: "Facebook" },
        Instagram: { icon: "fa-brands fa-instagram", title: "Instagram" },
        Bluesky: { icon: "fa-brands fa-bluesky", title: "Bluesky" },
        Tiktok: { icon: "fa-brands fa-tiktok", title: "TikTok" },
        Twitter: { icon: "fa-brands fa-twitter", title: "Twitter" },
        Youtube: { icon: "fa-brands fa-youtube", title: "YouTube" },
        Website: { icon: "fa-solid fa-globe", title: "Website" },
    };

    socials.push(
        `<a href="${createMapLink(venue)}" target="_blank" title="View on Google Maps"><i class="fas fa-map-marker-alt"></i></a>`
    );

    for (const [platform, info] of Object.entries(socialPlatforms)) {
        if (venue.socials[platform]) {
            socials.push(
                `<a href="${venue.socials[platform]}" target="_blank" title="${info.title}"><i class="${info.icon}"></i></a>`
            );
        }
    }

    return `<div class="social-links">${socials.join("")}</div>`;
}

// ======================
// DOM RENDERING
// ======================
function renderWeek() {
    const weekDisplay = document.getElementById("week-display");
    const container = document.getElementById("schedule-container");

    weekDisplay.textContent = formatWeekRange(currentWeekStart);
    container.innerHTML = "";

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i);
        const isCurrentDay = isToday(currentDate);

        const venuesToday = karaokeData.listings
            .map((venue) => {
                const { hasEvent, timeInfo } = hasKaraokeOnDate(venue, currentDate);
                return hasEvent ? { ...venue, timeInfo } : null;
            })
            .filter((venue) => venue && (showDedicated || !venue.Dedicated))
            .sort((a, b) => a.VenueName.localeCompare(b.VenueName));

        const dayHTML = `
            
                <div class="day-header ${isCurrentDay ? "today" : ""}">
                    <span>${currentDate.toLocaleDateString("en-US", { weekday: "long" })}</span>
                    <span class="date-number ${isCurrentDay ? "today" : ""}">
                        ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                </div>
                <div class="day-card">
                <div class="venue-list">
                    ${
                        venuesToday.length > 0
                            ? venuesToday
                                .map(
                                    (venue) => `
                                    <div class="venue-item">
                                        <div class="venue-name">${venue.VenueName}</div>
                                        <div class="venue-kj">${venue.KJ.Company ? `${venue.KJ.Company}<br>` : ""}${venue.KJ.Host ? ` with ${venue.KJ.Host}` : ""}</div>
                                        <div class="venue-time">${venue.timeInfo.time}${venue.timeInfo.description ? ` <span class="time-description"><br>(${venue.timeInfo.description})</span>` : ""}</div>
                                        <div class="venue-address"><a href="${createMapLink(venue)}" target="_blank" title="View on Google Maps">${formatAddress(venue)}</a></div>
                                        <button class="details-btn" onclick="showVenueDetails(${JSON.stringify(venue).replace(/"/g, '&quot;')})">
                                            See Details
                                        </button>
                                    </div>
                                `
                                )
                                .join("")
                            : '<div class="no-events">No karaoke venues scheduled</div>'
                    }
                </div>
            </div>
        `;

        container.insertAdjacentHTML("beforeend", dayHTML);
    }
}

// ======================
// EVENT LISTENERS
// ======================
function setupEventListeners() {
    const backToTopButton = document.getElementById("backToTop");
    
    window.addEventListener("scroll", function() {
        backToTopButton.classList.toggle("visible", window.pageYOffset > 300);
    });

    backToTopButton.addEventListener("click", function() {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
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

    document.getElementById("dedicated-toggle").addEventListener("change", function() {
        showDedicated = this.checked;
        renderWeek();
    });

    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('venue-modal');
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
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