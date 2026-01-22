// ============ FIREBASE CONFIG ============
const firebaseConfig = {
    apiKey: "AIzaSyC6hSxIsfCADnYtnRJsmYMzbT2RmyLX0wc",
    authDomain: "sos-game-55b45.firebaseapp.com",
    databaseURL: "https://sos-game-55b45-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sos-game-55b45",
    storageBucket: "sos-game-55b45.firebasestorage.app",
    messagingSenderId: "134808829880",
    appId: "1:134808829880:web:846ae8a2eb9fd2c85ad94d"
};

// Initialize Firebase
let db = null;
let isOnlineMode = false;
let roomCode = null;
let roomRef = null;
let myPlayerId = null;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.warn("Firebase not configured:", e);
}

// DOM Elements
const modePanel = document.getElementById('modePanel');
const setupPanel = document.getElementById('setupPanel');
const lobbyPanel = document.getElementById('lobbyPanel');
const gameUI = document.getElementById('gameUI');
const boardEl = document.getElementById('board');
const svg = document.getElementById('svgLayer');
const logEl = document.getElementById('log');
const playerCardsContainer = document.getElementById('playerCardsContainer');
const globalTimer = document.getElementById('globalTimer');
const globalTimerDisplay = document.getElementById('globalTimerDisplay');

// Mode buttons
const localBtn = document.getElementById('localBtn');
const aiBtn = document.getElementById('aiBtn');
const createOnlineBtn = document.getElementById('createOnlineBtn');
const joinOnlineBtn = document.getElementById('joinOnlineBtn');
const backToModeBtn = document.getElementById('backToModeBtn');

// Timer elements
const timerCheckbox = document.getElementById('timerCheckbox');
const timerSettings = document.getElementById('timerSettings');
const timerDurationSelect = document.getElementById('timerDuration');

const timerCheckboxAI = document.getElementById('timerCheckboxAI');
const timerSettingsAI = document.getElementById('timerSettingsAI');
const timerDurationAI = document.getElementById('timerDurationAI');

const onlineTimerCheckbox = document.getElementById('onlineTimerCheckbox');
const onlineTimerSettings = document.getElementById('onlineTimerSettings');
const onlineTimerDuration = document.getElementById('onlineTimerDuration');

// AI setup elements
const aiSetupPanel = document.getElementById('aiSetupPanel');
const startAIBtn = document.getElementById('startAIBtn');
const backAIBtn = document.getElementById('backAIBtn');
const customSizeCheckAI = document.getElementById('customSizeCheckAI');
const squareSizeAI = document.getElementById('squareSizeAI');
const customSizeAI = document.getElementById('customSizeAI');

// Custom size elements
const customSizeCheck = document.getElementById('customSizeCheck');
const squareSize = document.getElementById('squareSize');
const customSize = document.getElementById('customSize');

// Lobby elements
const createLobby = document.getElementById('createLobby');
const joinLobby = document.getElementById('joinLobby');
const waitingRoom = document.getElementById('waitingRoom');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const startOnlineBtn = document.getElementById('startOnlineBtn');
const displayRoomCode = document.getElementById('displayRoomCode');
const playerList = document.getElementById('playerList');

// Local game elements
const startBtn = document.getElementById('startBtn');
const backBtn = document.getElementById('backBtn');
const menuBtn = document.getElementById('menuBtn');
const playerCountSelect = document.getElementById('playerCount');
const playersContainer = document.getElementById('playersContainer');
const gridSizeIn = document.getElementById('gridSize');

// Modal
const modal = document.getElementById('gameOverModal');
const winnerText = document.getElementById('winnerText');
const finalScore = document.getElementById('finalScore');
const modalRestartBtn = document.getElementById('modalRestartBtn');
const modalMenuBtn = document.getElementById('modalMenuBtn');

// Default colors and names
const defaultColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
const defaultNames = ['Blue', 'Red', 'Green', 'Orange', 'Purple'];

// Game State
let n = 8;
let boardWidth = 8;
let boardHeight = 8;
let board = [];
let players = [];
let current = 0;
let scores = [];
let matchedSet = new Set();
let history = [];
let aiEnabled = false;
let aiPlayerIndex = -1;

// Timer state
let timerEnabled = false;
let timerDuration = 120; // seconds (2 minutes default)
let timerInterval = null;
let timeLeft = 0;
let turnStartTime = null;
let playerTimerElements = [];

// ============ UTILITY FUNCTIONS ============
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

// Format time as MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Start the timer
function startTimer() {
    if (!timerEnabled) {
        globalTimer.classList.add('hidden');
        updatePlayerTimers();
        return;
    }

    globalTimer.classList.remove('hidden');
    timeLeft = timerDuration;
    turnStartTime = Date.now();
    updateTimerDisplays();

    // Clear existing interval
    if (timerInterval) clearInterval(timerInterval);

    // Start new interval
    timerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - turnStartTime) / 1000);
        timeLeft = Math.max(0, timerDuration - elapsedSeconds);
        updateTimerDisplays();

        if (timeLeft <= 0) {
            timerExpired();
        }
    }, 1000);
}

// Stop the timer
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Update all timer displays
function updateTimerDisplays() {
    updateGlobalTimerDisplay();
    updatePlayerTimers();
}

// Update global timer display
function updateGlobalTimerDisplay() {
    globalTimerDisplay.textContent = formatTime(timeLeft);

    // Remove previous classes
    globalTimerDisplay.classList.remove('warning', 'danger');

    // Add warning classes based on time left
    if (timeLeft <= 30) {
        globalTimerDisplay.classList.add('danger');
    } else if (timeLeft <= 60) {
        globalTimerDisplay.classList.add('warning');
    }
}

// Update player card timers - ALWAYS show MM:SS format
function updatePlayerTimers() {
    playerTimerElements.forEach((timerEl, idx) => {
        if (idx === current && timerEnabled) {
            timerEl.textContent = formatTime(timeLeft);
            timerEl.classList.remove('warning', 'danger');

            // Add warning classes based on time left
            if (timeLeft <= 30) {
                timerEl.classList.add('danger');
            } else if (timeLeft <= 60) {
                timerEl.classList.add('warning');
            }
        } else {
            timerEl.textContent = '';
            timerEl.classList.remove('warning', 'danger');
        }
    });
}

// Handle timer expiration
function timerExpired() {
    stopTimer();
    log(`${players[current].name}'s time expired!`);

    // Make a random move for the current player
    const emptyCells = [];
    for (let r = 0; r < boardHeight; r++) {
        for (let c = 0; c < boardWidth; c++) {
            if (board[r][c] === null) {
                emptyCells.push({ r, c });
            }
        }
    }

    if (emptyCells.length > 0) {
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const randomLetter = Math.random() > 0.5 ? 'S' : 'O';
        makeMove(randomCell.r, randomCell.c, randomLetter, true);
    } else {
        // No empty cells, game over
        endGame();
    }
}

// Reset timer for new turn
function resetTimerForNewTurn() {
    stopTimer();

    if (timerEnabled && !isFull()) {
        // Wait a moment before starting timer for next player
        setTimeout(startTimer, 500);
    }
}

// ============ TIMER SETUP HANDLERS ============
// Local timer checkbox handler
timerCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        timerSettings.classList.add('hidden');
    } else {
        timerSettings.classList.remove('hidden');
    }
});

// AI timer checkbox handler
timerCheckboxAI.addEventListener('change', (e) => {
    if (e.target.checked) {
        timerSettingsAI.classList.add('hidden');
    } else {
        timerSettingsAI.classList.remove('hidden');
    }
});

// Online timer checkbox handler
onlineTimerCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        onlineTimerSettings.classList.add('hidden');
    } else {
        onlineTimerSettings.classList.remove('hidden');
    }
});

// ============ MODE SELECTION ============
localBtn.addEventListener('click', () => {
    isOnlineMode = false;
    aiEnabled = false;
    modePanel.classList.add('hidden');
    setupPanel.classList.remove('hidden');
    createPlayerInputs();
});

aiBtn.addEventListener('click', () => {
    isOnlineMode = false;
    aiEnabled = true;
    modePanel.classList.add('hidden');
    aiSetupPanel.classList.remove('hidden');
});

createOnlineBtn.addEventListener('click', () => {
    if (!db) {
        alert('Firebase not configured! Please follow setup instructions.');
        return;
    }
    isOnlineMode = true;
    aiEnabled = false;
    modePanel.classList.add('hidden');
    lobbyPanel.classList.remove('hidden');
    createLobby.classList.remove('hidden');
    joinLobby.classList.add('hidden');
    waitingRoom.classList.add('hidden');
});

joinOnlineBtn.addEventListener('click', () => {
    if (!db) {
        alert('Firebase not configured! Please follow setup instructions.');
        return;
    }
    isOnlineMode = true;
    aiEnabled = false;
    modePanel.classList.add('hidden');
    lobbyPanel.classList.remove('hidden');
    createLobby.classList.add('hidden');
    joinLobby.classList.remove('hidden');
    waitingRoom.classList.add('hidden');
});

backToModeBtn.addEventListener('click', () => {
    if (roomRef) roomRef.off();
    lobbyPanel.classList.add('hidden');
    setupPanel.classList.add('hidden');
    aiSetupPanel.classList.add('hidden');
    modePanel.classList.remove('hidden');
});

backBtn.addEventListener('click', () => {
    setupPanel.classList.add('hidden');
    modePanel.classList.remove('hidden');
});

backAIBtn.addEventListener('click', () => {
    aiSetupPanel.classList.add('hidden');
    modePanel.classList.remove('hidden');
});

// Custom size toggles
customSizeCheck.addEventListener('change', (e) => {
    if (e.target.checked) {
        squareSize.classList.add('hidden');
        customSize.classList.remove('hidden');
    } else {
        squareSize.classList.remove('hidden');
        customSize.classList.add('hidden');
    }
});

customSizeCheckAI.addEventListener('change', (e) => {
    if (e.target.checked) {
        squareSizeAI.classList.add('hidden');
        customSizeAI.classList.remove('hidden');
    } else {
        squareSizeAI.classList.remove('hidden');
        customSizeAI.classList.add('hidden');
    }
});

// ============ ONLINE ROOM CREATION ============
createRoomBtn.addEventListener('click', async () => {
    roomCode = generateRoomCode();
    myPlayerId = generatePlayerId();

    const hostName = document.getElementById('hostName').value || 'Player 1';
    const hostColor = document.getElementById('hostColor').value;
    const maxPlayers = parseInt(document.getElementById('onlinePlayerCount').value);
    const gridSize = parseInt(document.getElementById('onlineGridSize').value);

    // Get timer settings
    const useTimer = !document.getElementById('onlineTimerCheckbox').checked;
    const timerMinutes = parseFloat(document.getElementById('onlineTimerDuration').value) || 2;

    const roomData = {
        host: myPlayerId,
        maxPlayers: maxPlayers,
        gridSize: gridSize,
        timerEnabled: useTimer,
        timerDuration: timerMinutes * 60, // Convert to seconds
        players: {
            [myPlayerId]: {
                name: hostName,
                color: hostColor,
                index: 0,
                isHost: true
            }
        },
        gameStarted: false,
        gameState: null
    };

    await db.ref('rooms/' + roomCode).set(roomData);

    displayRoomCode.textContent = roomCode;
    createLobby.classList.add('hidden');
    waitingRoom.classList.remove('hidden');

    listenToRoom();
});

// ============ ONLINE ROOM JOINING ============
joinRoomBtn.addEventListener('click', async () => {
    const code = document.getElementById('roomCodeInput').value.toUpperCase();
    if (code.length !== 6) {
        alert('Please enter a valid 6-character room code');
        return;
    }

    const roomSnapshot = await db.ref('rooms/' + code).once('value');
    if (!roomSnapshot.exists()) {
        alert('Room not found!');
        return;
    }

    const roomData = roomSnapshot.val();
    const playerCount = Object.keys(roomData.players).length;

    if (playerCount >= roomData.maxPlayers) {
        alert('Room is full!');
        return;
    }

    if (roomData.gameStarted) {
        alert('Game already started!');
        return;
    }

    roomCode = code;
    myPlayerId = generatePlayerId();

    const guestName = document.getElementById('guestName').value || 'Player ' + (playerCount + 1);
    const guestColor = document.getElementById('guestColor').value;

    await db.ref('rooms/' + roomCode + '/players/' + myPlayerId).set({
        name: guestName,
        color: guestColor,
        index: playerCount,
        isHost: false
    });

    displayRoomCode.textContent = roomCode;
    joinLobby.classList.add('hidden');
    waitingRoom.classList.remove('hidden');

    listenToRoom();
});

// ============ LISTEN TO ROOM CHANGES ============
function listenToRoom() {
    roomRef = db.ref('rooms/' + roomCode);

    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Update player list
        updatePlayerList(data.players);

        // Check if game started
        if (data.gameStarted && data.gameState) {
            loadOnlineGame(data);
        }

        // Show/hide start button
        const isHost = data.players[myPlayerId]?.isHost;
        startOnlineBtn.style.display = isHost ? 'block' : 'none';
    });
}

function updatePlayerList(playersData) {
    playerList.innerHTML = '';
    Object.values(playersData).sort((a, b) => a.index - b.index).forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `
            <div style="width:16px;height:16px;border-radius:50%;background:${p.color}"></div>
            <span>${p.name}</span>
            ${p.isHost ? '<span style="color:#10b981;margin-left:auto;">HOST</span>' : ''}
        `;
        playerList.appendChild(div);
    });
}

// ============ START ONLINE GAME ============
startOnlineBtn.addEventListener('click', async () => {
    const snapshot = await roomRef.once('value');
    const data = snapshot.val();

    players = Object.entries(data.players)
        .sort(([, a], [, b]) => a.index - b.index)
        .map(([id, p]) => ({ id, ...p }));

    boardWidth = data.gridSize;
    boardHeight = data.gridSize;

    // Set timer from room data
    timerEnabled = data.timerEnabled || false;
    timerDuration = data.timerDuration || 120;

    // Create clean initial board with no undefined values
    const initialBoard = [];
    for (let r = 0; r < boardHeight; r++) {
        initialBoard[r] = [];
        for (let c = 0; c < boardWidth; c++) {
            initialBoard[r][c] = null;
        }
    }

    const initialState = {
        board: initialBoard,
        boardWidth: boardWidth,
        boardHeight: boardHeight,
        current: 0,
        scores: Array(players.length).fill(0),
        history: [],
        matchedSet: [],
        matchedLines: [],
        gameOver: false,
        timerEnabled: timerEnabled,
        timerDuration: timerDuration,
        turnStartTime: Date.now()
    };

    await roomRef.update({
        gameStarted: true
    });

    await roomRef.child('gameState').set(initialState);

    // Wait a bit for Firebase to sync, then load
    setTimeout(() => {
        roomRef.once('value').then(snap => {
            loadOnlineGame(snap.val());
        });
    }, 300);
});

function loadOnlineGame(data) {
    if (!data || !data.gameState) {
        console.error('Invalid game data:', data);
        return;
    }

    lobbyPanel.classList.add('hidden');
    gameUI.classList.remove('hidden');

    players = Object.entries(data.players)
        .sort(([, a], [, b]) => a.index - b.index)
        .map(([id, p]) => ({ id, ...p }));

    // Use boardWidth and boardHeight from gameState
    boardWidth = data.gameState.boardWidth || data.gridSize;
    boardHeight = data.gameState.boardHeight || data.gridSize;

    board = convertFirebaseBoard(data.gameState.board, boardHeight, boardWidth);
    current = data.gameState.current || 0;
    scores = Array.isArray(data.gameState.scores) ? data.gameState.scores : Object.values(data.gameState.scores || {});
    if (scores.length === 0) scores = Array(players.length).fill(0);
    matchedSet = new Set(data.gameState.matchedSet || []);
    history = data.gameState.history || [];

    // Load timer settings
    timerEnabled = data.gameState.timerEnabled || false;
    timerDuration = data.gameState.timerDuration || 120;
    turnStartTime = data.gameState.turnStartTime || Date.now();

    // Calculate time left
    if (timerEnabled && turnStartTime) {
        const elapsed = Math.floor((Date.now() - turnStartTime) / 1000);
        timeLeft = Math.max(0, timerDuration - elapsed);
    } else {
        timeLeft = timerDuration;
    }

    createPlayerCards();
    renderBoardGrid();
    updateScoreboard();
    redrawBoard();

    // Start timer if enabled
    if (timerEnabled) {
        startTimer();
    }

    // Listen for game state changes
    roomRef.child('gameState').off(); // Remove old listeners
    roomRef.child('gameState').on('value', (snapshot) => {
        const state = snapshot.val();
        if (!state) return;

        // Update dimensions if they changed
        const newWidth = state.boardWidth || boardWidth;
        const newHeight = state.boardHeight || boardHeight;

        if (newWidth !== boardWidth || newHeight !== boardHeight) {
            boardWidth = newWidth;
            boardHeight = newHeight;
            renderBoardGrid(); // Re-render grid if dimensions changed
        }

        board = convertFirebaseBoard(state.board, boardHeight, boardWidth);
        current = state.current || 0;
        scores = Array.isArray(state.scores) ? state.scores : Object.values(state.scores || {});
        if (scores.length === 0) scores = Array(players.length).fill(0);
        matchedSet = new Set(state.matchedSet || []);
        history = state.history || [];

        // Update timer
        timerEnabled = state.timerEnabled || false;
        timerDuration = state.timerDuration || 120;
        turnStartTime = state.turnStartTime || Date.now();

        if (timerEnabled && turnStartTime) {
            const elapsed = Math.floor((Date.now() - turnStartTime) / 1000);
            timeLeft = Math.max(0, timerDuration - elapsed);
            updateTimerDisplays();
        }

        // Check if this is a reset (empty history)
        if (history.length === 0 && modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            logEl.innerHTML = '';
            log('Game has been reset by host!');
        }

        updateScoreboard();
        redrawBoard();

        // Redraw all matched lines
        svg.innerHTML = '';
        if (state.matchedLines) {
            state.matchedLines.forEach(line => {
                drawLine(line.coords, line.color);
                highlightCells(line.coords, line.color);
            });
        }

        // Game over condition - check even for empty board
        if (state.gameOver) {
            setTimeout(() => endGame(), 500);
        }
    });
}

// Fixed: Convert Firebase board to proper 2D array
function convertFirebaseBoard(fbBoard, height, width) {
    const newBoard = [];

    // Initialize with null values
    for (let r = 0; r < height; r++) {
        newBoard[r] = [];
        for (let c = 0; c < width; c++) {
            newBoard[r][c] = null;
        }
    }

    if (!fbBoard) return newBoard;

    // Handle both array and object formats
    if (Array.isArray(fbBoard)) {
        for (let r = 0; r < height && r < fbBoard.length; r++) {
            if (fbBoard[r]) {
                if (Array.isArray(fbBoard[r])) {
                    for (let c = 0; c < width && c < fbBoard[r].length; c++) {
                        const val = fbBoard[r][c];
                        newBoard[r][c] = (val === undefined || val === null) ? null : val;
                    }
                } else {
                    // Row is an object
                    const rowData = fbBoard[r];
                    for (let c = 0; c < width; c++) {
                        const val = rowData[c];
                        newBoard[r][c] = (val === undefined || val === null) ? null : val;
                    }
                }
            }
        }
    } else {
        // fbBoard is an object
        for (let r = 0; r < height; r++) {
            if (fbBoard[r]) {
                const rowData = fbBoard[r];
                if (Array.isArray(rowData)) {
                    for (let c = 0; c < width && c < rowData.length; c++) {
                        const val = rowData[c];
                        newBoard[r][c] = (val === undefined || val === null) ? null : val;
                    }
                } else {
                    for (let c = 0; c < width; c++) {
                        const val = rowData[c];
                        newBoard[r][c] = (val === undefined || val === null) ? null : val;
                    }
                }
            }
        }
    }

    return newBoard;
}

// Optimized: Only update changed cells
function redrawBoard() {
    document.querySelectorAll('.cell').forEach(cell => {
        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);

        // Safety check for board structure
        if (!board[r]) return;

        const cellData = board[r][c];

        if (cellData) {
            if (cell.textContent !== cellData.val || cell.style.color !== cellData.color) {
                cell.textContent = cellData.val;
                cell.style.color = cellData.color;
                cell.classList.add('filled');
            }
        } else {
            if (cell.textContent !== '' || cell.classList.contains('filled')) {
                cell.textContent = '';
                cell.style.color = '';
                cell.classList.remove('filled');
                cell.style.boxShadow = '';
                cell.style.background = '';
            }
        }
    });
}

// ============ LOCAL MULTIPLAYER ============
function createPlayerInputs() {
    const count = parseInt(playerCountSelect.value);
    playersContainer.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'player-input';
        div.innerHTML = `
            <label>Player ${i + 1} Name</label>
            <input type="text" id="pName${i}" value="${defaultNames[i]}">
            <label>Color</label>
            <input type="color" id="pColor${i}" value="${defaultColors[i]}">
        `;
        playersContainer.appendChild(div);
    }
}

playerCountSelect.addEventListener('change', createPlayerInputs);

startBtn.addEventListener('click', () => {
    const customSizeEnabled = customSizeCheck.checked;

    if (customSizeEnabled) {
        boardWidth = parseInt(document.getElementById('gridWidth').value);
        boardHeight = parseInt(document.getElementById('gridHeight').value);
        if (boardWidth < 3) boardWidth = 3;
        if (boardWidth > 20) boardWidth = 20;
        if (boardHeight < 3) boardHeight = 3;
        if (boardHeight > 20) boardHeight = 20;
    } else {
        const size = parseInt(gridSizeIn.value);
        boardWidth = size < 3 ? 3 : (size > 20 ? 20 : size);
        boardHeight = boardWidth;
    }

    const count = parseInt(playerCountSelect.value);
    players = [];

    // Get timer settings
    timerEnabled = !document.getElementById('timerCheckbox').checked;
    if (timerEnabled) {
        timerDuration = parseFloat(document.getElementById('timerDuration').value) * 60;
    }

    for (let i = 0; i < count; i++) {
        const nameInput = document.getElementById(`pName${i}`);
        const colorInput = document.getElementById(`pColor${i}`);
        players.push({
            name: nameInput.value || defaultNames[i],
            color: colorInput.value
        });
    }

    resetGame();
    createPlayerCards();

    // Start timer if enabled
    if (timerEnabled) {
        startTimer();
    }

    setupPanel.classList.add('hidden');
    gameUI.classList.remove('hidden');
    log(`Game started: ${players.map(p => p.name).join(' vs ')} (${boardWidth}x${boardHeight})`);
});

// ============ AI MODE ============
startAIBtn.addEventListener('click', () => {
    const customSizeEnabled = customSizeCheckAI.checked;

    if (customSizeEnabled) {
        boardWidth = parseInt(document.getElementById('gridWidthAI').value);
        boardHeight = parseInt(document.getElementById('gridHeightAI').value);
        if (boardWidth < 3) boardWidth = 3;
        if (boardWidth > 20) boardWidth = 20;
        if (boardHeight < 3) boardHeight = 3;
        if (boardHeight > 20) boardHeight = 20;
    } else {
        const size = parseInt(document.getElementById('gridSizeAI').value);
        boardWidth = size < 3 ? 3 : (size > 20 ? 20 : size);
        boardHeight = boardWidth;
    }

    players = [
        {
            name: document.getElementById('aiPlayerName').value || 'Player',
            color: document.getElementById('aiPlayerColor').value,
            isAI: false
        },
        {
            name: document.getElementById('aiName').value || 'AI',
            color: document.getElementById('aiColor').value,
            isAI: true
        }
    ];

    // Get timer settings for AI mode
    timerEnabled = !document.getElementById('timerCheckboxAI').checked;
    if (timerEnabled) {
        timerDuration = parseFloat(document.getElementById('timerDurationAI').value) * 60;
    }

    aiPlayerIndex = 1;

    resetGame();
    createPlayerCards();

    // Start timer if enabled
    if (timerEnabled) {
        startTimer();
    }

    aiSetupPanel.classList.add('hidden');
    gameUI.classList.remove('hidden');
    log(`AI Game started: ${players[0].name} vs ${players[1].name} (${boardWidth}x${boardHeight})`);
});

menuBtn.addEventListener('click', () => {
    if (confirm("Exit current game?")) {
        if (roomRef) roomRef.off();
        goToMenu();
    }
});

modalMenuBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    if (roomRef) {
        roomRef.off();
        // Clean up the room if host
        if (isOnlineMode && players.length > 0) {
            const myPlayer = players.find(p => p.id === myPlayerId);
            if (myPlayer && myPlayer.isHost) {
                roomRef.remove();
            }
        }
    }
    goToMenu();
});

modalRestartBtn.addEventListener('click', async () => {
    modal.classList.add('hidden');
    stopTimer();

    if (isOnlineMode) {
        // Only host can restart online games
        const myPlayer = players.find(p => p.id === myPlayerId);
        if (!myPlayer || !myPlayer.isHost) {
            alert('Only the host can restart the game!');
            return;
        }

        // Reset game state in Firebase with clean board
        const initialBoard = [];
        for (let r = 0; r < boardHeight; r++) {
            initialBoard[r] = [];
            for (let c = 0; c < boardWidth; c++) {
                initialBoard[r][c] = null;
            }
        }

        const initialState = {
            board: initialBoard,
            boardWidth: boardWidth,
            boardHeight: boardHeight,
            current: 0,
            scores: Array(players.length).fill(0),
            history: [],
            matchedSet: [],
            matchedLines: [],
            gameOver: false,
            timerEnabled: timerEnabled,
            timerDuration: timerDuration,
            turnStartTime: Date.now()
        };

        await roomRef.child('gameState').set(initialState);

        // Local reset will happen via Firebase listener
    } else {
        resetGame();

        // If AI game, check if AI goes first
        if (aiEnabled && current === aiPlayerIndex) {
            setTimeout(() => makeAIMove(), 800);
        }

        // Start timer if enabled
        if (timerEnabled) {
            startTimer();
        }
    }
});

function goToMenu() {
    stopTimer();
    gameUI.classList.add('hidden');
    setupPanel.classList.add('hidden');
    lobbyPanel.classList.add('hidden');
    aiSetupPanel.classList.add('hidden');
    modePanel.classList.remove('hidden');
    isOnlineMode = false;
    aiEnabled = false;
    roomCode = null;
    timerEnabled = false;
}

function createPlayerCards() {
    playerCardsContainer.innerHTML = '';
    playerTimerElements = [];

    // Menu button
    const menuButton = document.createElement('button');
    menuButton.className = 'secondary';
    menuButton.id = 'menuBtn';
    menuButton.style.background = '#475569';
    menuButton.textContent = 'Back to Menu';
    menuButton.addEventListener('click', () => {
        if (confirm("Exit current game?")) {
            if (roomRef) roomRef.off();
            goToMenu();
        }
    });
    playerCardsContainer.appendChild(menuButton);

    // End Game button (host only, online only)
    if (isOnlineMode && players.length > 0) {
        const myPlayer = players.find(p => p.id === myPlayerId);
        if (myPlayer && myPlayer.isHost) {
            const endGameBtn = document.createElement('button');
            endGameBtn.className = 'secondary';
            endGameBtn.style.background = '#ef4444';
            endGameBtn.textContent = 'End Game';
            endGameBtn.addEventListener('click', async () => {
                if (confirm('End the game for all players?')) {
                    await roomRef.child('gameState').update({ gameOver: true });
                    endGame();
                }
            });
            playerCardsContainer.appendChild(endGameBtn);
        }
    }

    players.forEach((player, idx) => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.id = `card${idx}`;
        card.innerHTML = `
            <div style="width:12px; height:12px; border-radius:50%; background:${player.color}"></div>
            <div>
                <div class="player-score" id="score${idx}">0</div>
                <div class="player-name">${player.name}</div>
            </div>
            <div class="player-timer" id="playerTimer${idx}"></div>
        `;
        playerCardsContainer.appendChild(card);

        // Store timer element reference
        playerTimerElements.push(document.getElementById(`playerTimer${idx}`));
    });
}

function resetGame() {
    // Create clean board with no undefined values
    board = [];
    for (let r = 0; r < boardHeight; r++) {
        board[r] = [];
        for (let c = 0; c < boardWidth; c++) {
            board[r][c] = null;
        }
    }

    matchedSet.clear();
    history = [];
    scores = Array(players.length).fill(0);
    current = 0;
    logEl.innerHTML = '';
    svg.innerHTML = '';
    turnStartTime = Date.now();

    renderBoardGrid();
    updateScoreboard();

    log('Game reset!');
}

function renderBoardGrid() {
    boardEl.innerHTML = '';
    const maxSize = 650;
    const totalGapWidth = (boardWidth - 1) * 4;
    const totalGapHeight = (boardHeight - 1) * 4;
    const cellWidth = Math.floor((maxSize - totalGapWidth) / boardWidth);
    const cellHeight = Math.floor((maxSize - totalGapHeight) / boardHeight);
    const cellSize = Math.min(cellWidth, cellHeight);

    boardEl.style.gridTemplateColumns = `repeat(${boardWidth}, ${cellSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${boardHeight}, ${cellSize}px)`;
    boardEl.style.width = 'fit-content';
    boardEl.style.setProperty('--cell-size', cellSize + 'px');

    for (let r = 0; r < boardHeight; r++) {
        for (let c = 0; c < boardWidth; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.addEventListener('click', handleCellClick);
            boardEl.appendChild(cell);
        }
    }
}

function handleCellClick(e) {
    const r = parseInt(e.target.dataset.r);
    const c = parseInt(e.target.dataset.c);

    // Defensive check for board structure
    if (!board[r] || board[r][c] !== null) return;

    // Disable clicks if it's AI's turn
    if (aiEnabled && current === aiPlayerIndex) {
        return;
    }

    // Check if it's this player's turn in online mode
    if (isOnlineMode) {
        const myIndex = players.findIndex(p => p.id === myPlayerId);
        if (myIndex !== current) {
            log("Not your turn!");
            return;
        }
    }

    document.querySelectorAll('.chooser').forEach(el => el.remove());
    createChooser(e.target, r, c);
}

function createChooser(cellEl, r, c) {
    const chooser = document.createElement('div');
    chooser.className = 'chooser';
    chooser.style.background = players[current].color;

    const btnS = document.createElement('button'); btnS.textContent = 'S';
    const btnO = document.createElement('button'); btnO.textContent = 'O';

    btnS.onclick = () => makeMove(r, c, 'S');
    btnO.onclick = () => makeMove(r, c, 'O');

    chooser.appendChild(btnS);
    chooser.appendChild(btnO);
    document.body.appendChild(chooser);

    const rect = cellEl.getBoundingClientRect();
    chooser.style.top = (rect.top + window.scrollY - 50) + 'px';
    chooser.style.left = (rect.left + window.scrollX + (rect.width / 2) - 50) + 'px';

    setTimeout(() => {
        const closeHandler = (ev) => {
            if (!chooser.contains(ev.target)) {
                chooser.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 0);
}

// Clean board data for Firebase (no undefined values allowed)
function cleanBoardForFirebase(board) {
    const cleaned = [];
    for (let r = 0; r < boardHeight; r++) {
        cleaned[r] = [];
        for (let c = 0; c < boardWidth; c++) {
            const cell = board[r] ? board[r][c] : null;
            cleaned[r][c] = (cell === undefined || cell === null) ? null : cell;
        }
    }
    return cleaned;
}

async function makeMove(r, c, letter, isTimeoutMove = false) {
    document.querySelectorAll('.chooser').forEach(el => el.remove());

    board[r][c] = { val: letter, color: players[current].color };
    history.push({ r, c, val: letter, playerIdx: current });

    const cell = getCell(r, c);
    cell.textContent = letter;
    cell.style.color = players[current].color;
    cell.classList.add('filled');

    const newMatches = checkSOS(r, c);
    let matchedLines = [];

    if (newMatches.length > 0) {
        scores[current] += newMatches.length;
        newMatches.forEach(m => {
            matchedSet.add(m.id);
            drawLine(m.coords, players[current].color);
            highlightCells(m.coords, players[current].color);
            // Store line data for Firebase sync
            matchedLines.push({ coords: m.coords, color: players[current].color });
        });
        if (isTimeoutMove) {
            log(`${players[current].name} scored ${newMatches.length} point(s) on timeout!`);
        } else {
            log(`${players[current].name} scored ${newMatches.length} point(s)!`);
        }
    } else {
        current = (current + 1) % players.length;
    }

    updateScoreboard();

    // Reset timer for new turn
    resetTimerForNewTurn();

    // Update Firebase if online
    if (isOnlineMode && roomRef) {
        try {
            const snapshot = await roomRef.child('gameState').once('value');
            const currentState = snapshot.val() || {};
            const existingLines = currentState.matchedLines || [];

            // Clean board data - remove any undefined values
            const cleanedBoard = cleanBoardForFirebase(board);

            await roomRef.child('gameState').set({
                board: cleanedBoard,
                boardWidth: boardWidth,
                boardHeight: boardHeight,
                current: current,
                scores: scores,
                history: history,
                matchedSet: Array.from(matchedSet),
                matchedLines: [...existingLines, ...matchedLines],
                gameOver: isFull(),
                timerEnabled: timerEnabled,
                timerDuration: timerDuration,
                turnStartTime: Date.now()
            });
        } catch (error) {
            console.error('Firebase update error:', error);
            // Try to recover by reloading state
            const snapshot = await roomRef.once('value');
            const data = snapshot.val();
            if (data && data.gameState) {
                loadOnlineGame(data);
            }
        }
    }

    if (isFull()) {
        endGame();
    } else if (aiEnabled && current === aiPlayerIndex) {
        // AI's turn
        setTimeout(() => makeAIMove(), 800);
    }
}

function checkSOS(r, c) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let matches = [];

    const getVal = (row, col) => {
        if (row < 0 || col < 0 || row >= boardHeight || col >= boardWidth) return '';
        if (!board[row] || !board[row][col]) return '';
        return board[row][col].val || '';
    };

    dirs.forEach(([dr, dc]) => {
        const sequences = [
            [[0, 0], [dr, dc], [dr * 2, dc * 2]],
            [[-dr, -dc], [0, 0], [dr, dc]],
            [[-dr * 2, -dc * 2], [-dr, -dc], [0, 0]]
        ];

        sequences.forEach(seq => {
            const chars = seq.map(offset => getVal(r + offset[0], c + offset[1]));
            if (chars.join('') === 'SOS') {
                const coords = seq.map(offset => [r + offset[0], c + offset[1]]);
                const id = coords.map(p => p.join(',')).sort().join('|');
                if (!matchedSet.has(id)) {
                    matches.push({ id, coords });
                }
            }
        });
    });
    return matches;
}

// ============ AI LOGIC ============
function makeAIMove() {
    const difficulty = document.getElementById('aiDifficulty')?.value || 'medium';

    let move = null;

    if (difficulty === 'medium') {
        // Try to score first
        move = findScoringMove();

        // If no scoring move, try to block opponent
        if (!move) {
            move = findBlockingMove();
        }
    }

    // If no smart move found, make random move
    if (!move) {
        move = findRandomMove();
    }

    if (move) {
        makeMove(move.r, move.c, move.letter);
    }
}

function findScoringMove() {
    // Try each empty cell with both S and O
    for (let r = 0; r < boardHeight; r++) {
        for (let c = 0; c < boardWidth; c++) {
            if (board[r][c] === null) {
                // Try S
                board[r][c] = { val: 'S', color: players[current].color };
                const matchesS = checkSOS(r, c);
                board[r][c] = null;

                if (matchesS.length > 0) {
                    return { r, c, letter: 'S' };
                }

                // Try O
                board[r][c] = { val: 'O', color: players[current].color };
                const matchesO = checkSOS(r, c);
                board[r][c] = null;

                if (matchesO.length > 0) {
                    return { r, c, letter: 'O' };
                }
            }
        }
    }
    return null;
}

function findBlockingMove() {
    // Check if opponent can score on next turn
    const opponentIdx = (current + 1) % players.length;

    for (let r = 0; r < boardHeight; r++) {
        for (let c = 0; c < boardWidth; c++) {
            if (board[r][c] === null) {
                // Check if opponent can score with S
                board[r][c] = { val: 'S', color: players[opponentIdx].color };
                const matchesS = checkSOS(r, c);
                board[r][c] = null;

                if (matchesS.length > 0) {
                    // Block with random letter
                    return { r, c, letter: Math.random() > 0.5 ? 'S' : 'O' };
                }

                // Check if opponent can score with O
                board[r][c] = { val: 'O', color: players[opponentIdx].color };
                const matchesO = checkSOS(r, c);
                board[r][c] = null;

                if (matchesO.length > 0) {
                    return { r, c, letter: Math.random() > 0.5 ? 'S' : 'O' };
                }
            }
        }
    }
    return null;
}

function findRandomMove() {
    const emptyCells = [];
    for (let r = 0; r < boardHeight; r++) {
        for (let c = 0; c < boardWidth; c++) {
            if (board[r][c] === null) {
                emptyCells.push({ r, c });
            }
        }
    }

    if (emptyCells.length > 0) {
        const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        return { ...cell, letter: Math.random() > 0.5 ? 'S' : 'O' };
    }
    return null;
}

function drawLine(coords, color) {
    const c1 = getCell(coords[0][0], coords[0][1]);
    const c3 = getCell(coords[2][0], coords[2][1]);
    if (!c1 || !c3) return;

    const r1 = c1.getBoundingClientRect();
    const r3 = c3.getBoundingClientRect();
    const containerRect = document.querySelector('.board-container').getBoundingClientRect();

    const x1 = (r1.left - containerRect.left + r1.width / 2) - 16;
    const y1 = (r1.top - containerRect.top + r1.height / 2) - 16;
    const x2 = (r3.left - containerRect.left + r3.width / 2) - 16;
    const y2 = (r3.top - containerRect.top + r3.height / 2) - 16;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1); line.setAttribute("y1", y1);
    line.setAttribute("x2", x2); line.setAttribute("y2", y2);
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "6");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", "0.8");

    svg.appendChild(line);
}

function highlightCells(coords, color) {
    coords.forEach(([r, c]) => {
        const cell = getCell(r, c);
        cell.style.boxShadow = `inset 0 0 0 4px ${color}40`;
        cell.style.background = `${color}10`;
    });
}

function updateScoreboard() {
    players.forEach((player, idx) => {
        const scoreEl = document.getElementById(`score${idx}`);
        const cardEl = document.getElementById(`card${idx}`);

        // Ensure scores array exists and has proper length
        if (!scores[idx] && scores[idx] !== 0) scores[idx] = 0;

        if (scoreEl) scoreEl.textContent = scores[idx];

        if (cardEl) {
            if (idx === current) {
                cardEl.classList.add('active');
                cardEl.style.setProperty('--active-color', player.color);
            } else {
                cardEl.classList.remove('active');
            }
        }
    });
}

function isFull() {
    return history.length === (boardWidth * boardHeight);
}

function endGame() {
    stopTimer();
    const maxScore = Math.max(...scores);
    const winners = players.filter((p, idx) => scores[idx] === maxScore);

    let winnerMsg = '';
    let color = '#fff';

    if (winners.length === 1) {
        winnerMsg = `${winners[0].name} WON!`;
        color = winners[0].color;
    } else {
        winnerMsg = "IT'S A DRAW!";
        color = '#e2e8f0';
    }

    winnerText.textContent = winnerMsg;
    winnerText.style.color = color;

    const scoreText = players.map((p, idx) => `${p.name}: ${scores[idx]}`).join(' | ');
    finalScore.textContent = scoreText;

    // Show/hide Play Again button based on mode and role
    if (isOnlineMode) {
        const myPlayer = players.find(p => p.id === myPlayerId);
        modalRestartBtn.style.display = (myPlayer && myPlayer.isHost) ? 'block' : 'none';
    } else {
        modalRestartBtn.style.display = 'block';
    }

    modal.classList.remove('hidden');
    log(`--- GAME OVER: ${winnerMsg} ---`);
}

function getCell(r, c) {
    return document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
}

function log(msg) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.prepend(div);
}