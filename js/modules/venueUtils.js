import { getDayName, isOrdinalDate } from './dateUtils.js';
import { capitalizeFirstLetter, getSortableName } from './stringUtils.js';

/**
 * Checks if a venue has karaoke scheduled on a given date.
 */
export const hasKaraokeOnDate = (venue, date) => {
    const dayName = getDayName(date);

    for (const event of venue.schedule) {
        const [ordinal, ordinalDay] = event.day;
        if (!event.description) {
            event.description = `${capitalizeFirstLetter(ordinal)} ${ordinalDay}`;
        }

        if (ordinalDay === dayName && isOrdinalDate(date, ordinal, ordinalDay)) {
            return {
                hasEvent: true,
                timeInfo: {
                    time: event.time,
                    description: event.description
                }
            };
        }
    }
    return { hasEvent: false };
};

/**
 * Filters and sorts venues that have karaoke on a given date.
 */
export const getVenuesForDate = (karaokeData, date, showDedicated) => karaokeData.listings
    .map(venue => {
        const { hasEvent, timeInfo } = hasKaraokeOnDate(venue, date);
        return hasEvent ? { ...venue, timeInfo } : null;
    })
    .filter(venue => {
        if (!venue) return false;
        if (!showDedicated && venue.Dedicated) return false;

        const timeframe = venue.Timeframe;
        if (timeframe) {
            const renderDate = date.toISOString().split('T')[0];
            if (timeframe.StartDate && renderDate < timeframe.StartDate) return false;
            if (timeframe.EndDate && renderDate > timeframe.EndDate) return false;
        }
        return true;
    })
    .sort((a, b) => getSortableName(a.VenueName).localeCompare(getSortableName(b.VenueName)));

/**
 * Gets all venues sorted alphabetically, applying filters.
 */
export const getAllVenues = (karaokeData, showDedicated) => karaokeData.listings
    .filter(venue => {
        if (!showDedicated && venue.Dedicated) return false;
        
        const timeframe = venue.Timeframe;
        if (timeframe) {
            const today = new Date().toISOString().split('T')[0];
            if (timeframe.StartDate && today < timeframe.StartDate) return false;
            if (timeframe.EndDate && today > timeframe.EndDate) return false;
        }
        
        return true;
    })
    .sort((a, b) => getSortableName(a.VenueName).localeCompare(getSortableName(b.VenueName)));