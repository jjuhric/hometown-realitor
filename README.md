# 🎲 Monopoly: Network LAN & Cloud Multiplayer Edition

A complete, responsive, full-stack Monopoly board game built for **local network multiplayer (Version 1)**, **smooth transition graphics and animations (Version 1.5)**, and **cloud hosting on AWS / GCP (Version 2)**.

Features a full rules engine with customizable **"House Rules"** (Free Parking Jackpot, Double GO Payout, Snake Eyes Bonus, No Rent in Jail, Auctions on/off, starting cash, etc.) and atomic **Game State Persistence** that survives Wi-Fi disconnects, browser refreshes, and server reboots.

---

## 🌟 Key Features

### 1. Modifiable House Rules Engine
Toggle and tune house rules directly when creating a room:
- **Free Parking Jackpot**: All taxes (Income & Luxury Tax), Jail fines ($50), and Chance/Chest fines are deposited into a central pot in the middle of the board. Landing on Free Parking awards the entire pot (with customizable seed money)!
- **Double Salary on GO**: Passing GO pays the standard $200, but landing directly on GO pays $400 ($200 + $200 bonus)!
- **No Rent While In Jail**: Impoverish campouts or protect inmates: players in jail cannot collect rent from other players.
- **Lucky Roller (Snake Eyes $500)**: Rolling double ones (1-1) awards an instant $500 bank payout.
- **Auctions On/Off**: When a player declines an unowned property, trigger a public auction or leave it unowned.
- **Unlimited Houses/Hotels**: Bypass standard 32-house / 12-hotel scarcity caps.
- **Custom Starting Cash**: Configurable from $500 to $3,000.
- **Mercy Wealth Goal**: Option to end game when a player achieves a target net worth.

### 2. Version 1: 2D Overhead Board & LAN Multiplayer
- Complete 40-space top-down board with color groups, railroads, utilities, taxes, jail, chance, community chest, and GO.
- Local Network auto-detection: displays your local IP (e.g. `http://192.168.1.50:3000`) and provides a 1-click link to share with friends on the same Wi-Fi.
- Playable on any phone, tablet, laptop, or desktop browser.

### 3. Version 1.5: Transition Graphics & Synthesized Audio FX
- **Piece Traversal Transitions**: Tokens smoothly hop tile-by-tile around the board and turn corners with sound effects.
- **3D Tumbling Dice Roll**: Animated dice rattle and roll on the center stage tray before locking in results.
- **Card Reveal Animations**: Chance and Community Chest cards slide and flip in with visual flair.
- **Floating Money Tags**: `+$200` and `-$50` float up and fade away over tiles during transactions.
- **Procedural Sound FX**: Uses Web Audio API (dice rattle, cash chime, gavel strike, jail cell clank, victory fanfare) with zero external media files needed.

### 4. Game State Persistence & Session Recovery
- Every dice roll, trade, property purchase, and building upgrade is saved atomically to `server/storage/rooms/<roomId>.json`.
- Browser tokens stored in `localStorage` allow players who refresh, disconnect, or restart to seamlessly re-enter their exact seat, money, and cards without interruption.

### 5. Version 2: AWS & Google Cloud Readiness
- Pre-configured `Dockerfile` and `docker-compose.yml`.
- See `CLOUD_DEPLOYMENT.md` for zero-friction deployment to Google Cloud Run or AWS App Runner / Lightsail.

---

## 🚀 How to Run Locally (LAN)

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation & Launch
```bash
# Navigate to the project directory
cd monopoly-game

# Install dependencies
npm install

# Run automated tests
npm test

# Start the game server
npm start
```

Once started, the console will print:
```text
====================================================
  🎲 MONOPOLY NETWORK MULTIPLAYER SERVER (V1 & V1.5) 🎲
====================================================
  Local URL:   http://localhost:3000
  LAN URL:     http://192.168.x.x:3000
  Share the LAN URL with friends on your local Wi-Fi!
====================================================
```

Open `http://localhost:3000` on your machine, or share the `LAN URL` with friends connected to your Wi-Fi router.

---

## 📁 Project Structure

```
monopoly-game/
├── package.json               # Scripts and dependencies (express, ws)
├── Dockerfile                 # Version 2 Cloud containerization
├── docker-compose.yml         # Container compose with persistent volume
├── CLOUD_DEPLOYMENT.md        # AWS & GCP deployment guides
├── README.md                  # Project documentation
├── server/
│   ├── server.js              # Express app + WebSocket server + LAN IP detection
│   ├── gameEngine.js          # Core Monopoly rules, turns, trading, auctions, houses
│   ├── boardData.js           # 40 board spaces, color groups, chance/chest card decks
│   ├── rulesConfig.js         # Default rules, metadata, and house rules validator
│   ├── persistence.js         # Atomic JSON save/load to disk
│   └── storage/rooms/         # Auto-saved room state files (.json)
├── public/
│   ├── index.html             # UI layout (lobby, 2D board, HUD, modals)
│   ├── style.css              # Overhead board styling, glassmorphism, animations
│   ├── boardData.js           # Client spaces metadata
│   ├── graphics.js            # Version 1.5 animations (dice tumble, piece hopping)
│   ├── audio.js               # Web Audio API sound generator
│   └── client.js              # WebSocket client, event handler, session recovery
└── tests/
    └── rules.test.js          # Automated unit test suite
```

---

## 🧪 Running Tests
```bash
npm test
```
Verifies Double GO bonus, Free Parking pot mechanics, No Rent in Jail rule, Snake Eyes bonus, state persistence serialization, and even building rules.
