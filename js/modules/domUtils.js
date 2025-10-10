import { escapeHtml } from './stringUtils.js';
import { capitalizeFirstLetter } from './stringUtils.js'; // ADD THIS IMPORT

/**
 * Clears the schedule container element's contents.
 */
export const clearScheduleContainer = () => {
    document.getElementById("schedule-container").innerHTML = '';
};

/**
 * Appends sanitized HTML for a day card into the schedule container.
 */
export const appendDayToContainer = (html) => {
    const container = document.getElementById("schedule-container");
    container.insertAdjacentHTML("beforeend", DOMPurify.sanitize(html));
};

/**
 * Sets up event listeners for modal close interactions.
 */
export const setupModalEventListeners = () => {
    const modal = document.getElementById("venue-modal");
    const closeBtn = modal.querySelector(".close-modal");

    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.style.display === "block") {
            modal.style.display = "none";
        }
    });
};

/**
 * Creates HTML for a list of schedule events
 */
export const createScheduleList = (schedule) => {
    if (!schedule.length) return '';

    const items = schedule.map(event => {
        const [cadence, day] = event.day;
        const pluralDay = cadence === 'every' ? day : `${day}s`;
        return `<li class="modal-schedule-item">${escapeHtml(capitalizeFirstLetter(cadence))} ${escapeHtml(pluralDay)}: ${escapeHtml(event.time)}</li>`;
    });

    return `<ul>${items.join('')}</ul>`;
};