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
  <div class="modal-kj">
      ${venue.KJ.Company ? `<strong><div class="venue-kj">${venue.KJ.Company}</strong><br>` : ""}
      ${venue.KJ.Host ? `<strong>KJ:</strong> ${venue.KJ.Host}` : ""}
      ${venue.KJ.Website ? `<br><a href="${venue.KJ.Website}">${venue.KJ.Website}</a>` : ""}
      </div>
      
    </div>
    <div class="modal-address">
      <strong>Address:</strong><br>
      <div class="venue-address"><a href="${createMapLink(venue)}" target="_blank" title="View on Google Maps">${formatAddress(venue)}</a></div>
    </div>
    
    
    <div class="modal-schedule">
      <strong>Schedule:</strong>`;
  
  /* const weeklyDays = Object.entries(venue.schedule.weekly);
  if (weeklyDays.length > 0) {
    infoHTML += `<h4>Weekly:</h4><ul>`;
    weeklyDays.forEach(([day, time]) => {
      infoHTML += `<li class="modal-schedule-item">Every ${day}: ${time}</li>`;
    });
    infoHTML += `</ul>`;
  }
  */
  if (venue.schedule.length > 0) {
    infoHTML += `<ul>`;
    
    venue.schedule.forEach(event => {
    let cadence = capitalizeFirstLetter(event.day[0]);
    let weekday = event.day[1];
     
    //Pluarize day if it's every weekday
    if (event.day[0] != "every")
        {weekday = weekday + "s";}

    infoHTML += `<li class="modal-schedule-item">${cadence} ${weekday}: ${event.time}</li>`;
    });
    infoHTML += `</ul>`;
  }
  
  venueInfo.innerHTML = infoHTML + `<strong>Venue Social Media:</strong><br>${createSocialLinks(venue)}</div></div>`;
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
    
    if (ordinal === "every"){
        return true;
    }

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


    for (const ordinalEvent of venue.schedule) {
        const [ordinal, ordinalDay] = ordinalEvent.day;
        if (ordinalEvent.description === undefined)
        {
            ordinalEvent.description = capitalizeFirstLetter(ordinalEvent.day[0]) + " " + ordinalEvent.day[1];
        }
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

function capitalizeFirstLetter(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
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
    updateWeekDisplay();
    clearContainer();
    renderAllDays();
}

function updateWeekDisplay() {
    const weekDisplay = document.getElementById("week-display");
    weekDisplay.textContent = formatWeekRange(currentWeekStart);
}

function clearContainer() {
    const container = document.getElementById("schedule-container");
    container.innerHTML = "";
}

function renderAllDays() {
    for (let i = 0; i < 7; i++) {
        const currentDate = getCurrentDate(i);
        const venuesToday = getVenuesForDate(currentDate);
        const dayHTML = createDayHTML(currentDate, venuesToday);
        appendDayToContainer(dayHTML);
    }
}

function getCurrentDate(dayOffset) {
    const currentDate = new Date(currentWeekStart);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    return currentDate;
}

function getVenuesForDate(date) {
    // Helper function to ignore articles for sorting
    function getSortableName(venueName) {
        const articles = ['the ', 'a ', 'an ','la ', 'el ', 'le '];
        const lowerName = venueName.toLowerCase();
        
        for (const article of articles) {
            if (lowerName.startsWith(article)) {
                return venueName.slice(article.length);
            }
        }
        return venueName;
    }

    return karaokeData.listings
        .map(venue => getVenueWithEventInfo(venue, date))
        .filter(venue => venue && (showDedicated || !venue.Dedicated))
        .sort((a, b) => {
            const nameA = getSortableName(a.VenueName);
            const nameB = getSortableName(b.VenueName);
            return nameA.localeCompare(nameB);
        });
}

function getVenueWithEventInfo(venue, date) {
    const { hasEvent, timeInfo } = hasKaraokeOnDate(venue, date);
    return hasEvent ? { ...venue, timeInfo } : null;
}

function createDayHTML(date, venues) {
    const isCurrentDay = isToday(date);
    return `
        <div class="day-header ${isCurrentDay ? "today" : ""}">
            ${createDayHeaderContent(date, isCurrentDay)}
        </div>
        <div class="day-card">
            <div class="venue-list">
                ${venues.length > 0 ? createVenuesList(venues) : createNoEventsMessage()}
            </div>
        </div>
    `;
}

function createDayHeaderContent(date, isCurrentDay) {
    return `
        <span>${date.toLocaleDateString("en-US", { weekday: "long" })}</span>
        <span class="date-number ${isCurrentDay ? "today" : ""}">
            ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
    `;
}

function createVenuesList(venues) {
    return venues.map(venue => createVenueItem(venue)).join("");
}

function createNoEventsMessage() {
    return '<div class="no-events">No karaoke venues scheduled</div>';
}

function createVenueItem(venue) {
    return `
        <div class="venue-item">
            <div class="venue-name">${venue.VenueName}</div>
            <div class="venue-kj">${createKJInfo(venue.KJ)}</div>
            <div class="venue-time">${createTimeInfo(venue.timeInfo)}</div>
            <div class="venue-address">${createAddressLink(venue)}</div>
            ${createDetailsButton(venue)}
        </div>
    `;
}

function createKJInfo(kj) {
    return `${kj.Company ? `${kj.Company}<br>` : ""}${kj.Host ? ` with ${kj.Host}` : ""}`;
}

function createTimeInfo(timeInfo) {
    return `${timeInfo.time}${
        timeInfo.description ? ` <span class="time-description"><br>(${timeInfo.description})</span>` : ""
    }`;
}

function createAddressLink(venue) {
    return `<a href="${createMapLink(venue)}" target="_blank" title="View on Google Maps">${formatAddress(venue)}</a>`;
}

function createDetailsButton(venue) {
    return `
        <button class="details-btn" onclick="showVenueDetails(${JSON.stringify(venue).replace(/"/g, '&quot;')})">
            See Details
        </button>
    `;
}

function appendDayToContainer(html) {
    const container = document.getElementById("schedule-container");
    container.insertAdjacentHTML("beforeend", html);
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