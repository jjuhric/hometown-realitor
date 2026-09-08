import { BOARD_SPACES, COLOR_GROUPS, TOKEN_ICONS } from './boardData.js';
import { sounds } from './audio.js';
import { appState, calculateNetWorth } from './state.js';
import { els, getCenterPotAmount, getCenterTurnBanner } from './elements.js';
import { fetchJoinableRooms, sendAction } from './network.js';
import {
  showCardModal,
  showAuctionModal,
  showIncomingTradeModal,
  presentPropertyDeed,
  showRentNegotiationModal,
  showIncomingRentDealModal
} from './modals.js';

export function switchScreen(name) {
  const lobbyScreen = els.lobbyScreen || document.getElementById('lobby-screen');
  const waitingScreen = els.waitingScreen || document.getElementById('room-waiting-screen');
  const gameScreen = els.gameScreen || document.getElementById('game-screen');
  const turnActionBar = els.turnActionBar || document.getElementById('turn-action-bar');
  const btnExit = els.btnExitGame || document.getElementById('btn-exit-game');
  const navRoomBadge = els.navRoomBadge || document.getElementById('nav-room-badge');

  if (lobbyScreen) lobbyScreen.classList.remove('active');
  if (waitingScreen) waitingScreen.classList.remove('active');
  if (gameScreen) gameScreen.classList.remove('active');

  if (name === 'lobby') {
    if (lobbyScreen) lobbyScreen.classList.add('active');
    if (turnActionBar) turnActionBar.style.display = 'none';
    if (btnExit) btnExit.style.display = 'none';
    if (navRoomBadge) navRoomBadge.style.display = 'none';
    fetchJoinableRooms();
  }
  if (name === 'waiting') {
    if (waitingScreen) waitingScreen.classList.add('active');
    if (turnActionBar) turnActionBar.style.display = 'none';
    if (btnExit) btnExit.style.display = 'inline-block';
    if (navRoomBadge) navRoomBadge.style.display = 'inline-block';
  }
  if (name === 'game') {
    if (gameScreen) gameScreen.classList.add('active');
    if (turnActionBar) turnActionBar.style.display = 'flex';
    if (btnExit) btnExit.style.display = 'inline-block';
    if (navRoomBadge) navRoomBadge.style.display = 'inline-block';
  }
}

export function updateGameState(state) {
  const oldState = appState.gameState;
  appState.gameState = state;
  window.gameState = state;

  if (state.status === 'lobby') {
    switchScreen('waiting');
    renderWaitingLobby();
  } else if (state.status === 'playing' || state.status === 'finished') {
    switchScreen('game');
    renderGameScreen();

    // Check if dice rolled and animate
    if (state.dice && (appState.prevDice[0] !== state.dice[0] || appState.prevDice[1] !== state.dice[1])) {
      if (appState.boardRenderer) {
        appState.boardRenderer.animateDiceRoll(state.dice[0], state.dice[1], state.dice[0] === state.dice[1]);
      }
      appState.prevDice = [state.dice[0], state.dice[1]];
    }

    // Animate moving player
    let animatedAny = false;
    for (const p of state.players) {
      const oldPos = appState.prevPositions.get(p.id);
      if (oldPos !== undefined && oldPos !== p.position) {
        if (appState.boardRenderer) {
          appState.boardRenderer.animatePlayerMove(p, p.position);
        }
        animatedAny = true;
      }
      appState.prevPositions.set(p.id, p.position);
    }
    if (!animatedAny && appState.boardRenderer) {
      appState.boardRenderer.renderPlayerTokens(state.players);
    }

    // Check Free Parking Pot Win (Celebration)
    if (oldState && oldState.freeParkingPot > state.freeParkingPot && oldState.freeParkingPot > (state.rules.freeParkingSeed || 0)) {
      if (appState.boardRenderer) {
        appState.boardRenderer.triggerJackpotCoinsCelebration();
      }
    }

    // Check last drawn card
    if (state.lastDrawnCard && (!els.modalCardDraw?.classList.contains('open') || els.cardDrawText?.innerText !== state.lastDrawnCard.text)) {
      showCardModal(state.lastDrawnCard);
    }

    // Check auction
    if (state.turnPhase === 'AUCTION' && state.pendingAuction) {
      showAuctionModal(state.pendingAuction);
    } else {
      if (els.modalAuction) els.modalAuction.classList.remove('open');
    }

    // Check incoming trade
    if (state.pendingTrade && state.pendingTrade.toPlayerId === appState.myPlayerId) {
      showIncomingTradeModal(state.pendingTrade);
    } else {
      if (els.modalTradeIncoming) els.modalTradeIncoming.classList.remove('open');
    }

    // Check Jail Event animation
    if (state.lastJailEvent && state.lastJailEvent.timestamp > appState.lastJailTimestamp) {
      appState.lastJailTimestamp = state.lastJailEvent.timestamp;
      const jailedPlayer = state.players.find(p => p.id === state.lastJailEvent.playerId);
      if (jailedPlayer && appState.boardRenderer) {
        appState.boardRenderer.animateGoToJail(jailedPlayer);
      }
    }

    // Check Property Purchase / Building Upgrade Presentation
    if (state.lastPropertyEvent && state.lastPropertyEvent.timestamp > appState.lastPresentedPropertyTimestamp) {
      appState.lastPresentedPropertyTimestamp = state.lastPropertyEvent.timestamp;
      presentPropertyDeed(state.lastPropertyEvent, state);
    }

    // Check Rent Negotiation
    if (state.turnPhase === 'RENT_NEGOTIATION' && state.pendingRent) {
      if (state.pendingRent.debtorId === appState.myPlayerId) {
        showRentNegotiationModal(state.pendingRent);
      } else {
        if (els.modalRentNegotiation) els.modalRentNegotiation.classList.remove('open');
      }

      if (state.pendingRent.creditorId === appState.myPlayerId && state.pendingRent.dealOffer) {
        showIncomingRentDealModal(state.pendingRent);
      } else {
        if (els.modalRentIncoming) els.modalRentIncoming.classList.remove('open');
      }
    } else {
      if (els.modalRentNegotiation) els.modalRentNegotiation.classList.remove('open');
      if (els.modalRentIncoming) els.modalRentIncoming.classList.remove('open');
    }

    // Check winner
    if (state.status === 'finished' && state.winner) {
      sounds.playFanfare();
      if (els.winnerNameDisplay) els.winnerNameDisplay.innerText = `${state.winner.name} Wins!`;
      if (els.winnerDetailDisplay) els.winnerDetailDisplay.innerText = `Victory achieved! Final Net Worth: $${calculateNetWorth(state.winner.id)}`;
      if (els.modalWinner) els.modalWinner.classList.add('open');
    }
  }
}

export function renderWaitingLobby() {
  if (els.waitingRoomCode) els.waitingRoomCode.innerText = appState.gameState.id;
  const waitingList = els.waitingPlayersList || document.getElementById('waiting-players-list');
  if (waitingList) {
    waitingList.innerHTML = '';
    appState.gameState.players.forEach(p => {
      const item = document.createElement('div');
      item.className = 'player-slot-item';
      item.style.borderLeft = `5px solid ${p.color}`;
      item.innerHTML = `
        <div class="player-slot-icon">${TOKEN_ICONS[p.tokenIcon] || '🏎️'}</div>
        <div class="player-slot-name">${p.name} ${p.id === appState.gameState.hostId ? '👑 (Host)' : ''} ${p.isBot ? '🤖 (Bot)' : ''}</div>
        <div style="font-size: 0.85rem; color: #4ade80;">Ready</div>
      `;
      waitingList.appendChild(item);
    });
  }

  const isHost = appState.gameState.hostId === appState.myPlayerId;
  const btnAddBot = els.btnAddBot || document.getElementById('btn-add-bot');
  if (btnAddBot) {
    btnAddBot.style.display = isHost && appState.gameState.players.length < 8 ? 'inline-block' : 'none';
  }

  const btnStart = els.btnStartGame || document.getElementById('btn-start-game');
  if (btnStart) {
    btnStart.style.display = isHost ? 'inline-block' : 'none';
    btnStart.innerText = appState.gameState.players.length === 1 ? '🚀 Start Solo Practice' : '🚀 Start Game';
  }
  const hostNotice = els.waitingHostNotice || document.getElementById('waiting-host-notice');
  if (hostNotice) {
    hostNotice.style.display = isHost ? 'none' : 'block';
  }
}

export function renderGameScreen() {
  if (!appState.gameState || !appState.gameState.players || appState.gameState.players.length === 0) return;
  const activePlayer = appState.gameState.players[appState.gameState.currentTurnIndex] || appState.gameState.players[0];
  const isMyTurn = activePlayer?.id === appState.myPlayerId;

  // Free Parking Pot
  const centerPot = getCenterPotAmount();
  if (centerPot) centerPot.innerText = `$${appState.gameState.freeParkingPot}`;

  // Center Turn Banner
  const centerBanner = getCenterTurnBanner();
  if (centerBanner) {
    if (activePlayer.money < 0 || appState.gameState.turnPhase === 'RESOLVE_DEBT') {
      centerBanner.innerText = isMyTurn
        ? `⚠️ IN DEBT (-$${Math.abs(activePlayer.money)})! Sell houses, mortgage properties, or declare bankruptcy.`
        : `${activePlayer.name} is resolving debt (-$${Math.abs(activePlayer.money)})...`;
      centerBanner.style.color = '#ef4444';
    } else {
      centerBanner.innerText = isMyTurn
        ? `⭐ IT'S YOUR TURN! (${activePlayer.name})`
        : `Waiting for ${activePlayer.name}...`;
      centerBanner.style.color = isMyTurn ? '#fbbf24' : '#e2e8f0';
    }
  }

  renderHudPlayers();
  renderRulesSummary();
  renderLogs();

  if (appState.boardRenderer) {
    if (appState.gameState.spaceNames) {
      appState.boardRenderer.updateSpaceNames(appState.gameState.spaceNames);
    }
    appState.boardRenderer.updateProperties(appState.gameState.properties, appState.gameState.players, appState.gameState.buildingStyle);
  }

  updateActionControls(isMyTurn, activePlayer);
}

export function renderHudPlayers() {
  const container = els.hudPlayersContainer || document.getElementById('hud-players-container');
  if (!container) return;
  container.innerHTML = '';

  const rankedPlayers = appState.gameState.players.map(p => {
    const net = appState.gameState.netWorths?.[p.id] !== undefined ? appState.gameState.netWorths[p.id] : calculateNetWorth(p.id);
    return { player: p, netWorth: net };
  }).sort((a, b) => {
    if (a.player.bankrupt && !b.player.bankrupt) return 1;
    if (!a.player.bankrupt && b.player.bankrupt) return -1;
    return b.netWorth - a.netWorth;
  });

  const activePlayer = appState.gameState.players[appState.gameState.currentTurnIndex];

  rankedPlayers.forEach((item, index) => {
    const p = item.player;
    const net = item.netWorth;
    const isTurn = activePlayer && p.id === activePlayer.id;
    const card = document.createElement('div');
    card.className = `hud-player-card ${isTurn ? 'active-turn' : ''} ${p.bankrupt ? 'bankrupt' : ''}`;
    card.style.borderLeftColor = p.color;

    let rankBadgeClass = 'rank-badge-other';
    let rankText = `#${index + 1}`;
    if (p.bankrupt) {
      rankText = '💀';
    } else if (index === 0) {
      rankBadgeClass = 'rank-badge-1';
      rankText = '🥇1';
    } else if (index === 1) {
      rankBadgeClass = 'rank-badge-2';
      rankText = '🥈2';
    } else if (index === 2) {
      rankBadgeClass = 'rank-badge-3';
      rankText = '🥉3';
    }

    let deedsHtml = '';
    let propCount = 0;
    if (appState.gameState.properties) {
      for (const [idStr, prop] of Object.entries(appState.gameState.properties)) {
        if (prop.ownerId === p.id) {
          propCount++;
          const space = BOARD_SPACES[Number(idStr)];
          const color = space.group ? COLOR_GROUPS[space.group].hex : '#94a3b8';
          deedsHtml += `<span class="mini-deed-chip" style="background:${color}" title="${space.name}"></span>`;
        }
      }
    }

    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-name-badge">
          <span class="rank-badge ${rankBadgeClass}">${rankText}</span>
          <span>${TOKEN_ICONS[p.tokenIcon] || '🏎️'}</span>
          <span style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
          ${p.id === appState.myPlayerId ? '<span style="color: #60a5fa; font-size: 0.75rem;">(You)</span>' : ''}
          ${p.inJail ? '<span>🔒</span>' : ''}
          ${isTurn ? '<span style="color: var(--accent-gold); font-size: 0.75rem;" title="Current Turn">⭐</span>' : ''}
        </div>
        <span class="leaderboard-networth" title="Total Net Worth">$${net}</span>
      </div>
      <div class="player-card-sub" style="margin-top: 2px;">
        <span>Cash: <b style="color: var(--accent-green);">$${p.money}</b></span>
        <span>${propCount} Deeds</span>
        <span>@ ${BOARD_SPACES[p.position]?.name || `Space ${p.position}`}</span>
      </div>
      ${deedsHtml ? `<div class="mini-deed-chips">${deedsHtml}</div>` : ''}
    `;
    container.appendChild(card);
  });
}

export function renderRulesSummary() {
  const summaryEl = els.hudRulesSummary || document.getElementById('hud-rules-summary');
  if (!summaryEl) return;
  const r = appState.gameState.rules;
  const bStyle = appState.gameState.buildingStyle?.label || 'Tiny Home ➔ Mansion';
  summaryEl.innerHTML = `
    • <b>Development Style:</b> ${bStyle}<br>
    • <b>Town Square Pot:</b> ${r.freeParkingJackpot ? `Active ($${appState.gameState.freeParkingPot})` : 'Standard Resting'}<br>
    • <b>PAYDAY Salary:</b> ${r.doubleGoBonus ? 'Double on Land ($400)' : 'Standard $200'}<br>
    • <b>Rent in City Hall:</b> ${r.noRentInJail ? 'No Rent Collected When Detained' : 'Standard Full Rent'}<br>
    • <b>Auctions:</b> ${r.auctionsEnabled ? 'Property Auctions Active' : 'Off (Just Decline)'}<br>
    • <b>Lucky Roller:</b> ${r.snakeEyesBonus ? `+$${r.snakeEyesReward} Bonus` : 'Off'}
  `;
}

export function renderLogs() {
  const logBox = els.activityLogBox || document.getElementById('activity-log-box');
  if (!logBox) return;
  logBox.innerHTML = '';
  appState.gameState.logs.forEach(log => {
    const el = document.createElement('div');
    el.className = `log-entry ${log.type || ''}`;
    el.innerText = log.text;
    logBox.appendChild(el);
  });
  logBox.scrollTop = logBox.scrollHeight;
}

export function updateActionControls(isMyTurn, activePlayer) {
  const specNotice = els.spectatorActionNotice || document.getElementById('spectator-action-notice');
  const btnTrade = els.btnTrade || document.getElementById('btn-action-trade');
  const btnRoll = els.btnRoll || document.getElementById('btn-action-roll');
  const btnBuy = els.btnBuy || document.getElementById('btn-action-buy');
  const btnDecline = els.btnDecline || document.getElementById('btn-action-decline');
  const btnEnd = els.btnEnd || document.getElementById('btn-action-end');
  const btnJailFine = els.btnJailFine || document.getElementById('btn-action-jail-fine');
  const btnJailCard = els.btnJailCard || document.getElementById('btn-action-jail-card');
  const btnJailRoll = els.btnJailRoll || document.getElementById('btn-action-jail-roll');
  const btnBankruptcy = els.btnBankruptcy || document.getElementById('btn-action-bankruptcy');
  const btnLiquidate = els.btnLiquidate || document.getElementById('btn-action-liquidate');

  if (btnRoll) btnRoll.style.display = 'none';
  if (btnBuy) btnBuy.style.display = 'none';
  if (btnDecline) btnDecline.style.display = 'none';
  if (btnEnd) btnEnd.style.display = 'none';
  if (btnJailFine) btnJailFine.style.display = 'none';
  if (btnJailCard) btnJailCard.style.display = 'none';
  if (btnJailRoll) btnJailRoll.style.display = 'none';
  if (btnBankruptcy) btnBankruptcy.style.display = 'none';
  if (btnLiquidate) btnLiquidate.style.display = 'none';

  if (appState.isSpectator) {
    if (btnTrade) btnTrade.style.display = 'none';
    if (specNotice) specNotice.style.display = 'flex';
    return;
  }

  if (specNotice) specNotice.style.display = 'none';
  if (btnTrade) btnTrade.style.display = 'inline-block';

  if (!isMyTurn || appState.gameState.status !== 'playing') {
    if (btnRoll) btnRoll.disabled = true;
    return;
  }

  if (activePlayer.money < 0 || appState.gameState.turnPhase === 'RESOLVE_DEBT') {
    if (btnBankruptcy) {
      btnBankruptcy.style.display = 'inline-block';
      btnBankruptcy.innerText = `Declare Bankruptcy (Debt: -$${Math.abs(activePlayer.money)})`;
    }
    if (btnLiquidate) btnLiquidate.style.display = 'inline-block';
    return;
  }

  const phase = appState.gameState.turnPhase;
  const currentSpace = BOARD_SPACES[activePlayer.position];

  if (phase === 'ROLL') {
    if (btnRoll) {
      btnRoll.style.display = 'inline-block';
      btnRoll.disabled = false;
    }
  } else if (phase === 'JAIL_DECISION') {
    if (btnJailFine) btnJailFine.style.display = 'inline-block';
    if (btnJailRoll) btnJailRoll.style.display = 'inline-block';
    const hasCard = activePlayer.getOutOfJailCards?.chance || activePlayer.getOutOfJailCards?.communityChest;
    if (hasCard && btnJailCard) btnJailCard.style.display = 'inline-block';
  } else if (phase === 'ACTION') {
    if (btnBuy) {
      btnBuy.style.display = 'inline-block';
      btnBuy.innerText = `🏠 Buy ${currentSpace.name} ($${currentSpace.price})`;
      btnBuy.disabled = activePlayer.money < currentSpace.price;
    }
    if (btnDecline) {
      btnDecline.style.display = 'inline-block';
      btnDecline.innerText = appState.gameState.rules.auctionsEnabled ? 'Decline & Auction' : 'Decline';
    }
  } else if (phase === 'END_TURN') {
    if (btnEnd) btnEnd.style.display = 'inline-block';
  }
}

export function onSpaceClicked(spaceId) {
  const space = BOARD_SPACES[spaceId];
  if (!['street', 'railroad', 'utility'].includes(space.type)) return;

  const bStyle = appState.gameState?.buildingStyle || {
    singleName: 'Tiny Home',
    singlePlural: 'Tiny Homes',
    topName: 'Luxury Mansion'
  };

  const titleEl = els.deedTitle || document.getElementById('deed-title');
  const bodyEl = els.deedBody || document.getElementById('deed-body');
  const actionsEl = els.deedActions || document.getElementById('deed-actions');
  const modal = els.modalDeed || document.getElementById('modal-deed');

  if (titleEl) {
    titleEl.innerText = appState.gameState?.spaceNames?.[spaceId] || space.name;
  }

  const prop = appState.gameState?.properties?.[spaceId];
  const owner = prop?.ownerId ? appState.gameState.players.find(p => p.id === prop.ownerId) : null;
  const isMine = prop?.ownerId === appState.myPlayerId;

  let bodyHtml = `
    <div style="background: ${space.group ? COLOR_GROUPS[space.group].hex : '#334155'}; height: 8px; border-radius: 4px; margin-bottom: 10px;"></div>
    <p><b>Price:</b> $${space.price}</p>
    <p><b>Owner:</b> ${owner ? `${owner.name} (${prop.mortgaged ? 'MORTGAGED' : 'Active'})` : 'None (Unowned)'}</p>
  `;

  if (space.type === 'street') {
    bodyHtml += `
      <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse; margin-top: 8px;">
        <tr><td>Base Rent:</td><td>$${space.rent[0]}</td></tr>
        <tr><td>With 1 ${bStyle.singleName}:</td><td>$${space.rent[1]}</td></tr>
        <tr><td>With 2 ${bStyle.singlePlural}:</td><td>$${space.rent[2]}</td></tr>
        <tr><td>With 3 ${bStyle.singlePlural}:</td><td>$${space.rent[3]}</td></tr>
        <tr><td>With 4 ${bStyle.singlePlural}:</td><td>$${space.rent[4]}</td></tr>
        <tr><td>With ${bStyle.topName.toUpperCase()}:</td><td>$${space.rent[5]}</td></tr>
        <tr><td>Unit Cost:</td><td>$${space.houseCost} each</td></tr>
        <tr><td>Mortgage Value:</td><td>$${space.mortgage}</td></tr>
      </table>
    `;
  } else if (space.type === 'railroad') {
    bodyHtml += `
      <p style="margin-top: 8px;"><b>Fare:</b> 1 Line: $25 | 2 Lines: $50 | 3 Lines: $100 | 4 Lines: $200</p>
      <p><b>Mortgage Value:</b> $${space.mortgage}</p>
    `;
  } else if (space.type === 'utility') {
    bodyHtml += `
      <p style="margin-top: 8px;"><b>Service Charge:</b> 4x Dice (1 Service) or 10x Dice (Both Services)</p>
      <p><b>Mortgage Value:</b> $${space.mortgage}</p>
    `;
  }

  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  if (actionsEl) {
    actionsEl.innerHTML = '';

    if (isMine) {
      if (space.type === 'street') {
        const btnBuild = document.createElement('button');
        btnBuild.className = 'btn-small';
        btnBuild.style.background = '#10b981';
        btnBuild.innerText = `+ Build ${bStyle.singleName} ($${space.houseCost})`;
        btnBuild.onclick = () => {
          sendAction('BUILD_HOUSE', { spaceId });
          sounds.playBuy();
          if (modal) modal.classList.remove('open');
        };
        actionsEl.appendChild(btnBuild);

        if (prop.houses > 0) {
          const btnSell = document.createElement('button');
          btnSell.className = 'btn-small';
          btnSell.style.background = '#f59e0b';
          btnSell.innerText = `- Sell ${bStyle.singleName} (+$${space.houseCost / 2})`;
          btnSell.onclick = () => {
            sendAction('SELL_HOUSE', { spaceId });
            sounds.playCash();
            if (modal) modal.classList.remove('open');
          };
          actionsEl.appendChild(btnSell);
        }
      }

      if (!prop.mortgaged) {
        const btnMortgage = document.createElement('button');
        btnMortgage.className = 'btn-small';
        btnMortgage.style.background = '#ef4444';
        btnMortgage.innerText = `Mortgage (+$${space.mortgage})`;
        btnMortgage.onclick = () => {
          sendAction('MORTGAGE_PROPERTY', { spaceId });
          sounds.playCash();
          if (modal) modal.classList.remove('open');
        };
        actionsEl.appendChild(btnMortgage);
      } else {
        const unmortgageCost = Math.floor(space.mortgage * 1.1);
        const btnUnmortgage = document.createElement('button');
        btnUnmortgage.className = 'btn-small';
        btnUnmortgage.style.background = '#3b82f6';
        btnUnmortgage.innerText = `Unmortgage (-$${unmortgageCost})`;
        btnUnmortgage.onclick = () => {
          sendAction('UNMORTGAGE_PROPERTY', { spaceId });
          sounds.playCash();
          if (modal) modal.classList.remove('open');
        };
        actionsEl.appendChild(btnUnmortgage);
      }
    }
  }

  if (modal) modal.classList.add('open');
}
