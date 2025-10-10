// ======================
// MODULE IMPORTS
// ======================
import { 
    getWeekDates, 
    formatWeekRange 
} from './modules/dateUtils.js';

import { 
    setupModalEventListeners,
    clearScheduleContainer,
    appendDayToContainer 
} from './modules/domUtils.js';

import { 
    renderWeek 
} from './modules/weeklyViewRenderer.js';

import { 
    renderAllVenues 
} from './modules/alphabeticalViewRenderer.js';

import { 
    showVenueDetails 
} from './modules/modalRenderer.js';

import { 
    updateViewDisplay,
    updateViewToggleButtons,
    addViewToggleButtons 
} from './modules/viewManager.js';

import { 
    getVenuesForDate,
    getAllVenues 
} from './modules/venueUtils.js';

// ======================
// APP STATE
// ======================
const TODAY = new Date().toDateString();
let currentWeekStart = new Date();
let showDedicated = true;
let currentView = 'weekly';

// ======================
// VIEW MANAGEMENT
// ======================

/**
 * Renders the appropriate view based on current state
 */
const renderCurrentView = () => {
    if (currentView === 'weekly') {
        renderWeek(karaokeData, currentWeekStart, showDedicated, getVenuesForDate);
    } else {
        renderAllVenues(karaokeData, showDedicated, getAllVenues);
    }
    updateViewDisplay(currentView, currentWeekStart);
    updateViewToggleButtons(currentView);
};

// ======================
// EVENT HANDLERS
// ======================

/**
 * Sets up general event listeners on buttons and UI elements.
 */
const setupEventListeners = () => {
    // Back to top button visibility and click
    const backToTop = document.getElementById("backToTop");
    window.addEventListener("scroll", () => {
        backToTop.classList.toggle("visible", window.pageYOffset > 300);
    });
    backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Week navigation buttons
    document.getElementById("prev-week").addEventListener("click", () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderCurrentView();
    });
    document.getElementById("next-week").addEventListener("click", () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderCurrentView();
    });
    document.getElementById("this-week").addEventListener("click", () => {
        currentWeekStart = new Date();
        renderCurrentView();
    });

    // Dedicated venues toggle checkbox
    document.getElementById("dedicated-toggle").addEventListener("change", (e) => {
        showDedicated = e.target.checked;
        renderCurrentView();
    });

    // Venue details buttons (delegated event listener)
    document.getElementById("schedule-container").addEventListener("click", (e) => {
        if (e.target.classList.contains("details-btn")) {
            const venueId = e.target.dataset.id;
            const venue = karaokeData.listings.find(v => v.id === venueId);
            if (venue) {
                showVenueDetails(venue);
            }
        }
    });

    // View toggle buttons
    document.getElementById("view-toggle-weekly").addEventListener("click", () => {
        currentView = 'weekly';
        renderCurrentView();
    });
    
    document.getElementById("view-toggle-alphabetical").addEventListener("click", () => {
        currentView = 'alphabetical';
        renderCurrentView();
    });
};

// ======================
// INITIALIZATION
// ======================

/**
 * Initializes the app
 */
const init = () => {
    addViewToggleButtons();
    
    if (typeof DOMPurify !== 'object') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.5/purify.min.js';
        script.onload = () => {
            setupModalEventListeners();
            setupEventListeners();
            renderCurrentView();
        };
        document.head.appendChild(script);
    } else {
        setupModalEventListeners();
        setupEventListeners();
        renderCurrentView();
    }
};

init();