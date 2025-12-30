import { getDayName, formatDateShort, isCurrentDay } from './dateUtils.js';
import { escapeHtml } from './stringUtils.js';
import { createMapLink, createSocialLinks } from './socialUtils.js';
import { clearScheduleContainer, appendDayToContainer } from './domUtils.js';

/**
 * Creates HTML string for a list of venues on a given day.
 */
const createVenuesList = (venues) =>
    venues.map(venue => `
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

/**
 * Creates HTML string for a single day card including all venues.
 */
const createDayHTML = (date, venues) => `
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

/**
 * Renders the current week's schedule in the DOM.
 */
export const renderWeek = (karaokeData, currentWeekStart, showDedicated, getVenuesForDate) => {
    clearScheduleContainer();
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        const venues = getVenuesForDate(karaokeData, date, showDedicated);
        appendDayToContainer(createDayHTML(date, venues));
    }
};