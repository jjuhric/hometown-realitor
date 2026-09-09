# Hometown Realtor

**Hometown Realtor** is a real-time, multiplayer, web-based property trading game. Inspired by classic real estate board games, it features a complete rules engine, persistent game state, custom house rules, and an intuitive web UI.

---

## 🌟 Key Features

- **Real-Time Multiplayer**: Built with WebSockets, enabling real-time dice rolls, token movement, trading, and chat.
- **House Rules Engine**: Toggle rules like *Free Parking Jackpot*, *Double GO Payout*, *No Rent In Jail*, and customizable starting cash.
- **Rich Interactions**: Rent negotiation, live auctions, property trades, and a spectator mode.
- **Game State Persistence**: Server-side persistence ensures your game survives disconnects, browser refreshes, and server restarts.
- **Modular Architecture**: Modern ES Modules frontend with a dynamic API router for seamless local/cloud environment support.
- **Automated CI/CD**: Fully tested with GitHub Actions and automatically deployed to GitHub Pages.

---

## 📁 Project Structure

```
hometown-realitor/
├── package.json               # Project scripts and dependencies
├── README.md                  # Project documentation
├── build.js                   # Build script for static site generation (GitHub Pages)
├── .github/                   # GitHub Actions (CI/CD) and branch protection rules
├── server/
│   ├── server.js              # Express API & WebSocket routing
│   ├── gameEngine.js          # Core authoritative game rules and state mutation
│   ├── boardData.js           # Property and board configuration
│   ├── rulesConfig.js         # House rules and limits definition
│   ├── persistence.js         # Atomic JSON persistence logic
│   └── storage/rooms/         # Saved JSON room states
├── public/
│   ├── index.html             # Main application UI layout
│   ├── style.css              # Styling, transitions, and animations
│   ├── client.js              # Main ES module entry point
│   ├── network.js             # API and WebSocket connection manager
│   ├── customizer.js          # Pre-game house rules & lobby configuration
│   ├── boardData.js           # Client-side space and property metadata
│   ├── graphics.js            # Visual effects, dice rolling, and piece hopping
│   └── audio.js               # Synthesized Web Audio API sound effects
└── tests/
    ├── run-all-tests.js       # Background service manager and test runner
    ├── rules.test.js          # Core engine unit tests
    ├── multiplayer.test.js    # E2E Socket integration and reconnection tests
    ├── trade-debt.test.js     # Trading, bots, and debt settlement
    ├── rent-negotiation.test.js # Rent compromise and logic tests
    └── lobby-exit.test.js     # Spectator mode, Rematch, and Room Cleanup tests
```

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation & Launch

```bash
# Clone the repository
git clone https://github.com/jjuhric/hometown-realitor.git
cd hometown-realitor

# Install dependencies
npm install

# Run automated tests
npm test

# Start the local game server
npm start
```

Open `http://localhost:3000` in your browser. The server will dynamically serve the UI and manage WebSocket connections.

---

## 🧪 Testing

Hometown Realtor features a robust suite of E2E and Unit tests. Run them using:

```bash
npm test
```

This runs the custom test runner (`tests/run-all-tests.js`), which automatically manages the server lifecycle, running all test suites sequentially to verify:
- Core Rules & Serialization
- E2E Multiplayer & Reconnection
- Trade, Debt, & AI logic
- Rent Negotiations
- Spectator Mode & Lobbies

---

## ☁️ Deployment

The application utilizes **GitHub Actions** for CI/CD:
- Pull requests to `develop` or `main` run `npm test` and `npm run build`.
- Merges to the protected `main` branch trigger automated deployments to **GitHub Pages**.

> **Note on Static Hosting**: The frontend UI is statically hosted on GitHub Pages, while `network.js` automatically resolves WebSocket API endpoints to support local and remote backends.

---
*Created and maintained by the Hometown Realtor team.*
