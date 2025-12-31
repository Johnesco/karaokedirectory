// List of words to populate the Bingo card
const words = [
    "Forgot the lyrics", "Mic drop fail", "Wrong song started", "Crowd sings louder", "Voice cracked badly",
    "Danced off stage", "Fell off stage", "Microphone feedback screech", "Sang off-key", "Over-the-top air guitar",
    "Crowd awkwardly silent", "Tripped on cord", "Started too early", "Missed the cue", "Sang wrong verse",
    "Forgot the chorus", "Crowd joined unexpectedly", "Sang too quietly", "Overly aggressive headbanging", "Forgot the tune",
    "Sang while laughing", "Overly long intro", "Overly loud scream", "Crowd sang backup", "Crowd sang harmony"
];

let bingoAchieved = false;
let winningCells = [];
let currentCardWords = [];
let moveHistory = []; // Track all moves for undo

const STORAGE_KEY = 'karaokeBingoState';

// Save current state to localStorage
function saveState() {
    const cells = document.querySelectorAll('.cell');
    const markedIndices = [];
    cells.forEach((cell, index) => {
        if (cell.classList.contains('marked') && index !== 12) { // 12 is the free space
            markedIndices.push(index);
        }
    });

    const state = {
        cardWords: currentCardWords,
        markedIndices: markedIndices,
        bingoAchieved: bingoAchieved,
        winningCells: winningCells,
        moveHistory: moveHistory
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Update undo button visibility
function updateUndoButton() {
    const undoButton = document.getElementById('undo-button');
    if (moveHistory.length > 0) {
        undoButton.classList.add('visible');
    } else {
        undoButton.classList.remove('visible');
    }
}

// Perform undo operation
function undoLastMove() {
    if (moveHistory.length === 0) return;

    const lastMove = moveHistory.pop();
    const cells = document.querySelectorAll('.cell');
    const cell = cells[lastMove.cellIndex];

    // If we're undoing a bingo, clear the bingo state first
    if (bingoAchieved) {
        bingoAchieved = false;
        winningCells = [];

        // Clear celebration elements
        document.querySelectorAll('.confetti, .firework-burst, .star, .screen-flash').forEach(el => el.remove());

        // Remove winning highlights from all cells
        document.querySelectorAll('.winning-cell').forEach(c => {
            c.classList.remove('winning-cell');
        });

        // Hide bingo message and reset button
        const bingoMessage = document.getElementById('bingo-message');
        const resetButton = document.getElementById('reset-button');
        bingoMessage.textContent = '';
        bingoMessage.classList.remove('show');
        resetButton.classList.remove('visible');
    }

    // Restore cell to previous state
    if (lastMove.wasMarked) {
        cell.classList.add('marked', 'flipped');
    } else {
        cell.classList.remove('marked', 'flipped');
    }

    // Check if there's still a bingo after undo (in case of multiple winning lines)
    checkBingo();

    updateUndoButton();
    saveState();
}

// Load state from localStorage
function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Clear saved state
function clearState() {
    localStorage.removeItem(STORAGE_KEY);
}

// Vibrant colors for celebration
const celebrationColors = [
    '#ff0000', '#ff7700', '#ffdd00', '#00ff00', '#00ddff',
    '#ff00ff', '#ff69b4', '#00ff7f', '#ffd700', '#ff1493'
];

// Shuffle the words array
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Generate a random set of 24 words (since the middle is a free space)
function generateCard() {
    return shuffle(words).slice(0, 24);
}

// Create the Bingo card
function createBingoCard(savedState = null) {
    const bingoCard = document.getElementById('bingo-card');
    const bingoMessage = document.getElementById('bingo-message');
    const resetButton = document.getElementById('reset-button');
    bingoCard.innerHTML = '';
    bingoMessage.textContent = '';
    bingoMessage.classList.remove('show');
    resetButton.classList.remove('visible');
    bingoAchieved = false;
    winningCells = [];

    // Use saved words or generate new ones
    const selectedWords = savedState ? savedState.cardWords : generateCard();
    currentCardWords = selectedWords;

    // Restore or reset move history
    moveHistory = savedState && savedState.moveHistory ? savedState.moveHistory : [];

    const cardSize = 5;
    const middleCellIndex = Math.floor(cardSize * cardSize / 2);
    let wordIndex = 0;

    for (let i = 0; i < cardSize * cardSize; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;

        const front = document.createElement('div');
        front.classList.add('front');
        const back = document.createElement('div');
        back.classList.add('back');

        if (i === middleCellIndex) {
            front.textContent = "FREE";
            back.textContent = "FREE";
            cell.classList.add('marked', 'free-space');
        } else {
            const word = selectedWords[wordIndex++];
            front.textContent = word;
            back.textContent = word;

            // Restore marked state if loading from saved state
            if (savedState && savedState.markedIndices.includes(i)) {
                cell.classList.add('marked', 'flipped');
            }
        }

        cell.appendChild(front);
        cell.appendChild(back);

        cell.addEventListener('click', () => {
            // Prevent toggling the middle "FREE" space
            if (i !== middleCellIndex && !bingoAchieved) {
                // Record move before making it (store previous state)
                const wasMarked = cell.classList.contains('marked');
                moveHistory.push({
                    cellIndex: i,
                    wasMarked: wasMarked
                });

                cell.classList.toggle('marked');
                cell.classList.toggle('flipped');

                // Haptic feedback on mobile
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }

                checkBingo();
                updateUndoButton();
                saveState();
            }
        });

        bingoCard.appendChild(cell);
    }

    // Restore bingo state if was achieved
    if (savedState && savedState.bingoAchieved) {
        bingoAchieved = true;
        winningCells = savedState.winningCells;

        const cells = document.querySelectorAll('.cell');
        winningCells.forEach(index => {
            cells[index].classList.add('winning-cell');
        });

        bingoMessage.textContent = "BINGO!";
        bingoMessage.classList.add('show');
        resetButton.classList.add('visible');
    }

    // Update undo button visibility
    updateUndoButton();
}

// Check for a Bingo
function checkBingo() {
    const cells = document.querySelectorAll('.cell');
    const marked = Array.from(cells).map(cell => cell.classList.contains('marked'));
    const size = 5;

    // Check rows, columns, and diagonals and get winning cells
    const result = checkLines(marked, size);

    const bingoMessage = document.getElementById('bingo-message');
    const resetButton = document.getElementById('reset-button');

    if (result.isBingo && !bingoAchieved) {
        bingoAchieved = true;
        winningCells = result.winningIndices;

        // Highlight winning cells
        winningCells.forEach(index => {
            cells[index].classList.add('winning-cell');
        });

        // Trigger celebration
        triggerCelebration();

        bingoMessage.textContent = "BINGO!";
        bingoMessage.classList.add('show');
        resetButton.classList.add('visible');

        // Strong haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }
    }
}

// Check rows, columns, and diagonals for a Bingo
function checkLines(marked, size) {
    // Check rows
    for (let i = 0; i < size; i++) {
        const rowIndices = [];
        for (let j = 0; j < size; j++) {
            rowIndices.push(i * size + j);
        }
        if (rowIndices.every(idx => marked[idx])) {
            return { isBingo: true, winningIndices: rowIndices };
        }
    }

    // Check columns
    for (let i = 0; i < size; i++) {
        const colIndices = [];
        for (let j = 0; j < size; j++) {
            colIndices.push(j * size + i);
        }
        if (colIndices.every(idx => marked[idx])) {
            return { isBingo: true, winningIndices: colIndices };
        }
    }

    // Check diagonal (top-left to bottom-right)
    const diag1Indices = [];
    for (let i = 0; i < size; i++) {
        diag1Indices.push(i * size + i);
    }
    if (diag1Indices.every(idx => marked[idx])) {
        return { isBingo: true, winningIndices: diag1Indices };
    }

    // Check diagonal (top-right to bottom-left)
    const diag2Indices = [];
    for (let i = 0; i < size; i++) {
        diag2Indices.push(i * size + (size - 1 - i));
    }
    if (diag2Indices.every(idx => marked[idx])) {
        return { isBingo: true, winningIndices: diag2Indices };
    }

    return { isBingo: false, winningIndices: [] };
}

// Main celebration trigger
function triggerCelebration() {
    // Screen flash
    createScreenFlash();

    // Multiple waves of effects
    createConfetti(80);
    setTimeout(() => createFireworkBursts(5), 200);
    setTimeout(() => createConfetti(60), 500);
    setTimeout(() => createFireworkBursts(4), 700);
    setTimeout(() => createStars(15), 300);
    setTimeout(() => createConfetti(40), 1000);
    setTimeout(() => createFireworkBursts(3), 1200);
}

// Screen flash effect
function createScreenFlash() {
    const flash = document.createElement('div');
    flash.classList.add('screen-flash');
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
}

// Create confetti particles
function createConfetti(count) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');

            // Random shape
            const shapes = ['square', 'circle', 'ribbon'];
            confetti.classList.add(shapes[Math.floor(Math.random() * shapes.length)]);

            // Random color
            confetti.style.backgroundColor = celebrationColors[Math.floor(Math.random() * celebrationColors.length)];

            // Random starting position (across the top)
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.top = `-20px`;

            // Random size
            const size = 8 + Math.random() * 12;
            confetti.style.width = `${size}px`;
            confetti.style.height = confetti.classList.contains('ribbon') ? `${size * 2.5}px` : `${size}px`;

            // Random animation duration
            const duration = 2 + Math.random() * 2;
            confetti.style.animationDuration = `${duration}s`;

            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), duration * 1000);
        }, i * 30);
    }
}

// Create firework bursts
function createFireworkBursts(count) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            createSingleFirework(
                Math.random() * window.innerWidth,
                Math.random() * window.innerHeight * 0.6
            );
        }, i * 200);
    }
}

// Create a single firework burst
function createSingleFirework(x, y) {
    const burst = document.createElement('div');
    burst.classList.add('firework-burst');
    burst.style.left = `${x}px`;
    burst.style.top = `${y}px`;

    const particleCount = 20 + Math.floor(Math.random() * 15);
    const color = celebrationColors[Math.floor(Math.random() * celebrationColors.length)];

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('firework-particle');
        particle.style.backgroundColor = color;

        // Calculate explosion direction
        const angle = (i / particleCount) * Math.PI * 2;
        const velocity = 50 + Math.random() * 100;
        const endX = Math.cos(angle) * velocity;
        const endY = Math.sin(angle) * velocity;

        // Set custom end position via CSS variable
        particle.style.setProperty('--end-x', `${endX}px`);
        particle.style.setProperty('--end-y', `${endY}px`);
        particle.style.animation = `fireworkExplode 1s ease-out forwards`;
        particle.style.setProperty('transform', `translate(0, 0)`);

        // Override the animation with inline keyframes
        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${endX}px, ${endY}px) scale(0.3)`, opacity: 0 }
        ], {
            duration: 800 + Math.random() * 400,
            easing: 'cubic-bezier(0, 0.5, 0.5, 1)',
            fill: 'forwards'
        });

        burst.appendChild(particle);
    }

    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 1500);
}

// Create star bursts
function createStars(count) {
    const starEmojis = ['⭐', '✨', '🌟', '💫'];

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const star = document.createElement('div');
            star.classList.add('star');
            star.textContent = starEmojis[Math.floor(Math.random() * starEmojis.length)];
            star.style.left = `${Math.random() * 100}vw`;
            star.style.top = `${Math.random() * 100}vh`;
            star.style.fontSize = `${20 + Math.random() * 30}px`;

            document.body.appendChild(star);
            setTimeout(() => star.remove(), 1500);
        }, i * 100);
    }
}

// Reset the Bingo card
document.getElementById('reset-button').addEventListener('click', () => {
    // Clear any remaining celebration elements
    document.querySelectorAll('.confetti, .firework-burst, .star, .screen-flash').forEach(el => el.remove());

    // Remove winning highlights
    document.querySelectorAll('.winning-cell').forEach(cell => {
        cell.classList.remove('winning-cell');
    });

    // Clear saved state and create fresh card
    clearState();
    createBingoCard();
});

// Undo button handler
document.getElementById('undo-button').addEventListener('click', () => {
    undoLastMove();

    // Haptic feedback on mobile
    if (navigator.vibrate) {
        navigator.vibrate(10);
    }
});

// Initialize the Bingo card - restore from saved state if available
const savedState = loadState();
createBingoCard(savedState);
