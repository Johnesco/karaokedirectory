import { SOCIAL_PLATFORMS } from './constants.js';
import { escapeHtml, sanitizeUrl } from './stringUtils.js';

/**
 * Creates a Google Maps search link for a venue address.
 */
export const createMapLink = (venue) => {
    const address = `${venue.VenueName} ${venue.Address.Street}, ${venue.Address.City} ${venue.Address.State} ${venue.Address.Zip}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
};

/**
 * Generates HTML for social media links of a venue or KJ.
 */
export const createSocialLinks = (item) => {
    const socialsObj = item.socials || item;
    const links = [];

    if (item.Address) {
        links.push(`
            <a href="${escapeHtml(createMapLink(item))}" target="_blank" rel="noopener noreferrer" title="View on Google Maps">
                <i class="fas fa-map-marker-alt"></i>
            </a>
        `);
    }

    for (const [platform, info] of Object.entries(SOCIAL_PLATFORMS)) {
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
};