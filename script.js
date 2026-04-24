// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.warn("Firebase failed. Switching to Offline Mode.");
}

// --- GAME STATE ---
let roomCode = null;
let playerRole = null; // 1 or 2
let isOffline = false;
let gameActive = false;

const characters = [
    { name: 'Iron Man', color: '#ff0000', special: 'Beam' },
    { name: 'Batman', color: '#333333', special: 'Batarang' },
    { name: 'Spider-Man', color: '#e62117', special: 'Web' },
    { name: 'Cap. America', color: '#0000ff', special: 'Shield' },
    { name: 'Hulk', color: '#2ecc71', special: 'Smash' },
    { name: 'Venom', color: '#111', special: 'Tendril' },
    { name: 'Harry Potter', color: '#740001', special: 'Expelliarmus' },
    { name: 'Ben 10', color: '#00ff00', special: 'Omni' }
];

let p1Data = { x: 100, y: 300, hp: 100, char: null, action: 'idle' };
let p2Data = { x: 600, y: 300, hp: 100, char: null, action: 'idle' };

// --- STARTUP LOGIC ---
window.addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('splash-screen');
    const home = document.getElementById('home-screen');
    
    setTimeout(() => {
        splash.classList.remove('active');
        home.classList.add('active');
    }, 1500);
});

// --- MULTIPLAYER LOGIC ---
function createRoom() {
    roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    playerRole = 1;
    document.getElementById('room-display').innerText = `ROOM: ${roomCode}`;
    document.getElementById('home-screen').classList.remove('active');
    document.getElementById('room-screen').classList.add('active');
    document.getElementById('join-input-area').style.display = 'none';

    db.ref('rooms/' + roomCode).set({
        status: 'waiting',
        p1: p1Data,
        p2: p2Data
    });

    db.ref('rooms/' + roomCode + '/p2').on('change', (snapshot) => {
        if(snapshot.exists()) startCharSelect();
    });
}

function joinRoom() {
    const input = document.getElementById('room-input').value;
    db.ref('rooms/' + input).once('value', (snap) => {
        if(snap.exists()) {
            roomCode = input;
            playerRole = 2;
            startCharSelect();
        } else {
            alert("Room not found!");
        }
    });
}

function startOffline() {
    isOffline = true;
    playerRole = 1;
    startCharSelect();
}

// --- CHARACTER SELECTION ---
function startCharSelect() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('select-screen').classList.add('active');
    
    const grid = document.getElementById('char-grid');
    characters.forEach((char, index) => {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.innerHTML = `<div style="padding:10px">${char.name}</div>`;
        card.onclick = () => selectCharacter(index);
        grid.appendChild(card);
    });
}

function selectCharacter(index) {
    if(playerRole === 1 && !p1Data.char) {
        p1Data.char = characters[index];
        if(!isOffline) db.ref(`rooms/${roomCode}/p1/char`).set(characters[index]);
        document.getElementById('p1-preview').innerText = "P1: " + characters[index].name;
    } else if (playerRole === 2 && !p2Data.char) {
        p2Data.char = characters[index];
        if(!isOffline) db.ref(`rooms/${roomCode}/p2/char`).set(characters[index]);
        document.getElementById('p2-preview').innerText = "P2: " + characters[index].name;
    }
    
    // Check if both selected
    if(isOffline) { p2Data.char = characters[1]; startGame(); }
    else {
        db.ref(`rooms/${roomCode}`).on('value', (snap) => {
            const data = snap.val();
            if(data.p1.char && data.p2.char) startGame();
        });
    }
}

// --- GAME ENGINE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 400;

function startGame() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('game-screen').classList.add('active');
    gameActive = true;
    update();
}

function update() {
    if(!gameActive) return;
    
    // Physics & Sync
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Players
    drawPlayer(p1Data);
    drawPlayer(p2Data);
    
    // Health UI
    document.getElementById('p1-health-fill').style.width = p1Data.hp + '%';
    document.getElementById('p2-health-fill').style.width = p2Data.hp + '%';

    if(p1Data.hp <= 0 || p2Data.hp <= 0) endGame();

    requestAnimationFrame(update);
}

function drawPlayer(p) {
    ctx.fillStyle = p.char ? p.char.color : 'white';
    ctx.fillRect(p.x, p.y, 50, 80);
}

// Control Listeners
window.addEventListener('keydown', (e) => {
    if(!gameActive) return;
    // Simple Movement Logic
    if(playerRole === 1) {
        if(e.key === 'd') p1Data.x += 10;
        if(e.key === 'a') p1Data.x -= 10;
        if(e.key === 'f') attack(1);
    } else {
        if(e.key === 'ArrowRight') p2Data.x += 10;
        if(e.key === 'ArrowLeft') p2Data.x -= 10;
        if(e.key === 'k') attack(2);
    }
    syncPos();
});

function attack(pNum) {
    if(pNum === 1 && Math.abs(p1Data.x - p2Data.x) < 60) p2Data.hp -= 5;
    if(pNum === 2 && Math.abs(p2Data.x - p1Data.x) < 60) p1Data.hp -= 5;
}

function syncPos() {
    if(isOffline) return;
    const ref = playerRole === 1 ? 'p1' : 'p2';
    db.ref(`rooms/${roomCode}/${ref}`).update(playerRole === 1 ? p1Data : p2Data);
}

function endGame() {
    gameActive = false;
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('winner-screen').classList.add('active');
    document.getElementById('winner-text').innerText = p1Data.hp > 0 ? "PLAYER 1 WINS!" : "PLAYER 2 WINS!";
}