/**
 * Date manipulation utilities
 */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'last'];

/**
 * Get day name from date
 * @param {Date} date - Date object
 * @returns {string} Lowercase day name
 */
export function getDayName(date) {
    return WEEKDAYS[date.getDay()];
}

/**
 * Get display day name (capitalized)
 * @param {Date} date - Date object
 * @returns {string} Capitalized day name
 */
export function getDayDisplayName(date) {
    return WEEKDAY_NAMES[date.getDay()];
}

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if today
 */
export function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

/**
 * Format date as short string (Mon 12/25)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDateShort(date) {
    const day = WEEKDAY_NAMES[date.getDay()].slice(0, 3);
    const month = date.getMonth() + 1;
    const dayNum = date.getDate();
    return `${day} ${month}/${dayNum}`;
}

/**
 * Format date as full string (Monday, December 25, 2025)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDateFull(date) {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format week range (Dec 23 - Dec 29, 2025)
 * @param {Date} startDate - Start of week
 * @returns {string} Formatted range
 */
export function formatWeekRange(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const year = endDate.getFullYear();

    if (startMonth === endMonth) {
        return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}, ${year}`;
    }
    return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${year}`;
}

/**
 * Get dates for a week starting from given date
 * @param {Date} startDate - Start date
 * @returns {Date[]} Array of 7 dates
 */
export function getWeekDates(startDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push(date);
    }
    return dates;
}

/**
 * Get start of week (Sunday) for a date
 * @param {Date} date - Any date
 * @returns {Date} Sunday of that week
 */
export function getWeekStart(date) {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Check if a schedule matches a specific date
 * Handles "every", "first", "second", etc. patterns
 * @param {Object} schedule - Schedule object with frequency and day
 * @param {Date} date - Date to check
 * @returns {boolean} True if schedule applies to date
 */
export function scheduleMatchesDate(schedule, date) {
    const { frequency, day } = schedule;

    // One-time special event: compare exact date string
    if (frequency === 'once') {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return schedule.date === `${y}-${m}-${d}`;
    }

    // Check if day of week matches
    if (getDayName(date) !== day.toLowerCase()) {
        return false;
    }

    // "every" matches all occurrences
    if (frequency === 'every') {
        return true;
    }

    // Calculate which occurrence of this day in the month
    const dayOfMonth = date.getDate();
    const occurrence = Math.ceil(dayOfMonth / 7);

    // Handle "last" specially
    if (frequency === 'last') {
        const nextWeek = new Date(date);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.getMonth() !== date.getMonth();
    }

    // Check ordinal occurrence (first, second, third, fourth, fifth)
    const ordinalIndex = ORDINALS.indexOf(frequency);
    if (ordinalIndex >= 0 && ordinalIndex < 5) {
        return occurrence === ordinalIndex + 1;
    }

    return false;
}

/**
 * Convert 24-hour time to 12-hour format
 * @param {string} time24 - Time in 24-hour format (e.g., "21:00")
 * @returns {string} Time in 12-hour format (e.g., "9:00 PM")
 */
export function formatTime12(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Convert 12-hour time to 24-hour format
 * @param {string} time12 - Time in 12-hour format (e.g., "9:00 PM")
 * @returns {string} Time in 24-hour format (e.g., "21:00")
 */
export function formatTime24(time12) {
    if (!time12) return '';
    const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return time12;

    let [, hours, minutes, period] = match;
    hours = parseInt(hours, 10);

    if (period.toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

/**
 * Format schedule time range for display
 * @param {string} startTime - Start time in 24-hour format
 * @param {string|null} endTime - End time in 24-hour format (null = "Close")
 * @returns {string} Formatted time range
 */
export function formatTimeRange(startTime, endTime) {
    const start = formatTime12(startTime);
    const end = endTime ? formatTime12(endTime) : 'Close';
    return `${start} - ${end}`;
}

/**
 * Check if a date is within a range
 * @param {Date} date - Date to check
 * @param {string|null} startDate - Start date ISO string
 * @param {string|null} endDate - End date ISO string
 * @returns {boolean} True if date is in range
 */
export function isDateInRange(date, startDate, endDate) {
    const checkDate = new Date(date).setHours(0, 0, 0, 0);

    if (startDate) {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        if (checkDate < start) return false;
    }

    if (endDate) {
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (checkDate > end) return false;
    }

    return true;
}

/**
 * Format a schedule entry for display
 * Returns an object with formatted day, frequency prefix, and time
 * @param {Object} entry - Schedule entry with day, frequency, startTime, endTime
 * @param {Object} options - Formatting options
 * @param {boolean} options.showEvery - Whether to show "Every" prefix (default: true)
 * @returns {Object} Formatted schedule parts { day, frequencyPrefix, time, fullText }
 */
export function formatScheduleEntry(entry, options = {}) {
    const { showEvery = true } = options;

    // One-time special event
    if (entry.frequency === 'once') {
        const dateObj = new Date(entry.date + 'T12:00:00');
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const time = formatTimeRange(entry.startTime, entry.endTime);
        const label = entry.eventName ? `${entry.eventName} — ${dateStr}` : `Special Event — ${dateStr}`;
        return { day: dateStr, frequencyPrefix: entry.eventName || 'Special Event', time, fullText: `${label}: ${time}` };
    }

    // Capitalize day name
    const day = entry.day.charAt(0).toUpperCase() + entry.day.slice(1);

    // Format frequency prefix
    let frequencyPrefix = '';
    if (entry.frequency === 'every') {
        frequencyPrefix = showEvery ? 'Every ' : '';
    } else {
        frequencyPrefix = entry.frequency.charAt(0).toUpperCase() + entry.frequency.slice(1) + ' ';
    }

    // Format time range
    const time = formatTimeRange(entry.startTime, entry.endTime);

    // Build full display text
    const fullText = `${frequencyPrefix}${day}: ${time}`;

    return { day, frequencyPrefix, time, fullText };
}

/**
 * Format an active period for display
 * @param {Object} activePeriod - Object with start and/or end date strings
 * @returns {string} Formatted active period text, or empty string if no period
 */
export function formatActivePeriodText(activePeriod) {
    if (!activePeriod) return '';

    const { start, end } = activePeriod;

    if (start && end) {
        return `Active ${start} to ${end}`;
    } else if (start) {
        return `Active from ${start}`;
    } else if (end) {
        return `Active until ${end}`;
    }

    return '';
}

/**
 * Get date range for next week (7 days after current week ends)
 * @param {Date} weekStart - Start of current week (Sunday)
 * @returns {{ start: Date, end: Date }} Start and end dates for next week
 */
export function getNextWeekRange(weekStart) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + 7); // Start of next week
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6); // End of next week
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

/**
 * Get date range for remaining days in current month after a given date
 * @param {Date} afterDate - Start searching after this date
 * @returns {{ start: Date, end: Date } | null} Start and end dates, or null if no days remaining
 */
export function getThisMonthRange(afterDate) {
    const start = new Date(afterDate);
    start.setDate(start.getDate() + 1); // Day after the given date
    start.setHours(0, 0, 0, 0);

    // End of current month
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    // If start is past end of month, no days remaining
    if (start > end) {
        return null;
    }

    return { start, end };
}

/**
 * Get date range for next calendar month (capped at maxDays from today)
 * @param {Date} today - Reference date (today)
 * @param {number} maxDays - Maximum days to look ahead (default 60)
 * @returns {{ start: Date, end: Date } | null} Start and end dates, or null if beyond maxDays
 */
export function getNextMonthRange(today, maxDays = 60) {
    // Start of next month
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    start.setHours(0, 0, 0, 0);

    // End of next month
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    end.setHours(23, 59, 59, 999);

    // Calculate max date based on maxDays
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxDays);
    maxDate.setHours(23, 59, 59, 999);

    // If start is beyond maxDays, skip this section
    if (start > maxDate) {
        return null;
    }

    // Cap end date at maxDays
    if (end > maxDate) {
        return { start, end: maxDate };
    }

    return { start, end };
}

/**
 * Get array of dates between start and end (inclusive)
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Date[]} Array of dates
 */
export function getDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

/**
 * Format month name from date
 * @param {Date} date - Date to format
 * @returns {string} Month name (e.g., "February")
 */
export function getMonthName(date) {
    return date.toLocaleDateString('en-US', { month: 'long' });
}

export { WEEKDAYS, WEEKDAY_NAMES, ORDINALS };
