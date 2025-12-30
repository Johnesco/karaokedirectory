// List of words to populate the Bingo card
const words = [
    "Forgot the lyrics", "Mic drop fail", "Wrong song started", "Crowd sings louder", "Voice cracked badly",
    "Danced off stage", "Fell off stage", "Microphone feedback screech", "Sang off-key", "Over-the-top air guitar",
    "Crowd awkwardly silent", "Tripped on cord", "Started too early", "Missed the cue", "Sang wrong verse",
    "Forgot the chorus", "Crowd joined unexpectedly", "Sang too quietly", "Overly aggressive headbanging", "Forgot the tune",
    "Sang while laughing", "Overly long intro", "Overly loud scream", "Crowd sang backup", "Crowd sang harmony"
];

let bingoAchieved = false;

// Shuffle the words array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Generate a random set of 24 words (since the middle is a free space)
function generateCard() {
    shuffle(words);
    return words.slice(0, 24);
}

// Create the Bingo card
function createBingoCard() {
    const bingoCard = document.getElementById('bingo-card');
    const bingoMessage = document.getElementById('bingo-message');
    const resetButton = document.getElementById('reset-button');
    bingoCard.innerHTML = '';
    bingoMessage.textContent = '';
    resetButton.style.display = 'none';
    bingoAchieved = false;

    const selectedWords = generateCard();
    const cardSize = 5;
    const middleCellIndex = Math.floor(cardSize * cardSize / 2);

    for (let i = 0; i < cardSize * cardSize; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');

        const front = document.createElement('div');
        front.classList.add('front');
        const back = document.createElement('div');
        back.classList.add('back');

        if (i === middleCellIndex) {
            front.textContent = "FREE";
            back.textContent = "FREE";
            cell.classList.add('marked');
        } else {
            front.textContent = selectedWords.pop();
            back.textContent = front.textContent;
        }

        cell.appendChild(front);
        cell.appendChild(back);

        cell.addEventListener('click', () => {
            // Prevent toggling the middle "FREE" space
            if (i !== middleCellIndex) {
                cell.classList.toggle('marked');
                cell.classList.toggle('flipped');
                checkBingo();
            }
        });

        bingoCard.appendChild(cell);
    }
}

// Check for a Bingo
function checkBingo() {
    const cells = document.querySelectorAll('.cell');
    const marked = Array.from(cells).map(cell => cell.classList.contains('marked'));
    const size = 5;

    // Check rows, columns, and diagonals
    const isBingo = checkLines(marked, size);

    const bingoMessage = document.getElementById('bingo-message');
    const resetButton = document.getElementById('reset-button');

    if (isBingo && !bingoAchieved) {
        bingoAchieved = true;
        bingoMessage.textContent = "Bingo!";
        resetButton.style.display = 'block';
        createFireworks();
    } else if (!isBingo && bingoAchieved) {
        bingoAchieved = false;
        bingoMessage.textContent = '';
        resetButton.style.display = 'none';
    }
}

// Check rows, columns, and diagonals for a Bingo
function checkLines(marked, size) {
    // Check rows and columns
    for (let i = 0; i < size; i++) {
        if (marked.slice(i * size, (i + 1) * size).every(m => m)) return true;
        if (marked.filter((_, index) => index % size === i).every(m => m)) return true;
    }

    // Check diagonals
    if (marked.filter((_, index) => index % (size + 1) === 0).every(m => m)) return true;
    if (marked.filter((_, index) => index % (size - 1) === 0 && index !== 0 && index !== size * size - 1).every(m => m)) return true;

    return false;
}

// Create fireworks animation
function createFireworks() {
    const container = document.body;
    for (let i = 0; i < 150; i++) {
        const firework = document.createElement('div');
        firework.classList.add('firework');
        firework.style.left = `${Math.random() * 100}vw`;
        firework.style.top = `${Math.random() * 100}vh`;
        container.appendChild(firework);
        setTimeout(() => firework.remove(), 1000);
    }
}

// Reset the Bingo card
document.getElementById('reset-button').addEventListener('click', createBingoCard);

// Initialize the Bingo card
createBingoCard();
