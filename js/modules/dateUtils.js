import { WEEKDAYS, VALID_ORDINALS } from './constants.js';
import { capitalizeFirstLetter } from './stringUtils.js';

/**
 * Gets the full weekday name for a given date.
 */
export const getDayName = (date) => date.toLocaleDateString("en-US", { weekday: "long" });

/**
 * Formats a date as "Mon DD".
 */
export const formatDateShort = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Checks if a date is the current day.
 */
export const isCurrentDay = (date) => date.toDateString() === new Date().toDateString();

/**
 * Formats a week range string from a start date.
 */
export const formatWeekRange = (startDate) => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return `Viewing: ${formatDateShort(startDate)} - ${formatDateShort(endDate)} ${endDate.getFullYear()}`;
};

/**
 * Gets dates for an entire week starting from the given date
 */
export const getWeekDates = (targetDate = new Date()) => {
    const current = new Date(targetDate);
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() - current.getDay());
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        weekDates.push(date);
    }
    return weekDates;
};

/**
 * Determines if a date matches a specific ordinal occurrence of a weekday in the month.
 */
export const isOrdinalDate = (date, ordinal, dayName) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return false;
    if (!VALID_ORDINALS.includes(ordinal)) return false;
    if (ordinal === "every") return true;

    const targetDayIndex = WEEKDAYS.indexOf(dayName);
    if (targetDayIndex === -1) return false;

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Get all occurrences of dayName in this month
    const occurrences = [];
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();

    let firstOccurrence = 1 + ((targetDayIndex - firstDayOfWeek + 7) % 7);
    for (let d = firstOccurrence; d <= 31; d += 7) {
        const testDate = new Date(year, month, d);
        if (testDate.getMonth() !== month) break;
        occurrences.push(d);
    }

    if (ordinal === "last") return day === occurrences[occurrences.length - 1];

    const ordinalIndex = ["first", "second", "third", "fourth", "fifth"].indexOf(ordinal);
    return ordinalIndex < occurrences.length && day === occurrences[ordinalIndex];
};