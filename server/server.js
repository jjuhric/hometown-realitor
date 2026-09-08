import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import { BOARD_SPACES, COLOR_GROUPS } from './boardData.js';
import { DEFAULT_RULES, RULES_METADATA } from './rulesConfig.js';
import { BUILDING_STYLES, NEIGHBORHOOD_PRESETS } from './themes.js';
import { saveRoomState, loadRoomState, listSavedRooms, deleteRoomState } from './persistence.js';
import { GameEngine } from './gameEngine.js';
import { evaluateBotTrade, evaluateRentDeal, evaluateBotAuctionBid } from './botTrader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// Active in-memory rooms: roomId -> GameEngine
const rooms = new Map();

// Track WebSocket -> { roomId, playerId }
const clientSessions = new Map();

// Load existing saved rooms from disk
const savedRoomIds = listSavedRooms();
for (const rid of savedRoomIds) {
  const data = loadRoomState(rid);
  if (data) {
    try {
      rooms.set(rid, GameEngine.fromJSON(data));
      console.log(`[Server] Restored room ${rid} from persistence store.`);
    } catch (e) {
      console.warn(`[Server] Failed to restore room ${rid}:`, e.message);
    }
  }
}

/**
 * Automatically cleans up stale, finished, or abandoned rooms
 */
export function cleanupStaleRooms(options = {}) {
  const {
    finishedMaxAgeMs = 15 * 60 * 1000,
    emptyLobbyMaxAgeMs = 5 * 60 * 1000,
    abandonedGameMaxAgeMs = 60 * 60 * 1000,
    now = Date.now()
  } = options;

  let cleanedCount = 0;
  for (const [rid, game] of rooms.entries()) {
    let shouldDelete = false;
    let reason = '';

    const lastLogTime = game.logs?.length > 0 ? game.logs[game.logs.length - 1].timestamp : 0;
    const connectedHumans = game.players.filter(p => !p.isBot && p.connected);
    const hasAnyConnected = connectedHumans.length > 0;

    if (game.status === 'finished') {
      if (!hasAnyConnected || (now - lastLogTime > finishedMaxAgeMs)) {
        shouldDelete = true;
        reason = `Finished room (age: ${Math.round((now - lastLogTime) / 1000)}s)`;
      }
    } else if (game.status === 'lobby') {
      if (!hasAnyConnected && (now - lastLogTime > emptyLobbyMaxAgeMs)) {
        shouldDelete = true;
        reason = `Empty lobby with 0 connected players (age: ${Math.round((now - lastLogTime) / 1000)}s)`;
      }
    } else if (game.status === 'playing') {
      if (!hasAnyConnected && (now - lastLogTime > abandonedGameMaxAgeMs)) {
        shouldDelete = true;
        reason = `Abandoned game with 0 connected humans (age: ${Math.round((now - lastLogTime) / 1000)}s)`;
      }
    }

    if (shouldDelete) {
      console.log(`[Stale Cleanup] Deleting room ${rid}: ${reason}`);
      rooms.delete(rid);
      deleteRoomState(rid);
      cleanedCount++;
    }
  }
  return cleanedCount;
}

// Clean stale rooms every 15 minutes
const cleanupInterval = setInterval(() => {
  try {
    const cleaned = cleanupStaleRooms();
    if (cleaned > 0) {
      console.log(`[Server] Stale room cleanup complete. Removed ${cleaned} room(s).`);
    }
  } catch (err) {
    console.error('[Server] Stale room cleanup error:', err);
  }
}, 15 * 60 * 1000);

// Get LAN IPv4 Address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Broadcast game state to all connected sockets in a room
function broadcastRoomState(roomId) {
  const game = rooms.get(roomId);
  if (!game) return;
  const stateJson = JSON.stringify({
    type: 'ROOM_STATE',
    state: game.toJSON()
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      const session = clientSessions.get(client);
      if (session && session.roomId === roomId) {
        client.send(stateJson);
      }
    }
  }
}

function broadcastError(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ERROR', message }));
  }
}

// REST Endpoints
app.get('/api/info', (req, res) => {
  const lanIp = getLocalIp();
  const port = server.address()?.port || 3000;
  res.json({
    lanIp,
    port,
    localUrl: `http://localhost:${port}`,
    lanUrl: `http://${lanIp}:${port}`,
    activeRooms: rooms.size
  });
});

app.get('/api/board', (req, res) => {
  res.json({ spaces: BOARD_SPACES, colorGroups: COLOR_GROUPS });
});

app.get('/api/rules/meta', (req, res) => {
  res.json({ metadata: RULES_METADATA, defaults: DEFAULT_RULES });
});

app.get('/api/themes', (req, res) => {
  res.json({
    buildingStyles: BUILDING_STYLES,
    neighborhoodPresets: NEIGHBORHOOD_PRESETS
  });
});

app.get('/api/rooms', (req, res) => {
  const list = [];
  for (const [id, game] of rooms.entries()) {
    if (game.status === 'finished') continue;
    if (game.players.length === 0) continue;
    const host = game.players.find(p => p.id === game.hostId) || game.players[0];
    const rulesHighlights = [];
    if (game.rules.freeParkingJackpot) rulesHighlights.push('Pot Active');
    if (game.rules.doubleGoBonus) rulesHighlights.push('Double Payday');
    if (!game.rules.auctionsEnabled) rulesHighlights.push('Auctions Off');
    if (game.rules.rentNegotiation) rulesHighlights.push('Rent Deals');

    list.push({
      id,
      status: game.status,
      hostName: host ? host.name : 'Host',
      hostToken: host ? host.tokenIcon : 'skateboard',
      playerCount: game.players.length,
      spectatorCount: game.spectators ? game.spectators.length : 0,
      maxPlayers: 6,
      buildingStyleName: game.getBuildingStyle()?.name || 'Tiny Home ➔ Mansion',
      neighborhoodPreset: game.rules.neighborhoodPreset || 'Default',
      rulesHighlights,
      rules: game.rules
    });
  }
  list.sort((a, b) => {
    if (a.status === 'lobby' && b.status !== 'lobby') return -1;
    if (b.status === 'lobby' && a.status !== 'lobby') return 1;
    return b.playerCount - a.playerCount;
  });
  res.json(list);
});

app.post('/api/admin/cleanup', (req, res) => {
  const { finishedMaxAgeMs = 0, emptyLobbyMaxAgeMs = 0, abandonedGameMaxAgeMs = 0 } = req.body || {};
  const cleaned = cleanupStaleRooms({ finishedMaxAgeMs, emptyLobbyMaxAgeMs, abandonedGameMaxAgeMs });
  res.json({ success: true, cleanedCount: cleaned, activeRooms: rooms.size });
});

app.post('/api/rooms', (req, res) => {
  const { hostName, rules, color, tokenIcon } = req.body || {};
  let roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
  while (rooms.has(roomId)) {
    roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  const hostPlayerId = 'p_' + Math.random().toString(36).substring(2, 10);
  const game = new GameEngine(roomId, hostPlayerId, rules);
  game.addPlayer(hostPlayerId, hostName || 'Host', color, tokenIcon || 'skateboard');
  rooms.set(roomId, game);

  res.json({
    roomId,
    playerId: hostPlayerId,
    state: game.toJSON()
  });
});

// WebSocket Rate Limiting
const ACTION_RATE_LIMIT = 15; // Max 15 actions per 1-second window
const CHAT_RATE_LIMIT = 5; // Max 5 chat messages per 3-second window

function isRateLimited(ws, isChat = false) {
  const now = Date.now();
  const limit = isChat ? CHAT_RATE_LIMIT : ACTION_RATE_LIMIT;
  const windowMs = isChat ? 3000 : 1000;
  const tracker = isChat ? (ws.chatRate ||= { count: 0, windowStart: now }) : (ws.actionRate ||= { count: 0, windowStart: now });

  if (now - tracker.windowStart > windowMs) {
    tracker.count = 1;
    tracker.windowStart = now;
    return false;
  }

  tracker.count++;
  return tracker.count > limit;
}

// WebSocket Handling
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (isRateLimited(ws, data.type === 'CHAT_MESSAGE')) {
        broadcastError(ws, 'Too many actions sent. Please slow down.');
        return;
      }
      handleClientMessage(ws, data);
    } catch (err) {
      console.error('[WS Message Error]', err);
      broadcastError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    const session = clientSessions.get(ws);
    if (session) {
      const { roomId, playerId, isSpectator } = session;
      const game = rooms.get(roomId);
      if (game) {
        if (isSpectator) {
          game.removeSpectator(playerId);
          broadcastRoomState(roomId);
        } else {
          const player = game.players.find(p => p.id === playerId);
          if (player) {
            player.connected = false;
            game._addLog(`${player.name} lost connection.`);
            game.persist();
            broadcastRoomState(roomId);
          }
        }
      }
      clientSessions.delete(ws);
    }
  });
});

function handleClientMessage(ws, data) {
  const { type, roomId, playerId } = data;

  if (type === 'JOIN_AS_SPECTATOR') {
    const { name } = data;
    const game = rooms.get(roomId);
    if (!game) {
      return broadcastError(ws, `Room ${roomId} does not exist.`);
    }
    const specId = playerId || ('spec_' + Math.random().toString(36).substring(2, 10));
    const spectator = game.addSpectator(specId, name || 'Spectator');
    clientSessions.set(ws, { roomId, playerId: specId, isSpectator: true, name: spectator.name });
    ws.send(JSON.stringify({
      type: 'JOINED_SUCCESS',
      roomId,
      playerId: specId,
      isSpectator: true,
      state: game.toJSON()
    }));
    broadcastRoomState(roomId);
    return;
  }

  if (type === 'JOIN_ROOM') {
    const { name, color, tokenIcon, asSpectator } = data;
    const game = rooms.get(roomId);
    if (!game) {
      return broadcastError(ws, `Room ${roomId} does not exist.`);
    }

    let player = game.players.find(p => p.id === playerId);
    if (player) {
      // Reconnecting existing session
      player.connected = true;
      game._addLog(`${player.name} reconnected.`, 'success');
      game.persist();
      clientSessions.set(ws, { roomId, playerId: player.id, isSpectator: false, name: player.name });
      ws.send(JSON.stringify({
        type: 'JOINED_SUCCESS',
        roomId,
        playerId: player.id,
        isSpectator: false,
        state: game.toJSON()
      }));
      broadcastRoomState(roomId);
      return;
    }

    // If explicitly requested as spectator or if game is already playing / full
    if (asSpectator || game.status !== 'lobby' || game.players.length >= 6) {
      const specId = playerId || ('spec_' + Math.random().toString(36).substring(2, 10));
      const spectator = game.addSpectator(specId, name || 'Spectator');
      clientSessions.set(ws, { roomId, playerId: specId, isSpectator: true, name: spectator.name });
      ws.send(JSON.stringify({
        type: 'JOINED_SUCCESS',
        roomId,
        playerId: specId,
        isSpectator: true,
        state: game.toJSON()
      }));
      broadcastRoomState(roomId);
      return;
    }

    // New join as player
    player = game.addPlayer(playerId || ('p_' + Math.random().toString(36).substring(2, 10)), name, color, tokenIcon);
    if (!player) {
      return broadcastError(ws, 'Cannot join room. Game may have already started or is full.');
    }

    clientSessions.set(ws, { roomId, playerId: player.id, isSpectator: false, name: player.name });
    ws.send(JSON.stringify({
      type: 'JOINED_SUCCESS',
      roomId,
      playerId: player.id,
      isSpectator: false,
      state: game.toJSON()
    }));
    broadcastRoomState(roomId);
    return;
  }

  // All other actions require valid room
  const game = rooms.get(roomId);
  if (!game) return broadcastError(ws, 'Room not found.');

  const session = clientSessions.get(ws);
  if (session?.isSpectator) {
    if (type !== 'CHAT_MESSAGE' && type !== 'LEAVE_ROOM') {
      return broadcastError(ws, 'Spectators cannot perform gameplay actions.');
    }
  }

  try {
    switch (type) {
      case 'UPDATE_RULES':
        game.updateRules(data.rules);
        break;

      case 'ADD_BOT': {
        if (game.status !== 'lobby') throw new Error('Cannot add bot after game starts.');
        const botCount = game.players.filter(p => p.isBot).length;
        const BOT_NAMES = ['Neighbor Charlie 🤖', 'Neighbor Diana 🤖', 'Neighbor Edison 🤖', 'Neighbor Fiona 🤖'];
        const BOT_TOKENS = ['skateboard', 'bicycle', 'scooter', 'dog'];
        const BOT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
        const botId = 'bot_' + Math.random().toString(36).substring(2, 9);
        const name = BOT_NAMES[botCount % BOT_NAMES.length];
        const token = BOT_TOKENS[botCount % BOT_TOKENS.length];
        const color = BOT_COLORS[botCount % BOT_COLORS.length];
        game.addPlayer(botId, name, color, token, true);
        break;
      }

      case 'START_GAME':
        game.startGame(playerId);
        break;

      case 'ROLL_DICE':
        game.rollDice(playerId);
        break;

      case 'BUY_PROPERTY':
        game.buyProperty(playerId);
        break;

      case 'DECLINE_PROPERTY':
        game.declineProperty(playerId);
        break;

      case 'BID_AUCTION':
        game.placeBid(playerId, data.bidAmount);
        break;

      case 'PASS_AUCTION':
        game.passAuction(playerId);
        break;

      case 'BUILD_HOUSE':
        game.buildHouse(playerId, data.spaceId);
        break;

      case 'SELL_HOUSE':
        game.sellHouse(playerId, data.spaceId);
        break;

      case 'MORTGAGE_PROPERTY':
        game.mortgageProperty(playerId, data.spaceId);
        break;

      case 'UNMORTGAGE_PROPERTY':
        game.unmortgageProperty(playerId, data.spaceId);
        break;

      case 'PAY_JAIL_FINE':
        game.payJailFine(playerId);
        break;

      case 'USE_JAIL_CARD':
        game.useJailCard(playerId);
        break;

      case 'ROLL_JAIL_DICE':
        game.rollJailDice(playerId);
        break;

      case 'PROPOSE_TRADE': {
        game.proposeTrade(playerId, data.toPlayerId, data.offer);
        const targetPlayer = game.players.find(p => p.id === data.toPlayerId);
        if (targetPlayer && targetPlayer.isBot) {
          // Bot asynchronously evaluates the trade proposal
          setTimeout(() => {
            const curGame = rooms.get(roomId);
            if (!curGame || !curGame.pendingTrade || curGame.pendingTrade.toPlayerId !== targetPlayer.id) return;
            const evalResult = evaluateBotTrade(curGame, targetPlayer.id, curGame.pendingTrade);
            curGame._addLog(`🤖 [${targetPlayer.name}]: "${evalResult.chatMessage}"`, 'chat');
            curGame.respondTrade(targetPlayer.id, evalResult.accept);
            broadcastRoomState(roomId);
          }, 1200);
        }
        break;
      }

      case 'AUTO_LIQUIDATE':
        game.autoLiquidate(playerId, 0);
        break;

      case 'PAY_RENT':
        game.payPendingRent(playerId);
        break;

      case 'PROPOSE_RENT_DEAL': {
        game.proposeRentDeal(playerId, data.offer);
        const pending = game.pendingRent;
        if (pending) {
          const creditor = game.players.find(p => p.id === pending.creditorId);
          if (creditor && creditor.isBot) {
            setTimeout(() => {
              const curGame = rooms.get(roomId);
              if (!curGame || !curGame.pendingRent || !curGame.pendingRent.dealOffer) return;
              const evalRes = evaluateRentDeal(curGame, creditor.id, curGame.pendingRent, curGame.pendingRent.dealOffer);
              curGame._addLog(`🤖 [${creditor.name}]: "${evalRes.chatMessage}"`, 'chat');
              curGame.respondRentDeal(creditor.id, evalRes.accept);
              broadcastRoomState(roomId);
              checkAndExecuteBotTurn(roomId);
            }, 1200);
          }
        }
        break;
      }

      case 'RESPOND_RENT_DEAL':
        game.respondRentDeal(playerId, data.accept);
        break;

      case 'RESPOND_TRADE':
        game.respondTrade(playerId, data.accept);
        break;

      case 'CANCEL_TRADE':
        game.cancelTrade(playerId);
        break;

      case 'END_TURN':
        game.endTurn(playerId);
        break;

      case 'BANKRUPTCY':
        game.declareBankruptcy(playerId, data.creditorId);
        break;

      case 'CHAT_MESSAGE': {
        const sender = game.players.find(p => p.id === playerId);
        const senderName = sender ? sender.name : (session?.isSpectator ? `${session.name || 'Spectator'} 👁️` : null);
        if (senderName && data.message) {
          game._addLog(`💬 [${senderName}]: "${data.message}"`, 'chat');
          game.persist();
        }
        break;
      }

      case 'LEAVE_ROOM': {
        if (session?.isSpectator) {
          game.removeSpectator(playerId);
          clientSessions.delete(ws);
          broadcastRoomState(roomId);
          return;
        }
        const leavingPlayer = game.players.find(p => p.id === playerId);
        if (!leavingPlayer) break;

        if (game.status === 'lobby') {
          game.removePlayer(playerId);
          clientSessions.delete(ws);
          if (game.players.length === 0) {
            rooms.delete(roomId);
            deleteRoomState(roomId);
          } else {
            broadcastRoomState(roomId);
          }
        } else if (game.status === 'playing') {
          game.forfeitPlayer(playerId);
          clientSessions.delete(ws);
          broadcastRoomState(roomId);
          checkAndExecuteBotTurn(roomId);
        }
        return;
      }

      case 'REMATCH_REQUEST': {
        if (game.status !== 'finished') {
          throw new Error('Can only request a rematch after the game has finished.');
        }

        let newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        while (rooms.has(newRoomId)) {
          newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        }

        const newGame = new GameEngine(newRoomId, game.hostId, game.rules);

        // Recreate all players with fresh starting state
        for (const p of game.players) {
          newGame.addPlayer(p.id, p.name, p.color, p.tokenIcon, p.isBot);
        }

        // Also carry over spectators
        if (game.spectators) {
          for (const s of game.spectators) {
            newGame.addSpectator(s.id, s.name);
          }
        }

        rooms.set(newRoomId, newGame);
        newGame.persist();

        // Migrate all active clientSessions pointing to old roomId to newRoomId
        for (const [wsClient, sess] of clientSessions.entries()) {
          if (sess.roomId === roomId) {
            sess.roomId = newRoomId;
            wsClient.send(JSON.stringify({
              type: 'REMATCH_STARTED',
              oldRoomId: roomId,
              newRoomId,
              state: newGame.toJSON()
            }));
          }
        }

        broadcastRoomState(newRoomId);
        return;
      }

      case 'END_GAME': {
        if (game.hostId !== playerId) {
          throw new Error('Only the host can end the game.');
        }
        game.status = 'finished';
        game._addLog(`🛑 The host ended the game.`, 'danger');

        const endMsg = JSON.stringify({
          type: 'GAME_ENDED',
          roomId,
          message: 'The host has ended the game.'
        });

        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) {
            const session = clientSessions.get(client);
            if (session && session.roomId === roomId) {
              client.send(endMsg);
              clientSessions.delete(client);
            }
          }
        }
        rooms.delete(roomId);
        deleteRoomState(roomId);
        return;
      }

      default:
        console.warn(`[WS] Unrecognized message type: ${type}`);
        return;
    }

    broadcastRoomState(roomId);
    checkAndExecuteBotTurn(roomId);
  } catch (err) {
    console.warn(`[Game Action Error] ${err.message}`);
    broadcastError(ws, err.message);
  }
}

function checkAndExecuteBotTurn(roomId, extraDelay = null) {
  const game = rooms.get(roomId);
  if (!game || game.status !== 'playing') return;

  // Handle AUCTION phase: Any non-bankrupt bot who hasn't passed and isn't highest bidder may bid or pass
  if (game.turnPhase === 'AUCTION' && game.pendingAuction) {
    const auction = game.pendingAuction;
    const eligibleBot = game.players.find(p =>
      p.isBot &&
      !p.bankrupt &&
      auction.activePlayerIds.includes(p.id) &&
      !auction.passedPlayerIds.includes(p.id) &&
      auction.highBidderId !== p.id
    );

    if (!eligibleBot) return; // No bot needs to act right now

    const delay = extraDelay !== null ? extraDelay : 1600;
    setTimeout(() => {
      const curGame = rooms.get(roomId);
      if (!curGame || curGame.status !== 'playing' || curGame.turnPhase !== 'AUCTION' || !curGame.pendingAuction) return;

      const curAuction = curGame.pendingAuction;
      const bot = curGame.players.find(p =>
        p.id === eligibleBot.id &&
        p.isBot &&
        !p.bankrupt &&
        curAuction.activePlayerIds.includes(p.id) &&
        !curAuction.passedPlayerIds.includes(p.id) &&
        curAuction.highBidderId !== p.id
      );
      if (!bot) return;

      try {
        const decision = evaluateBotAuctionBid(curGame, bot.id, curAuction.spaceId, curAuction.currentBid);
        if (decision.bid) {
          curGame.placeBid(bot.id, decision.bidAmount);
          broadcastRoomState(roomId);
          checkAndExecuteBotTurn(roomId, 1800);
        } else {
          curGame.passAuction(bot.id);
          broadcastRoomState(roomId);
          checkAndExecuteBotTurn(roomId, 1400);
        }
      } catch (err) {
        console.warn(`[Bot Auction Error] ${err.message}`);
      }
    }, delay);
    return;
  }

  const active = game.getActivePlayer();
  if (!active || !active.isBot || active.bankrupt) return;

  // Determine realistic humanized delay based on turn phase
  let delay = extraDelay !== null ? extraDelay : 1800;
  if (extraDelay === null) {
    if (game.turnPhase === 'ROLL') {
      delay = 2000; // Contemplating before roll
    } else if (game.turnPhase === 'ACTION') {
      delay = 1800; // Considering purchase/decline
    } else if (game.turnPhase === 'END_TURN') {
      delay = 1500; // Reviewing board before passing turn
    } else if (game.turnPhase === 'JAIL_DECISION') {
      delay = 2000; // Thinking about fine vs rolling
    } else if (game.turnPhase === 'RENT_NEGOTIATION') {
      delay = 2200; // Sizing up rent settlement
    }
  }

  setTimeout(() => {
    const curGame = rooms.get(roomId);
    if (!curGame || curGame.status !== 'playing') return;
    const curActive = curGame.getActivePlayer();
    if (!curActive || curActive.id !== active.id) return;

    try {
      // 1. Debt Check: If bot has negative cash or in RESOLVE_DEBT
      if (curActive.money < 0 || curGame.turnPhase === 'RESOLVE_DEBT') {
        const maxLiquidation = curGame.calculateMaxLiquidationValue(curActive.id);
        if (maxLiquidation < 0) {
          curGame._addLog(`🤖 ${curActive.name} has no remaining assets to pay debt and declares bankruptcy!`, 'danger');
          curGame.declareBankruptcy(curActive.id, curGame.lastCreditorId);
        } else {
          curGame.autoLiquidate(curActive.id, 0);
          if (curActive.money < 0) {
            curGame.declareBankruptcy(curActive.id, curGame.lastCreditorId);
          }
        }
        broadcastRoomState(roomId);
        checkAndExecuteBotTurn(roomId, 2000);
        return;
      }

      // 2. Rent Negotiation: If bot is debtor, pay rent
      if (curGame.turnPhase === 'RENT_NEGOTIATION' && curGame.pendingRent) {
        if (curGame.pendingRent.debtorId === curActive.id) {
          curGame.payPendingRent(curActive.id);
          broadcastRoomState(roomId);
          checkAndExecuteBotTurn(roomId, 2500);
          return;
        }
      }

      if (curGame.turnPhase === 'JAIL_DECISION') {
        if (curActive.money >= 50) {
          curGame.payJailFine(curActive.id);
        } else {
          curGame.rollJailDice(curActive.id);
        }
        broadcastRoomState(roomId);
        checkAndExecuteBotTurn(roomId, 2000);
      } else if (curGame.turnPhase === 'ROLL') {
        curGame.rollDice(curActive.id);
        broadcastRoomState(roomId);
        // Allow full client dice roll animation (1.5s) + token hop per space (170ms) + landing ripple
        const diceSum = (curGame.dice[0] || 1) + (curGame.dice[1] || 1);
        const movementAllowance = 2600 + (diceSum * 170);
        checkAndExecuteBotTurn(roomId, movementAllowance);
      } else if (curGame.turnPhase === 'ACTION') {
        const space = BOARD_SPACES[curActive.position];
        let postActionDelay = 1800;
        if (space && ['street', 'railroad', 'utility'].includes(space.type)) {
          if (curActive.money >= space.price + 120) {
            curGame.buyProperty(curActive.id);
            // Showcase delay: let human players see the zoomed-in deed presentation card
            postActionDelay = 3800;
          } else {
            curGame.declineProperty(curActive.id);
            postActionDelay = 1600;
          }
        } else {
          curGame.declineProperty(curActive.id);
          postActionDelay = 1600;
        }
        broadcastRoomState(roomId);
        checkAndExecuteBotTurn(roomId, postActionDelay);
      } else if (curGame.turnPhase === 'END_TURN') {
        // Optional building upgrade if bot has monopoly & healthy treasury
        let builtSomething = false;
        if (curActive.money > 450) {
          for (const [idStr, prop] of Object.entries(curGame.properties)) {
            const s = BOARD_SPACES[Number(idStr)];
            if (prop.ownerId === curActive.id && s.type === 'street' && prop.houses < 5) {
              if (curGame.hasMonopoly(curActive.id, s.group) && curActive.money >= s.houseCost + 250) {
                try {
                  curGame.buildHouse(curActive.id, s.id);
                  builtSomething = true;
                  break;
                } catch (e) {}
              }
            }
          }
        }
        if (builtSomething) {
          broadcastRoomState(roomId);
          // Allow players to observe building deed showcase
          checkAndExecuteBotTurn(roomId, 3800);
        } else {
          curGame.endTurn(curActive.id);
          broadcastRoomState(roomId);
          checkAndExecuteBotTurn(roomId, 1800);
        }
      }
    } catch (e) {
      console.warn(`[Bot Action Error] ${e.message}`);
    }
  }, delay);
}

// Keepalive Ping Interval
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => clearInterval(interval));

const PORT = process.env.PORT || 3050;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  const lanIp = getLocalIp();
  console.log('====================================================');
  console.log('  🎲 MONOPOLY NETWORK MULTIPLAYER SERVER (V1 & V1.5) 🎲');
  console.log('====================================================');
  console.log(`  Local URL:   http://localhost:${PORT}`);
  console.log(`  LAN URL:     http://${lanIp}:${PORT}`);
  console.log('  Share the LAN URL with friends on your local Wi-Fi!');
  console.log('====================================================');
});
