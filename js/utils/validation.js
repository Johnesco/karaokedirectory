/**
 * Data validation utilities
 */

/**
 * Validate venue data against schema
 * @param {Object} venue - Venue object to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateVenue(venue) {
    const errors = [];

    // Required fields
    if (!venue.id) {
        errors.push('Venue ID is required');
    } else if (!/^[a-z0-9-]+$/.test(venue.id)) {
        errors.push('Venue ID must contain only lowercase letters, numbers, and hyphens');
    }

    if (!venue.name) {
        errors.push('Venue name is required');
    }

    // Address validation
    if (!venue.address) {
        errors.push('Address is required');
    } else {
        if (!venue.address.street) errors.push('Street address is required');
        if (!venue.address.city) errors.push('City is required');
        if (!venue.address.state) errors.push('State is required');
        if (venue.address.zip && !/^\d{5}(-\d{4})?$/.test(venue.address.zip)) {
            errors.push('Invalid ZIP code format');
        }
    }

    // Schedule validation
    if (!venue.schedule || !Array.isArray(venue.schedule)) {
        errors.push('Schedule is required and must be an array');
    } else if (venue.schedule.length === 0) {
        errors.push('At least one schedule entry is required');
    } else {
        venue.schedule.forEach((entry, i) => {
            const scheduleErrors = validateScheduleEntry(entry);
            scheduleErrors.forEach(err => errors.push(`Schedule ${i + 1}: ${err}`));
        });
    }

    // Coordinates validation (optional but if present, must be valid)
    if (venue.coordinates) {
        if (typeof venue.coordinates.lat !== 'number' || venue.coordinates.lat < -90 || venue.coordinates.lat > 90) {
            errors.push('Invalid latitude (must be between -90 and 90)');
        }
        if (typeof venue.coordinates.lng !== 'number' || venue.coordinates.lng < -180 || venue.coordinates.lng > 180) {
            errors.push('Invalid longitude (must be between -180 and 180)');
        }
    }

    // Date range validation
    if (venue.dateRange) {
        if (venue.dateRange.start && !isValidDateString(venue.dateRange.start)) {
            errors.push('Invalid start date format (use YYYY-MM-DD)');
        }
        if (venue.dateRange.end && !isValidDateString(venue.dateRange.end)) {
            errors.push('Invalid end date format (use YYYY-MM-DD)');
        }
        if (venue.dateRange.start && venue.dateRange.end) {
            if (new Date(venue.dateRange.start) > new Date(venue.dateRange.end)) {
                errors.push('Start date must be before end date');
            }
        }
    }

    // Socials validation
    if (venue.socials) {
        Object.entries(venue.socials).forEach(([platform, url]) => {
            if (url && !isValidUrl(url)) {
                errors.push(`Invalid URL for ${platform}`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate a schedule entry
 * @param {Object} entry - Schedule entry
 * @returns {string[]} Array of error messages
 */
export function validateScheduleEntry(entry) {
    const errors = [];
    const validFrequencies = ['every', 'first', 'second', 'third', 'fourth', 'fifth', 'last'];
    const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    if (!entry.frequency) {
        errors.push('Frequency is required');
    } else if (!validFrequencies.includes(entry.frequency.toLowerCase())) {
        errors.push(`Invalid frequency "${entry.frequency}". Must be one of: ${validFrequencies.join(', ')}`);
    }

    if (!entry.day) {
        errors.push('Day is required');
    } else if (!validDays.includes(entry.day.toLowerCase())) {
        errors.push(`Invalid day "${entry.day}". Must be one of: ${validDays.join(', ')}`);
    }

    if (!entry.startTime) {
        errors.push('Start time is required');
    } else if (!isValidTime24(entry.startTime)) {
        errors.push('Invalid start time format (use HH:MM in 24-hour format)');
    }

    // End time is optional (null means "close")
    if (entry.endTime !== null && entry.endTime !== undefined && !isValidTime24(entry.endTime)) {
        errors.push('Invalid end time format (use HH:MM in 24-hour format or null for "close")');
    }

    return errors;
}

/**
 * Check if string is valid URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export function isValidUrl(url) {
    if (!url) return false;
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

/**
 * Check if string is valid date (YYYY-MM-DD)
 * @param {string} dateStr - Date string
 * @returns {boolean} True if valid
 */
export function isValidDateString(dateStr) {
    if (!dateStr) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}

/**
 * Check if string is valid 24-hour time (HH:MM)
 * @param {string} timeStr - Time string
 * @returns {boolean} True if valid
 */
export function isValidTime24(timeStr) {
    if (!timeStr) return false;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Check if string is valid phone number
 * @param {string} phone - Phone number
 * @returns {boolean} True if valid
 */
export function isValidPhone(phone) {
    if (!phone) return true; // Optional field
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || (digits.length === 11 && digits[0] === '1');
}

/**
 * Check if string is valid ZIP code
 * @param {string} zip - ZIP code
 * @returns {boolean} True if valid
 */
export function isValidZip(zip) {
    if (!zip) return true; // Optional field
    return /^\d{5}(-\d{4})?$/.test(zip);
}

/**
 * Sanitize venue data (trim strings, normalize values)
 * @param {Object} venue - Venue object
 * @returns {Object} Sanitized venue
 */
export function sanitizeVenue(venue) {
    const sanitized = { ...venue };

    // Trim string fields
    if (sanitized.name) sanitized.name = sanitized.name.trim();
    if (sanitized.id) sanitized.id = sanitized.id.trim().toLowerCase();
    if (sanitized.phone) sanitized.phone = sanitized.phone.trim();
    if (sanitized.description) sanitized.description = sanitized.description.trim();

    // Sanitize address
    if (sanitized.address) {
        sanitized.address = {
            street: sanitized.address.street?.trim() || '',
            city: sanitized.address.city?.trim() || '',
            state: sanitized.address.state?.trim().toUpperCase() || '',
            zip: sanitized.address.zip?.trim() || '',
            neighborhood: sanitized.address.neighborhood?.trim() || ''
        };
    }

    // Normalize schedule days to lowercase
    if (sanitized.schedule) {
        sanitized.schedule = sanitized.schedule.map(entry => ({
            ...entry,
            frequency: entry.frequency?.toLowerCase(),
            day: entry.day?.toLowerCase()
        }));
    }

    // Remove empty social links
    if (sanitized.socials) {
        sanitized.socials = Object.fromEntries(
            Object.entries(sanitized.socials).filter(([, url]) => url)
        );
    }

    return sanitized;
}
