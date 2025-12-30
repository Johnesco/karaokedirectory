import { escapeHtml, sanitizeUrl } from './stringUtils.js';
import { createMapLink, createSocialLinks } from './socialUtils.js';
import { createScheduleList } from './domUtils.js';

/**
 * Builds the modal content HTML for a venue.
 */
const createModalContent = (venue) => `
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

/**
 * Shows the venue details modal populated with data.
 */
export const showVenueDetails = (venue) => {
    const modal = document.getElementById("venue-modal");
    const venueNameElem = document.getElementById("modal-venue-name");
    const venueInfoElem = document.getElementById("modal-venue-info");

    venueNameElem.textContent = venue.VenueName;
    venueInfoElem.innerHTML = createModalContent(venue);

    modal.style.display = "block";
};