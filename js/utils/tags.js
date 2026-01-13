/**
 * Tag configuration and rendering utilities
 * Tags provide "vibe" information about venues
 * Configuration is loaded from data.js at runtime
 */

// Tag configuration - initialized from data.js
let tagConfig = {};

/**
 * Initialize tag configuration from data
 * @param {Object} definitions - Tag definitions from karaokeData.tagDefinitions
 */
export function initTagConfig(definitions) {
    tagConfig = definitions || {};
}

/**
 * Render tags as HTML badges
 * @param {string[]} tags - Array of tag IDs
 * @returns {string} HTML string of tag badges
 */
export function renderTags(tags) {
    if (!tags || tags.length === 0) return '';

    const badges = tags.map(tag => {
        const config = tagConfig[tag];
        if (!config) return '';

        return `<span class="venue-tag" style="background-color: ${config.color}; color: ${config.textColor};">${config.label}</span>`;
    }).filter(Boolean).join('');

    return badges ? `<div class="venue-tags">${badges}</div>` : '';
}

/**
 * Get tag configuration by ID
 * @param {string} tagId - Tag identifier
 * @returns {Object|null} Tag configuration or null if not found
 */
export function getTagConfig(tagId) {
    return tagConfig[tagId] || null;
}
