import { formatWeekRange } from './dateUtils.js';

/**
 * Updates the UI based on current view
 */
export const updateViewDisplay = (currentView, currentWeekStart) => {
    const weekDisplay = document.getElementById("week-display");
    const controlsContainer = document.querySelector('.controls-container');
    
    if (currentView === 'weekly') {
        weekDisplay.textContent = formatWeekRange(currentWeekStart);
        controlsContainer.style.display = 'flex';
    } else {
        weekDisplay.textContent = 'Alphabetical Listing - All Venues';
        controlsContainer.style.display = 'none';
    }
};

/**
 * Updates active state of view toggle buttons
 */
export const updateViewToggleButtons = (currentView) => {
    const weeklyBtn = document.getElementById('view-toggle-weekly');
    const alphabeticalBtn = document.getElementById('view-toggle-alphabetical');
    
    if (weeklyBtn && alphabeticalBtn) {
        if (currentView === 'weekly') {
            weeklyBtn.style.backgroundColor = '#f72a2a';
            weeklyBtn.style.color = 'white';
            alphabeticalBtn.style.backgroundColor = '#2f40d3';
            alphabeticalBtn.style.color = 'white';
        } else {
            weeklyBtn.style.backgroundColor = '#2f40d3';
            weeklyBtn.style.color = 'white';
            alphabeticalBtn.style.backgroundColor = '#f72a2a';
            alphabeticalBtn.style.color = 'white';
        }
    }
};

/**
 * Creates and adds view toggle buttons to the controls
 */
export const addViewToggleButtons = () => {
    const controlsContainer = document.querySelector('.controls-container');
    
    const viewToggleContainer = document.createElement('div');
    viewToggleContainer.className = 'view-toggle-container';
    viewToggleContainer.style.display = 'flex';
    viewToggleContainer.style.gap = '10px';
    viewToggleContainer.style.marginBottom = '15px';
    viewToggleContainer.style.justifyContent = 'center';
    
    const weeklyButton = document.createElement('button');
    weeklyButton.id = 'view-toggle-weekly';
    weeklyButton.textContent = 'Weekly View';
    weeklyButton.title = 'Show venues by week';
    
    const alphabeticalButton = document.createElement('button');
    alphabeticalButton.id = 'view-toggle-alphabetical';
    alphabeticalButton.textContent = 'Alphabetical View';
    alphabeticalButton.title = 'Show all venues in alphabetical order';
    
    viewToggleContainer.appendChild(weeklyButton);
    viewToggleContainer.appendChild(alphabeticalButton);
    
    controlsContainer.parentNode.insertBefore(viewToggleContainer, controlsContainer);
};