import { ARTICLES } from './constants.js';

/**
 * Escapes special HTML characters in a string to prevent XSS.
 */
export const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

/**
 * Sanitizes a URL string to ensure it uses http or https protocol.
 */
export const sanitizeUrl = (url) => {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch {
        return '';
    }
};

/**
 * Capitalizes the first letter of a string.
 */
export const capitalizeFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Returns a sortable version of a venue name by removing leading articles.
 */
export const getSortableName = (name) => {
    const lowerName = name.toLowerCase();
    const article = ARTICLES.find(a => lowerName.startsWith(a));
    return article ? name.slice(article.length) : name;
};