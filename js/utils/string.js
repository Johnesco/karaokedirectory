/**
 * String manipulation utilities
 */

// Articles to ignore when sorting names
const ARTICLES = ['the', 'a', 'an'];

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to title case
 * @param {string} str - String to convert
 * @returns {string} Title cased string
 */
export function titleCase(str) {
    if (!str) return '';
    return str.split(' ').map(capitalize).join(' ');
}

/**
 * Get sortable name (moves articles like "The" to end)
 * @param {string} name - Name to process
 * @returns {string} Sortable name
 */
export function getSortableName(name) {
    if (!name) return '';
    const words = name.trim().split(/\s+/);
    if (words.length > 1 && ARTICLES.includes(words[0].toLowerCase())) {
        return `${words.slice(1).join(' ')}, ${words[0]}`;
    }
    return name;
}

/**
 * Convert string to URL-safe slug
 * @param {string} str - String to slugify
 * @returns {string} Slugified string
 */
export function slugify(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')  // Remove non-word chars
        .replace(/\s+/g, '-')       // Replace spaces with hyphens
        .replace(/-+/g, '-');       // Remove duplicate hyphens
}

/**
 * Truncate string to specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength) {
    if (!str || str.length <= maxLength) return str || '';
    return str.slice(0, maxLength - 3) + '...';
}

/**
 * Check if string contains search term (case-insensitive)
 * @param {string} str - String to search in
 * @param {string} search - Search term
 * @returns {boolean} True if found
 */
export function containsIgnoreCase(str, search) {
    if (!str || !search) return false;
    return str.toLowerCase().includes(search.toLowerCase());
}

/**
 * Highlight search term in string with <mark> tags
 * @param {string} str - String to highlight in
 * @param {string} search - Search term
 * @returns {string} HTML string with highlights
 */
export function highlightSearch(str, search) {
    if (!str || !search) return escapeHtml(str);
    const escaped = escapeHtml(str);
    const regex = new RegExp(`(${escapeRegex(search)})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
}

/**
 * Escape special regex characters in string
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for regex
 */
export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format phone number to (XXX) XXX-XXXX
 * @param {string} phone - Phone number string
 * @returns {string} Formatted phone number
 */
export function formatPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
}

/**
 * Strip HTML tags from string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}
