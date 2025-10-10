import { escapeHtml } from './stringUtils.js';
import { createMapLink, createSocialLinks } from './socialUtils.js';
import { createScheduleList } from './domUtils.js';
import { clearScheduleContainer, appendDayToContainer } from './domUtils.js';

/**
 * Creates HTML string for a single venue card with all information.
 */
const createVenueHTML = (venue) => `
    <div class="day-card">
        <div class="day-header">
            <span>${escapeHtml(venue.VenueName)}</span>
            ${venue.Dedicated ? '<span class="date-number">Dedicated Venue</span>' : ''}
        </div>
        <div class="venue-list">
            <div class="venue-item">
                <div class="venue-address">
                    <strong>Address:</strong><br>
                    <a href="${escapeHtml(createMapLink(venue))}" target="_blank" rel="noopener noreferrer" title="View on Google Maps">
                        ${escapeHtml(venue.Address.Street)}<br>
                        ${escapeHtml(venue.Address.City)} ${escapeHtml(venue.Address.State)}, ${escapeHtml(venue.Address.Zip)}
                    </a>
                </div>
                
                <div class="venue-time">
                    <strong>Schedule:</strong>
                    ${createScheduleList(venue.schedule)}
                </div>
                
                <div class="venue-kj">
                    <strong>Karaoke Host:</strong><br>
                    ${venue.KJ.Company ? `<strong>Company: </strong>${escapeHtml(venue.KJ.Company)}<br>` : ''}
                    ${venue.KJ.Host ? `<strong>KJ: </strong>${escapeHtml(venue.KJ.Host)}<br>` : ''}
                    ${venue.KJ.Website ? `<strong>Website: </strong><a href="${escapeHtml(sanitizeUrl(venue.KJ.Website))}" target="_blank" rel="noopener noreferrer">${escapeHtml(venue.KJ.Website)}</a><br>` : ''}
                </div>
                
                <div>
                    <strong>Venue Social Media:</strong><br>
                    ${createSocialLinks(venue)}
                </div>
                
                ${venue.KJ.KJsocials ? `
                    <div style="margin-top: 10px;">
                        <strong>KJ Social Media:</strong><br>
                        ${createSocialLinks({ socials: venue.KJ.KJsocials })}
                    </div>
                ` : ''}
            </div>
        </div>
    </div>
`;

/**
 * Renders all venues in alphabetical order in the DOM.
 */
export const renderAllVenues = (karaokeData, showDedicated, getAllVenues) => {
    clearScheduleContainer();
    
    const venues = getAllVenues(karaokeData, showDedicated);
    
    if (venues.length === 0) {
        appendDayToContainer(`
            <div class="day-card">
                <div class="day-header">
                    <span>No Venues Found</span>
                </div>
                <div class="venue-list">
                    <div class="venue-item">
                        <div class="no-events">No venues found matching your criteria.</div>
                    </div>
                </div>
            </div>
        `);
        return;
    }
    
    venues.forEach(venue => {
        appendDayToContainer(createVenueHTML(venue));
    });
};