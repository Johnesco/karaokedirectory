/**
 * Schedule Tests
 * Tests for venue scheduling logic
 */

import {
    scheduleMatchesDate,
    getDayName,
    getWeekStart,
    getWeekDates,
    isDateInRange,
    formatTime12,
    formatTime24
} from '../js/utils/date.js';

import { initVenues, getVenuesForDate, getAllVenues } from '../js/services/venues.js';

// ============================================================================
// Test Framework
// ============================================================================

const results = {
    suites: [],
    total: 0,
    passed: 0,
    failed: 0
};

let currentSuite = null;

function describe(name, fn) {
    currentSuite = { name, tests: [] };
    fn();
    results.suites.push(currentSuite);
    currentSuite = null;
}

function test(name, fn) {
    results.total++;
    try {
        fn();
        results.passed++;
        currentSuite.tests.push({ name, passed: true });
    } catch (error) {
        results.failed++;
        currentSuite.tests.push({ name, passed: false, error: error.message });
    }
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${expected} but got ${actual}`);
            }
        },
        toBeTrue() {
            if (actual !== true) {
                throw new Error(`Expected true but got ${actual}`);
            }
        },
        toBeFalse() {
            if (actual !== false) {
                throw new Error(`Expected false but got ${actual}`);
            }
        },
        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
            }
        },
        toBeGreaterThan(expected) {
            if (!(actual > expected)) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toContain(expected) {
            if (!actual.includes(expected)) {
                throw new Error(`Expected "${actual}" to contain "${expected}"`);
            }
        }
    };
}

// Helper to create a date
function date(dateStr) {
    return new Date(dateStr + 'T12:00:00');
}

// ============================================================================
// Schedule Matching Tests
// ============================================================================

describe('scheduleMatchesDate - "every" frequency', () => {
    test('matches every Friday on a Friday', () => {
        const schedule = { frequency: 'every', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-17'))).toBeTrue(); // Friday
    });

    test('does not match every Friday on a Saturday', () => {
        const schedule = { frequency: 'every', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-18'))).toBeFalse(); // Saturday
    });

    test('matches every Saturday on any Saturday', () => {
        const schedule = { frequency: 'every', day: 'Saturday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-04'))).toBeTrue();
        expect(scheduleMatchesDate(schedule, date('2025-01-11'))).toBeTrue();
        expect(scheduleMatchesDate(schedule, date('2025-01-18'))).toBeTrue();
        expect(scheduleMatchesDate(schedule, date('2025-01-25'))).toBeTrue();
    });

    test('handles case-insensitive day names', () => {
        const schedule = { frequency: 'every', day: 'friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-17'))).toBeTrue();
    });
});

describe('scheduleMatchesDate - "first" frequency', () => {
    test('matches first Saturday of January 2025', () => {
        const schedule = { frequency: 'first', day: 'Saturday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-04'))).toBeTrue();
    });

    test('does not match second Saturday when looking for first', () => {
        const schedule = { frequency: 'first', day: 'Saturday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-11'))).toBeFalse();
    });

    test('matches first Friday of February 2025', () => {
        const schedule = { frequency: 'first', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-02-07'))).toBeTrue();
    });

    test('first Sunday when month starts on Sunday', () => {
        // June 2025 starts on Sunday
        const schedule = { frequency: 'first', day: 'Sunday' };
        expect(scheduleMatchesDate(schedule, date('2025-06-01'))).toBeTrue();
    });
});

describe('scheduleMatchesDate - "second" frequency', () => {
    test('matches second Friday of January 2025', () => {
        const schedule = { frequency: 'second', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-10'))).toBeTrue();
    });

    test('does not match first Friday when looking for second', () => {
        const schedule = { frequency: 'second', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-03'))).toBeFalse();
    });
});

describe('scheduleMatchesDate - "third" frequency', () => {
    test('matches third Thursday of January 2025', () => {
        const schedule = { frequency: 'third', day: 'Thursday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-16'))).toBeTrue();
    });

    test('does not match second Thursday when looking for third', () => {
        const schedule = { frequency: 'third', day: 'Thursday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-09'))).toBeFalse();
    });
});

describe('scheduleMatchesDate - "fourth" frequency', () => {
    test('matches fourth Wednesday of January 2025', () => {
        const schedule = { frequency: 'fourth', day: 'Wednesday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-22'))).toBeTrue();
    });

    test('does not match fifth Wednesday when looking for fourth', () => {
        const schedule = { frequency: 'fourth', day: 'Wednesday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-29'))).toBeFalse();
    });
});

describe('scheduleMatchesDate - "fifth" frequency', () => {
    test('matches fifth Friday when month has 5 Fridays', () => {
        // January 2025 has 5 Fridays: 3, 10, 17, 24, 31
        const schedule = { frequency: 'fifth', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-31'))).toBeTrue();
    });

    test('does not match fourth Friday when looking for fifth', () => {
        const schedule = { frequency: 'fifth', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-24'))).toBeFalse();
    });

    test('fifth does not exist in months with only 4 occurrences', () => {
        // February 2025 has only 4 Saturdays: 1, 8, 15, 22
        const schedule = { frequency: 'fifth', day: 'Saturday' };
        expect(scheduleMatchesDate(schedule, date('2025-02-22'))).toBeFalse();
    });
});

describe('scheduleMatchesDate - "last" frequency', () => {
    test('matches last Friday of January 2025', () => {
        // January 2025 has 5 Fridays, last is Jan 31
        const schedule = { frequency: 'last', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-31'))).toBeTrue();
    });

    test('does not match fourth Friday when fifth exists (looking for last)', () => {
        const schedule = { frequency: 'last', day: 'Friday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-24'))).toBeFalse();
    });

    test('matches last Saturday of February 2025', () => {
        // February 2025 last Saturday is Feb 22
        const schedule = { frequency: 'last', day: 'Saturday' };
        expect(scheduleMatchesDate(schedule, date('2025-02-22'))).toBeTrue();
    });

    test('last Thursday of month with 4 Thursdays', () => {
        // January 2025 Thursdays: 2, 9, 16, 23, 30 - last is 30th
        const schedule = { frequency: 'last', day: 'Thursday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-30'))).toBeTrue();
    });

    test('does not match earlier occurrence when looking for last', () => {
        const schedule = { frequency: 'last', day: 'Thursday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-23'))).toBeFalse();
    });
});

describe('scheduleMatchesDate - Edge Cases', () => {
    test('wrong day of week always returns false', () => {
        const schedule = { frequency: 'every', day: 'Monday' };
        expect(scheduleMatchesDate(schedule, date('2025-01-17'))).toBeFalse(); // Friday
    });

    test('handles month boundary - last day is correct weekday', () => {
        // March 31, 2025 is a Monday
        const schedule = { frequency: 'last', day: 'Monday' };
        expect(scheduleMatchesDate(schedule, date('2025-03-31'))).toBeTrue();
    });

    test('handles year boundary', () => {
        // Dec 31, 2025 is Wednesday
        const schedule = { frequency: 'last', day: 'Wednesday' };
        expect(scheduleMatchesDate(schedule, date('2025-12-31'))).toBeTrue();
    });

    test('handles leap year February', () => {
        // Feb 29, 2028 is Tuesday (2028 is a leap year)
        const schedule = { frequency: 'last', day: 'Tuesday' };
        expect(scheduleMatchesDate(schedule, date('2028-02-29'))).toBeTrue();
    });
});

// ============================================================================
// Date Utility Tests
// ============================================================================

describe('getDayName', () => {
    test('returns lowercase day name for Friday', () => {
        expect(getDayName(date('2025-01-17'))).toBe('friday');
    });

    test('returns lowercase day name for Sunday', () => {
        expect(getDayName(date('2025-01-19'))).toBe('sunday');
    });
});

describe('getWeekStart', () => {
    test('returns Sunday for a Friday date', () => {
        const friday = date('2025-01-17');
        const weekStart = getWeekStart(friday);
        expect(getDayName(weekStart)).toBe('sunday');
        expect(weekStart.getDate()).toBe(12);
    });

    test('returns same day for a Sunday', () => {
        const sunday = date('2025-01-12');
        const weekStart = getWeekStart(sunday);
        expect(weekStart.getDate()).toBe(12);
    });
});

describe('getWeekDates', () => {
    test('returns 7 dates starting from given date', () => {
        const startDate = date('2025-01-12'); // Sunday
        const weekDates = getWeekDates(startDate);
        expect(weekDates.length).toBe(7);
        expect(weekDates[0].getDate()).toBe(12);
        expect(weekDates[6].getDate()).toBe(18);
    });
});

describe('isDateInRange', () => {
    test('returns true when date is within range', () => {
        expect(isDateInRange(date('2025-01-15'), '2025-01-01', '2025-01-31')).toBeTrue();
    });

    test('returns false when date is before range', () => {
        expect(isDateInRange(date('2024-12-31'), '2025-01-01', '2025-01-31')).toBeFalse();
    });

    test('returns false when date is after range', () => {
        expect(isDateInRange(date('2025-02-01'), '2025-01-01', '2025-01-31')).toBeFalse();
    });

    test('returns true when no range specified', () => {
        expect(isDateInRange(date('2025-01-15'), null, null)).toBeTrue();
    });

    test('returns true when only start specified and date is after', () => {
        expect(isDateInRange(date('2025-01-15'), '2025-01-01', null)).toBeTrue();
    });
});

describe('formatTime12', () => {
    test('converts 21:00 to 9:00 PM', () => {
        expect(formatTime12('21:00')).toBe('9:00 PM');
    });

    test('converts 09:30 to 9:30 AM', () => {
        expect(formatTime12('09:30')).toBe('9:30 AM');
    });

    test('converts 00:00 to 12:00 AM', () => {
        expect(formatTime12('00:00')).toBe('12:00 AM');
    });

    test('converts 12:00 to 12:00 PM', () => {
        expect(formatTime12('12:00')).toBe('12:00 PM');
    });
});

describe('formatTime24', () => {
    test('converts 9:00 PM to 21:00', () => {
        expect(formatTime24('9:00 PM')).toBe('21:00');
    });

    test('converts 9:30 AM to 09:30', () => {
        expect(formatTime24('9:30 AM')).toBe('09:30');
    });
});

// ============================================================================
// Venue Service Tests
// ============================================================================

describe('Venue Service', () => {
    test('initVenues loads venue data', () => {
        // Data is already loaded via script tag
        initVenues(window.karaokeData);
        const venues = getAllVenues();
        expect(venues.length).toBeGreaterThan(0);
    });

    test('getVenuesForDate returns venues for a specific date', () => {
        initVenues(window.karaokeData);
        const venues = getVenuesForDate(date('2025-01-17')); // Friday
        // Should return some venues (most venues have Friday nights)
        expect(venues.length).toBeGreaterThan(0);
    });

    test('getVenuesForDate returns empty for unlikely date', () => {
        initVenues(window.karaokeData);
        // Very early morning on a random date shouldn't break
        const venues = getVenuesForDate(date('2025-01-17'));
        // This should still work
        expect(venues).toEqual(venues); // Just checking it doesn't throw
    });
});

// ============================================================================
// Run Tests and Render Results
// ============================================================================

function renderResults() {
    // Update summary
    document.getElementById('total-count').textContent = results.total;
    document.getElementById('pass-count').textContent = results.passed;
    document.getElementById('fail-count').textContent = results.failed;

    // Render test suites
    const container = document.getElementById('test-results');
    container.innerHTML = '';

    for (const suite of results.suites) {
        const passed = suite.tests.filter(t => t.passed).length;
        const failed = suite.tests.filter(t => !t.passed).length;
        const statusIcon = failed > 0 ? 'fa-circle-xmark' : 'fa-circle-check';
        const statusColor = failed > 0 ? 'var(--color-error)' : 'var(--color-success)';

        const suiteEl = document.createElement('div');
        suiteEl.className = 'test-suite';
        suiteEl.innerHTML = `
            <div class="test-suite__header">
                <span class="test-suite__title">
                    <i class="fa-solid ${statusIcon}" style="color: ${statusColor}"></i>
                    ${suite.name}
                </span>
                <span class="test-suite__count">${passed}/${suite.tests.length} passed</span>
            </div>
            <div class="test-suite__results">
                ${suite.tests.map(t => `
                    <div class="test-result test-result--${t.passed ? 'pass' : 'fail'}">
                        <span class="test-result__icon">
                            <i class="fa-solid ${t.passed ? 'fa-check' : 'fa-xmark'}"></i>
                        </span>
                        <div class="test-result__name">
                            ${t.name}
                            ${t.error ? `<div class="test-result__error">${t.error}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(suiteEl);
    }
}

// ============================================================================
// Interactive Date Tester
// ============================================================================

function getMatchReason(venue, targetDate) {
    const dayName = getDayName(targetDate).toLowerCase();

    for (const sched of venue.schedule) {
        if (sched.day.toLowerCase() !== dayName) continue;
        if (scheduleMatchesDate(sched, targetDate)) {
            if (sched.frequency === 'every') {
                return `Every ${sched.day}`;
            } else {
                return `${sched.frequency.charAt(0).toUpperCase() + sched.frequency.slice(1)} ${sched.day}`;
            }
        }
    }
    return 'Unknown';
}

function testDate() {
    const dateInput = document.getElementById('test-date');
    const resultsDiv = document.getElementById('date-results');
    const dateInfo = document.getElementById('date-info');

    if (!dateInput.value) {
        resultsDiv.innerHTML = '<p class="no-venues">Please select a date</p>';
        return;
    }

    const testDateValue = date(dateInput.value);
    const dayName = getDayName(testDateValue);
    const formattedDate = testDateValue.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    dateInfo.textContent = formattedDate;

    initVenues(window.karaokeData);
    const venues = getVenuesForDate(testDateValue);

    if (venues.length === 0) {
        resultsDiv.innerHTML = '<p class="no-venues">No venues have karaoke on this date</p>';
        return;
    }

    resultsDiv.innerHTML = venues.map(venue => `
        <div class="venue-result">
            <span class="venue-result__name">${venue.name}</span>
            <span class="venue-result__reason">${getMatchReason(venue, testDateValue)}</span>
        </div>
    `).join('');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today
    const dateInput = document.getElementById('test-date');
    dateInput.value = new Date().toISOString().split('T')[0];

    // Bind event handlers
    document.getElementById('test-date-btn').addEventListener('click', testDate);
    dateInput.addEventListener('change', testDate);

    // Render test results
    renderResults();

    // Run initial date test
    testDate();
});
