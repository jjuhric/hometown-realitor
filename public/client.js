import { TOKEN_ICONS } from './boardData.js';
import { BoardRenderer } from './graphics.js';
import { sounds } from './audio.js';
import { appState, DEFAULT_TOKENS, DEFAULT_COLORS } from './state.js';
import { els, showToast } from './elements.js';
import {
  fetchLanInfo,
  connectWebSocket,
  sendAction,
  fetchJoinableRooms,
  quickJoinRoom,
  checkSavedSession,
  leaveGameCleanup,
  getHttpApiUrl,
  getServerConfig
} from './network.js';
import {
  fetchThemes,
  loadRulesCustomizer,
  getFormRules,
  initStreetCustomizer,
  openStreetCustomizer,
  closeStreetCustomizer,
  resetStreetCustomizer,
  saveCustomStreets,
  applyPresetToInputs
} from './customizer.js';
import { onSpaceClicked, switchScreen } from './ui.js';
import {
  presentPropertyDeed,
  closePresentedDeed,
  openExitModal,
  openTradeModal
} from './modals.js';

// --- Initialization ---
export async function initApp() {
  initBoard();
  initPickers();
  initStreetCustomizer();
  setupEventListeners();

  await fetchLanInfo();
  await fetchThemes();
  await loadRulesCustomizer();
  await fetchJoinableRooms();
  checkSavedSession();

  // Auto-refresh joinable rooms every 6 seconds on the lobby screen
  setInterval(() => {
    const lobbyScreen = els.lobbyScreen || document.getElementById('lobby-screen');
    if (lobbyScreen && lobbyScreen.classList.contains('active')) {
      fetchJoinableRooms();
    }
  }, 6000);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initBoard() {
  const boardEl = document.getElementById('monopoly-board-grid');
  appState.boardRenderer = new BoardRenderer(boardEl, onSpaceClicked);
  appState.boardRenderer.buildBoard();
}

function initPickers() {
  const hostTokenPicker = document.getElementById('host-token-picker');
  const hostColorPicker = document.getElementById('host-color-picker');
  const joinTokenPicker = document.getElementById('join-token-picker');
  const joinColorPicker = document.getElementById('join-color-picker');

  function renderTokens(container) {
    if (!container) return;
    container.innerHTML = '';
    DEFAULT_TOKENS.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = `token-option ${i === 0 ? 'selected' : ''}`;
      el.innerText = TOKEN_ICONS[t];
      el.onclick = () => {
        container.querySelectorAll('.token-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        appState.selectedToken = t;
      };
      container.appendChild(el);
    });
  }

  function renderColors(container) {
    if (!container) return;
    container.innerHTML = '';
    DEFAULT_COLORS.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = `color-bubble ${i === 0 ? 'selected' : ''}`;
      el.style.backgroundColor = c;
      el.onclick = () => {
        container.querySelectorAll('.color-bubble').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        appState.selectedColor = c;
      };
      container.appendChild(el);
    });
  }

  renderTokens(hostTokenPicker);
  renderColors(hostColorPicker);
  renderTokens(joinTokenPicker);
  renderColors(joinColorPicker);
}

function setupEventListeners() {
  // Copy LAN Link
  const btnCopyLan = els.btnCopyLan || document.getElementById('btn-copy-lan');
  if (btnCopyLan) {
    btnCopyLan.onclick = () => {
      const text = appState.lanInfo?.lanUrl || window.location.origin;
      navigator.clipboard.writeText(text);
      showToast('LAN game link copied to clipboard!', 'success');
    };
  }

  // Sound Toggle
  const btnToggleSound = els.btnToggleSound || document.getElementById('btn-toggle-sound');
  if (btnToggleSound) {
    btnToggleSound.onclick = () => {
      const muted = sounds.toggleMute();
      btnToggleSound.innerText = muted ? '🔇 Sound Off' : '🔊 Sound On';
    };
  }

  // Server Switcher (for GitHub Pages or remote servers)
  const btnChangeServer = document.getElementById('btn-change-server');
  if (btnChangeServer) {
    const currentServer = getServerConfig() || 'Current Host';
    btnChangeServer.title = `Connected Server: ${currentServer}`;
    btnChangeServer.onclick = () => {
      const current = localStorage.getItem('hometown_server_url') || (window.location.hostname.endsWith('github.io') ? 'ws://localhost:3050' : '');
      const input = prompt('Enter Hometown Realitor game server address (e.g. wss://your-server.com or ws://localhost:3050):', current);
      if (input !== null) {
        const trimmed = input.trim();
        if (trimmed) {
          localStorage.setItem('hometown_server_url', trimmed);
          showToast(`Server set to ${trimmed}. Reloading...`, 'success');
        } else {
          localStorage.removeItem('hometown_server_url');
          showToast('Server reset to default. Reloading...', 'info');
        }
        setTimeout(() => location.reload(), 800);
      }
    };
  }

  // Host Create Room
  const btnCreateRoom = document.getElementById('btn-create-room');
  if (btnCreateRoom) {
    btnCreateRoom.onclick = async () => {
      const hostName = document.getElementById('host-name')?.value || 'Host';
      const rules = getFormRules();

      try {
        const res = await fetch(getHttpApiUrl('/api/rooms'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostName,
            rules,
            color: appState.selectedColor,
            tokenIcon: appState.selectedToken
          })
        });
        const data = await res.json();
        connectWebSocket(data.roomId, data.playerId, hostName);
      } catch (err) {
        showToast('Failed to create room.', 'danger');
      }
    };
  }

  // Join Existing Room
  function joinRoom(roomCode) {
    const joinName = document.getElementById('join-name')?.value?.trim() || 'Player 2';
    if (!roomCode) {
      showToast('Please enter a valid room code.', 'warning');
      return;
    }
    const myId = 'p_' + Math.random().toString(36).substring(2, 10);
    connectWebSocket(roomCode.trim().toUpperCase(), myId, joinName);
  }

  const btnJoinRoom = document.getElementById('btn-join-room');
  if (btnJoinRoom) {
    btnJoinRoom.onclick = () => {
      const roomCode = document.getElementById('join-room-code')?.value?.trim()?.toUpperCase();
      joinRoom(roomCode);
    };
  }

  // Spectate Room
  const btnSpectate = els.btnSpectateRoom || document.getElementById('btn-spectate-room');
  if (btnSpectate) {
    btnSpectate.onclick = () => {
      const roomCode = document.getElementById('join-room-code')?.value?.trim()?.toUpperCase();
      const joinName = document.getElementById('join-name')?.value?.trim() || 'Spectator';
      if (!roomCode) {
        showToast('Please enter a valid room code to spectate.', 'warning');
        return;
      }
      const myId = 'spec_' + Math.random().toString(36).substring(2, 10);
      connectWebSocket(roomCode, myId, joinName, true);
    };
  }

  // Exit Game & Leave Waiting Lobby
  const btnExitNav = els.btnExitGame || document.getElementById('btn-exit-game');
  if (btnExitNav) btnExitNav.onclick = openExitModal;

  const btnLeaveWaiting = els.btnLeaveWaiting || document.getElementById('btn-leave-waiting');
  if (btnLeaveWaiting) btnLeaveWaiting.onclick = openExitModal;

  // Refresh Joinable Rooms Button
  const btnRefreshRooms = els.btnRefreshRooms || document.getElementById('btn-refresh-rooms');
  if (btnRefreshRooms) {
    btnRefreshRooms.onclick = () => {
      btnRefreshRooms.disabled = true;
      btnRefreshRooms.innerText = '⏳ ...';
      fetchJoinableRooms().finally(() => {
        btnRefreshRooms.disabled = false;
        btnRefreshRooms.innerText = '🔄 Refresh';
      });
    };
  }

  // Add Bot Player
  const btnAddBot = els.btnAddBot || document.getElementById('btn-add-bot');
  if (btnAddBot) {
    btnAddBot.onclick = () => sendAction('ADD_BOT');
  }

  // Start Game
  const btnStartGame = els.btnStartGame || document.getElementById('btn-start-game');
  if (btnStartGame) {
    btnStartGame.onclick = () => sendAction('START_GAME');
  }

  // Turn Actions
  const btnRoll = els.btnRoll || document.getElementById('btn-action-roll');
  if (btnRoll) {
    btnRoll.onclick = () => {
      btnRoll.disabled = true;
      sendAction('ROLL_DICE');
    };
  }

  const btnBuy = els.btnBuy || document.getElementById('btn-action-buy');
  if (btnBuy) {
    btnBuy.onclick = () => {
      sendAction('BUY_PROPERTY');
      sounds.playBuy();
    };
  }

  const btnDecline = els.btnDecline || document.getElementById('btn-action-decline');
  if (btnDecline) {
    btnDecline.onclick = () => sendAction('DECLINE_PROPERTY');
  }

  // Jail Actions
  const btnJailFine = els.btnJailFine || document.getElementById('btn-action-jail-fine');
  if (btnJailFine) {
    btnJailFine.onclick = () => {
      sendAction('PAY_JAIL_FINE');
      sounds.playCash();
    };
  }

  const btnJailCard = els.btnJailCard || document.getElementById('btn-action-jail-card');
  if (btnJailCard) {
    btnJailCard.onclick = () => sendAction('USE_JAIL_CARD');
  }

  const btnJailRoll = els.btnJailRoll || document.getElementById('btn-action-jail-roll');
  if (btnJailRoll) {
    btnJailRoll.onclick = () => sendAction('ROLL_JAIL_DICE');
  }

  // End Turn
  const btnEnd = els.btnEnd || document.getElementById('btn-action-end');
  if (btnEnd) {
    btnEnd.onclick = () => sendAction('END_TURN');
  }

  // Bankruptcy
  const btnBankruptcy = els.btnBankruptcy || document.getElementById('btn-action-bankruptcy');
  if (btnBankruptcy) {
    btnBankruptcy.onclick = () => {
      if (confirm('Are you sure you want to declare bankruptcy? You will surrender all assets and exit the game.')) {
        sendAction('BANKRUPTCY');
        sounds.playJail();
      }
    };
  }

  // Auto-Liquidate helper
  const btnLiquidate = els.btnLiquidate || document.getElementById('btn-action-liquidate');
  if (btnLiquidate) {
    btnLiquidate.onclick = () => {
      sendAction('AUTO_LIQUIDATE');
      sounds.playCash();
    };
  }

  // Trade Modal buttons
  const btnTrade = els.btnTrade || document.getElementById('btn-action-trade');
  if (btnTrade) btnTrade.onclick = openTradeModal;

  const btnCloseTrade = els.btnCloseTrade || document.getElementById('btn-close-trade');
  if (btnCloseTrade) {
    btnCloseTrade.onclick = () => {
      if (els.modalTrade) els.modalTrade.classList.remove('open');
    };
  }

  const btnSendTradeOffer = els.btnSendTradeOffer || document.getElementById('btn-send-trade-offer');
  if (btnSendTradeOffer) {
    btnSendTradeOffer.onclick = () => {
      const toPlayerId = document.getElementById('trade-target-player')?.value;
      const offerMoney = Number(document.getElementById('trade-offer-cash')?.value) || 0;
      const requestMoney = Number(document.getElementById('trade-request-cash')?.value) || 0;

      const offerProperties = Array.from(document.querySelectorAll('#trade-offer-props-list input:checked')).map(cb => Number(cb.value));
      const requestProperties = Array.from(document.querySelectorAll('#trade-request-props-list input:checked')).map(cb => Number(cb.value));

      sendAction('PROPOSE_TRADE', {
        toPlayerId,
        offer: { offerMoney, requestMoney, offerProperties, requestProperties }
      });
      if (els.modalTrade) els.modalTrade.classList.remove('open');
      const targetPlayer = appState.gameState?.players?.find(p => p.id === toPlayerId);
      if (targetPlayer?.isBot) {
        showToast(`Trade proposal sent to ${targetPlayer.name}. Bot is reviewing...`, 'info');
      } else {
        showToast('Trade proposal sent!', 'success');
      }
    };
  }

  const btnAcceptTrade = els.btnAcceptTrade || document.getElementById('btn-accept-trade');
  if (btnAcceptTrade) {
    btnAcceptTrade.onclick = () => {
      sendAction('RESPOND_TRADE', { accept: true });
      sounds.playCash();
      if (els.modalTradeIncoming) els.modalTradeIncoming.classList.remove('open');
    };
  }

  const btnRejectTrade = els.btnRejectTrade || document.getElementById('btn-reject-trade');
  if (btnRejectTrade) {
    btnRejectTrade.onclick = () => {
      sendAction('RESPOND_TRADE', { accept: false });
      if (els.modalTradeIncoming) els.modalTradeIncoming.classList.remove('open');
    };
  }

  // Rent Negotiation Buttons
  const btnPayFullRent = els.btnPayFullRent || document.getElementById('btn-pay-full-rent');
  if (btnPayFullRent) {
    btnPayFullRent.onclick = () => {
      sendAction('PAY_RENT');
      sounds.playCash();
      if (els.modalRentNegotiation) els.modalRentNegotiation.classList.remove('open');
    };
  }

  const btnProposeRent = els.btnProposeRentDeal || document.getElementById('btn-propose-rent-deal');
  if (btnProposeRent) {
    btnProposeRent.onclick = () => {
      const cashOffer = Number(document.getElementById('rent-offer-cash')?.value) || 0;
      const propVal = document.getElementById('rent-offer-property')?.value;
      const propertyOffer = propVal !== '' && propVal !== undefined ? Number(propVal) : null;
      const jailCardOffer = Boolean(document.getElementById('rent-offer-jail-card')?.checked);

      sendAction('PROPOSE_RENT_DEAL', {
        offer: { cashOffer, propertyOffer, jailCardOffer }
      });
      if (els.modalRentNegotiation) els.modalRentNegotiation.classList.remove('open');
      showToast('Rent compromise offer submitted! Awaiting response...', 'info');
    };
  }

  const btnAcceptRent = els.btnAcceptRentDeal || document.getElementById('btn-accept-rent-deal');
  if (btnAcceptRent) {
    btnAcceptRent.onclick = () => {
      sendAction('RESPOND_RENT_DEAL', { accept: true });
      sounds.playCash();
      if (els.modalRentIncoming) els.modalRentIncoming.classList.remove('open');
    };
  }

  const btnRejectRent = els.btnRejectRentDeal || document.getElementById('btn-reject-rent-deal');
  if (btnRejectRent) {
    btnRejectRent.onclick = () => {
      sendAction('RESPOND_RENT_DEAL', { accept: false });
      if (els.modalRentIncoming) els.modalRentIncoming.classList.remove('open');
      showToast('Compromise rejected. Demanding full rent.', 'warning');
    };
  }

  // Auction Bidding buttons
  function bidIncrement(inc) {
    if (!appState.gameState?.pendingAuction) return;
    const nextBid = appState.gameState.pendingAuction.currentBid + inc;
    sendAction('BID_AUCTION', { bidAmount: nextBid });
    sounds.playBuy();
  }

  const btnBid10 = els.btnBid10 || document.getElementById('btn-bid-10');
  if (btnBid10) btnBid10.onclick = () => bidIncrement(10);

  const btnBid50 = els.btnBid50 || document.getElementById('btn-bid-50');
  if (btnBid50) btnBid50.onclick = () => bidIncrement(50);

  const btnBid100 = els.btnBid100 || document.getElementById('btn-bid-100');
  if (btnBid100) btnBid100.onclick = () => bidIncrement(100);

  const btnPassAuction = els.btnPassAuction || document.getElementById('btn-pass-auction');
  if (btnPassAuction) btnPassAuction.onclick = () => sendAction('PASS_AUCTION');

  // Modals close
  const btnCloseCard = els.btnCloseCard || document.getElementById('btn-close-card');
  if (btnCloseCard) {
    btnCloseCard.onclick = () => {
      if (els.modalCardDraw) els.modalCardDraw.classList.remove('open');
    };
  }

  const btnCloseDeed = els.btnCloseDeed || document.getElementById('btn-close-deed');
  if (btnCloseDeed) {
    btnCloseDeed.onclick = () => {
      if (els.modalDeed) els.modalDeed.classList.remove('open');
    };
  }

  // In-Game Chat
  const chatInput = els.chatInput || document.getElementById('chat-input');
  const btnSendChat = els.btnSendChat || document.getElementById('btn-send-chat');

  function sendChat() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (text) {
      sendAction('CHAT_MESSAGE', { message: text });
      chatInput.value = '';
    }
  }

  if (btnSendChat) btnSendChat.onclick = sendChat;
  if (chatInput) {
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter') sendChat();
    };
  }

  // Quick Rematch Button
  const btnRematch = els.btnRematch || document.getElementById('btn-rematch');
  if (btnRematch) {
    btnRematch.onclick = () => {
      sendAction('REMATCH_REQUEST');
      btnRematch.disabled = true;
      btnRematch.innerText = '⏳ Setting up rematch...';
    };
  }
}

// Global window bindings for HTML inline onclick and debugging
window.openStreetCustomizer = openStreetCustomizer;
window.closeStreetCustomizer = closeStreetCustomizer;
window.resetStreetCustomizer = resetStreetCustomizer;
window.saveCustomStreets = saveCustomStreets;
window.applyPresetToInputs = applyPresetToInputs;
window.closePresentedDeed = closePresentedDeed;
window.presentPropertyDeed = presentPropertyDeed;
window.fetchJoinableRooms = fetchJoinableRooms;
window.quickJoinRoom = quickJoinRoom;
window.openExitModal = openExitModal;
window.leaveGameCleanup = leaveGameCleanup;
