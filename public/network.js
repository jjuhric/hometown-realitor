import { TOKEN_ICONS } from './boardData.js';
import { appState, resetSessionState } from './state.js';
import { els, showToast } from './elements.js';
import { updateGameState, switchScreen } from './ui.js';

export function getServerConfig() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramServer = urlParams.get('server');
  if (paramServer) {
    localStorage.setItem('hometown_server_url', paramServer);
    return paramServer;
  }
  const stored = localStorage.getItem('hometown_server_url');
  if (stored) return stored;

  if (window.location.hostname.endsWith('github.io')) {
    return 'ws://localhost:3050';
  }
  return '';
}

export function getWsUrl() {
  const customServer = getServerConfig();
  if (customServer) {
    if (customServer.startsWith('ws://') || customServer.startsWith('wss://')) {
      return customServer;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${customServer}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export function getHttpApiUrl(endpoint) {
  const customServer = getServerConfig();
  if (customServer) {
    let httpBase = customServer;
    if (httpBase.startsWith('ws://')) httpBase = httpBase.replace('ws://', 'http://');
    else if (httpBase.startsWith('wss://')) httpBase = httpBase.replace('wss://', 'https://');
    else if (!httpBase.startsWith('http://') && !httpBase.startsWith('https://')) {
      httpBase = (window.location.protocol === 'https:' ? 'https://' : 'http://') + httpBase;
    }
    return `${httpBase.replace(/\/$/, '')}${endpoint}`;
  }
  return endpoint;
}

export async function fetchLanInfo() {
  try {
    const res = await fetch(getHttpApiUrl('/api/info'));
    appState.lanInfo = await res.json();
    if (els.lanUrlText) els.lanUrlText.innerText = appState.lanInfo.lanUrl;
  } catch (err) {
    if (els.lanUrlText) els.lanUrlText.innerText = window.location.origin;
  }
}

export function sendAction(type, payload = {}) {
  if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
    appState.ws.send(JSON.stringify({
      type,
      roomId: appState.currentRoomId,
      playerId: appState.myPlayerId,
      ...payload
    }));
  }
}

export function connectWebSocket(roomId, playerId, name, asSpectator = false) {
  const wsUrl = getWsUrl();
  appState.ws = new WebSocket(wsUrl);

  appState.ws.onopen = () => {
    console.log('[WS] Connected to game server.');
    appState.ws.send(JSON.stringify({
      type: asSpectator ? 'JOIN_AS_SPECTATOR' : 'JOIN_ROOM',
      roomId,
      playerId,
      name,
      asSpectator,
      color: appState.selectedColor,
      tokenIcon: appState.selectedToken
    }));
  };

  appState.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (err) {
      console.error('[WS Parse Error]', err);
    }
  };

  appState.ws.onclose = () => {
    console.warn('[WS] Connection closed.');
    if (!appState.currentRoomId || !appState.myPlayerId) {
      return; // Clean intentional disconnect or exit
    }
    showToast('Connection dropped. Attempting to reconnect...', 'warning');
    setTimeout(() => {
      if (appState.currentRoomId && appState.myPlayerId) {
        connectWebSocket(appState.currentRoomId, appState.myPlayerId, 'Player');
      }
    }, 2000);
  };
}

export function handleServerMessage(msg) {
  switch (msg.type) {
    case 'JOINED_SUCCESS':
      appState.currentRoomId = msg.roomId;
      appState.myPlayerId = msg.playerId;
      appState.isSpectator = !!msg.isSpectator;
      if (!appState.isSpectator) {
        localStorage.setItem('monopoly_session', JSON.stringify({ roomId: appState.currentRoomId, playerId: appState.myPlayerId }));
      } else {
        localStorage.removeItem('monopoly_session');
      }
      if (els.navRoomBadge) {
        els.navRoomBadge.style.display = 'inline-block';
        els.navRoomBadge.innerText = appState.isSpectator ? `ROOM: ${appState.currentRoomId} (Spectator)` : `ROOM: ${appState.currentRoomId}`;
      }
      updateGameState(msg.state);
      break;

    case 'ROOM_STATE':
      updateGameState(msg.state);
      break;

    case 'REMATCH_STARTED':
      appState.currentRoomId = msg.newRoomId;
      if (!appState.isSpectator) {
        localStorage.setItem('monopoly_session', JSON.stringify({ roomId: appState.currentRoomId, playerId: appState.myPlayerId }));
      }
      if (els.navRoomBadge) {
        els.navRoomBadge.style.display = 'inline-block';
        els.navRoomBadge.innerText = appState.isSpectator ? `ROOM: ${appState.currentRoomId} (Spectator)` : `ROOM: ${appState.currentRoomId}`;
      }
      if (els.modalWinner) els.modalWinner.classList.remove('open');
      showToast(`🔄 Quick Rematch created! Room ${appState.currentRoomId}.`, 'success');
      updateGameState(msg.state);
      break;

    case 'GAME_ENDED':
      showToast(msg.message || 'The host has ended the game.', 'warning');
      leaveGameCleanup(msg.message || 'The host has ended the game.');
      break;

    case 'ERROR':
      showToast(msg.message, 'danger');
      break;
  }
}

export function resumeSession(roomId, playerId) {
  connectWebSocket(roomId, playerId, 'Player');
}

export function checkSavedSession() {
  const saved = localStorage.getItem('monopoly_session');
  if (saved) {
    try {
      const { roomId, playerId } = JSON.parse(saved);
      if (roomId && playerId) {
        const box = els.reconnectBox || document.getElementById('reconnect-box');
        if (box) box.style.display = 'block';
        const btn = els.btnResumeSession || document.getElementById('btn-resume-session');
        if (btn) {
          btn.onclick = () => resumeSession(roomId, playerId);
        }
      }
    } catch (e) {}
  }
}

export async function fetchJoinableRooms() {
  const listEl = els.joinableRoomsList || document.getElementById('joinable-rooms-list');
  if (!listEl) return;

  try {
    const res = await fetch(getHttpApiUrl('/api/rooms'));
    const rooms = await res.json();

    if (!Array.isArray(rooms) || rooms.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 30px 10px; font-size: 0.9rem;">
          <div style="font-size: 1.8rem; margin-bottom: 6px;">🏡</div>
          <div>No open games right now.</div>
          <div style="font-size: 0.8rem; margin-top: 4px; color: #94a3b8;">Host a game above to create a neighborhood!</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    rooms.forEach(r => {
      const card = document.createElement('div');
      card.className = 'joinable-room-card';

      const isLobby = r.status === 'lobby';
      const statusClass = isLobby ? 'lobby' : 'playing';
      const statusText = isLobby ? '🟢 Waiting in Lobby' : '🟡 In Progress';

      const highlightsHtml = (r.rulesHighlights || [])
        .slice(0, 3)
        .map(h => `<span class="room-tag">${h}</span>`)
        .join('');

      card.innerHTML = `
        <div class="room-card-top">
          <span class="room-code-tag">${r.id}</span>
          <span class="room-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="room-info-row">
          <div class="room-host-info">
            <span>${TOKEN_ICONS[r.hostToken] || '🛹'}</span>
            <span>Host: ${r.hostName}</span>
          </div>
          <div>👥 ${r.playerCount}/${r.maxPlayers || 6}${r.spectatorCount ? ` · 👁️ ${r.spectatorCount}` : ''}</div>
        </div>
        <div class="room-highlights-row">
          <span class="room-tag" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); font-weight: bold;">${r.buildingStyleName || 'Tiny Home'}</span>
          ${highlightsHtml}
        </div>
        <button type="button" class="btn-quick-join" onclick="window.quickJoinRoom('${r.id}', ${!isLobby})">
          ${isLobby ? '⚡ Join Neighborhood' : '👁️ Watch Game (Spectate)'}
        </button>
      `;
      listEl.appendChild(card);
    });
  } catch (err) {
    console.warn('[Rooms] Failed to fetch joinable rooms:', err);
  }
}

export function quickJoinRoom(roomId, asSpectator = false) {
  const codeInput = document.getElementById('join-room-code');
  if (codeInput) codeInput.value = roomId;
  const joinName = document.getElementById('join-name')?.value?.trim() || (asSpectator ? 'Spectator' : 'Player 2');
  const myId = (asSpectator ? 'spec_' : 'p_') + Math.random().toString(36).substring(2, 10);
  connectWebSocket(roomId, myId, joinName, asSpectator);
}

export function leaveGameCleanup(reason = 'Exited game.') {
  const modal = els.modalConfirmExit || document.getElementById('modal-confirm-exit');
  if (modal) modal.classList.remove('open');

  localStorage.removeItem('monopoly_session');
  resetSessionState();

  const reconnectBox = els.reconnectBox || document.getElementById('reconnect-box');
  if (reconnectBox) reconnectBox.style.display = 'none';

  switchScreen('lobby');
  showToast(reason, 'info');
  fetchJoinableRooms();
}
