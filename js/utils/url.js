/**
 * URL building and sanitization utilities
 */

// Social media platform configurations
// Note: 'icon' should be full class including prefix (fa-brands or fa-solid)
export const SOCIAL_PLATFORMS = {
    website: { icon: 'fa-solid fa-globe', label: 'Website', cssClass: 'social-website' },
    facebook: { icon: 'fa-brands fa-facebook', label: 'Facebook', cssClass: 'social-facebook' },
    instagram: { icon: 'fa-brands fa-instagram', label: 'Instagram', cssClass: 'social-instagram' },
    twitter: { icon: 'fa-brands fa-x-twitter', label: 'X/Twitter', cssClass: 'social-twitter' },
    tiktok: { icon: 'fa-brands fa-tiktok', label: 'TikTok', cssClass: 'social-tiktok' },
    youtube: { icon: 'fa-brands fa-youtube', label: 'YouTube', cssClass: 'social-youtube' },
    bluesky: { icon: 'fa-solid fa-cloud', label: 'Bluesky', cssClass: 'social-bluesky' }
};

/**
 * Sanitize and validate URL
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return null;

    const trimmed = url.trim();
    if (!trimmed) return null;

    // Block javascript: and data: URLs
    if (/^(javascript|data):/i.test(trimmed)) {
        return null;
    }

    // Add https:// if no protocol
    if (!/^https?:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }

    try {
        new URL(trimmed);
        return trimmed;
    } catch {
        return null;
    }
}

/**
 * Build Google Maps URL for an address
 * @param {Object} address - Address object
 * @param {string} [venueName] - Optional venue name to include in search
 * @returns {string} Google Maps URL
 */
export function buildMapUrl(address, venueName = '') {
    if (!address) return '#';

    const addressParts = [
        address.street,
        address.city,
        address.state,
        address.zip
    ].filter(Boolean);

    const searchParts = venueName
        ? [venueName, ...addressParts]
        : addressParts;

    const query = encodeURIComponent(searchParts.join(' '));
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Build Google Maps directions URL
 * @param {Object} address - Address object
 * @param {string} [venueName] - Optional venue name to include in destination
 * @returns {string} Google Maps directions URL
 */
export function buildDirectionsUrl(address, venueName = '') {
    if (!address) return '#';

    const addressParts = [
        address.street,
        address.city,
        address.state,
        address.zip
    ].filter(Boolean);

    const destParts = venueName
        ? [venueName, ...addressParts]
        : addressParts;

    const destination = encodeURIComponent(destParts.join(' '));
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

/**
 * Generate social media link HTML
 * @param {string} platform - Platform key (facebook, instagram, etc.)
 * @param {string} url - Profile URL
 * @param {Object} [options] - Options
 * @param {boolean} [options.showLabel] - Show platform label
 * @param {string} [options.size] - Icon size class (fa-lg, fa-2x, etc.)
 * @returns {string} HTML anchor tag
 */
export function createSocialLink(platform, url, options = {}) {
    const sanitized = sanitizeUrl(url);
    if (!sanitized) return '';

    const config = SOCIAL_PLATFORMS[platform.toLowerCase()];
    if (!config) return '';

    const { showLabel = false, size = '' } = options;
    const sizeClass = size ? ` ${size}` : '';
    const label = showLabel ? ` ${config.label}` : '';

    return `<a href="${sanitized}" target="_blank" rel="noopener noreferrer"
            class="social-link ${config.cssClass}"
            title="${config.label}">
            <i class="${config.icon}${sizeClass}"></i>${label}
        </a>`;
}

/**
 * Generate all social links for a venue/host
 * @param {Object} socials - Object with platform:url pairs
 * @param {Object} [options] - Options passed to createSocialLink
 * @returns {string} HTML string of all social links
 */
export function createSocialLinks(socials, options = {}) {
    if (!socials || typeof socials !== 'object') return '';

    const links = Object.entries(socials)
        .filter(([, url]) => url)
        .map(([platform, url]) => createSocialLink(platform, url, options))
        .filter(Boolean);

    return links.join('');
}

/**
 * Format full address as string
 * @param {Object} address - Address object
 * @param {boolean} [multiline=false] - Use line breaks
 * @returns {string} Formatted address
 */
export function formatAddress(address, multiline = false) {
    if (!address) return '';

    const { street, city, state, zip } = address;
    const separator = multiline ? '<br>' : ', ';

    const cityStateZip = [city, state].filter(Boolean).join(', ') +
        (zip ? ` ${zip}` : '');

    return [street, cityStateZip].filter(Boolean).join(separator);
}

/**
 * Parse hash parameters from URL
 * @returns {Object} Key-value pairs from hash
 */
export function getHashParams() {
    const hash = window.location.hash.slice(1);
    if (!hash) return {};

    const params = {};
    for (const part of hash.split('&')) {
        const [key, value] = part.split('=');
        if (key) {
            params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : true;
        }
    }
    return params;
}

/**
 * Set hash parameters in URL
 * @param {Object} params - Key-value pairs to set
 */
export function setHashParams(params) {
    const parts = Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => {
            if (v === true) return encodeURIComponent(k);
            return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        });

    window.location.hash = parts.join('&');
}

/**
 * Update specific hash parameters (preserving others)
 * @param {Object} updates - Parameters to update
 */
export function updateHashParams(updates) {
    const current = getHashParams();
    setHashParams({ ...current, ...updates });
}

/**
 * Share a venue link via Web Share API (mobile) or clipboard copy (desktop)
 * @param {Object} venue - Venue object with id and name
 * @param {HTMLElement} [buttonEl] - Button element for "Copied!" feedback
 */
export async function shareVenue(venue, buttonEl) {
    const url = `${window.location.origin}${window.location.pathname}#view=weekly&venue=${venue.id}`;

    if (navigator.share) {
        try {
            await navigator.share({ title: venue.name, url });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return; // user cancelled
        }
    }

    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(url);
    if (buttonEl) {
        const originalHTML = buttonEl.innerHTML;
        buttonEl.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => { buttonEl.innerHTML = originalHTML; }, 2000);
    }
}
