/**
 * Tag configuration and rendering utilities
 * Tags provide descriptive information about venue characteristics (type, policies, amenities)
 * Configuration is loaded from js/data.json at runtime
 */

import { html } from './string.js';

// Tag configuration - initialized from js/data.json
let tagConfig = {};

/**
 * Initialize tag configuration from data
 * @param {Object} definitions - Tag definitions from the data file's tagDefinitions
 */
export function initTagConfig(definitions) {
    tagConfig = definitions || {};
}

/**
 * Render tags as HTML badges
 * @param {string[]} tags - Array of tag IDs
 * @param {Object} options - Render options
 * @param {boolean} options.dedicated - Whether to include the dedicated tag
 * @returns {string} HTML string of tag badges
 */
export function renderTags(tags, options = {}) {
    const { dedicated = false } = options;

    // Build the full tag list, prepending 'dedicated' if applicable
    const allTags = dedicated ? ['dedicated', ...(tags || [])] : (tags || []);

    if (allTags.length === 0) return '';

    // The `html` tag escapes every interpolation, including the colours and the
    // label — all three come from data.json's tagDefinitions, which the curator
    // writes, and the colours land inside a style attribute (#160).
    const badges = allTags.map(tag => {
        const config = tagConfig[tag];
        if (!config) return '';

        return String(html`<span class="venue-tag" style="background-color: ${config.color}; color: ${config.textColor};">${config.label}</span>`);
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
