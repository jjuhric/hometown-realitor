import { BOARD_SPACES, COLOR_GROUPS, TOKEN_ICONS } from './boardData.js';
import { sounds } from './audio.js';
import { appState } from './state.js';
import { els, showToast } from './elements.js';
import { sendAction, leaveGameCleanup } from './network.js';

// --- Deed Presentation Showcase ---
export function closePresentedDeed() {
  const modal = els.modalDeedPresentation || document.getElementById('modal-deed-presentation');
  if (modal) modal.classList.remove('open');
  if (appState.deedPresentationTimeout) {
    clearTimeout(appState.deedPresentationTimeout);
    appState.deedPresentationTimeout = null;
  }
}

export function presentPropertyDeed(event, state) {
  const modal = els.modalDeedPresentation || document.getElementById('modal-deed-presentation');
  if (!modal) return;

  const space = BOARD_SPACES[event.spaceId];
  if (!space) return;

  const badgeEl = els.deedShowcaseEventBadge || document.getElementById('deed-showcase-event-badge');
  const topEl = els.presentedDeedTop || document.getElementById('presented-deed-top');
  const nameEl = els.presentedDeedName || document.getElementById('presented-deed-name');
  const bannerEl = els.presentedDeedOwnerBanner || document.getElementById('presented-deed-owner-banner');
  const tokenEl = els.presentedDeedOwnerToken || document.getElementById('presented-deed-owner-token');
  const ownerNameEl = els.presentedDeedOwnerName || document.getElementById('presented-deed-owner-name');
  const rentBodyEl = els.presentedDeedRentBody || document.getElementById('presented-deed-rent-body');
  const footerEl = els.presentedDeedFooter || document.getElementById('presented-deed-footer');
  const timerBar = els.deedTimerBar || document.getElementById('deed-timer-bar');

  sounds.playBuy();

  const groupColor = COLOR_GROUPS[space.group]?.hex || '#1e293b';
  if (topEl) {
    topEl.style.backgroundColor = groupColor;
  }

  const displayName = event.spaceName || (state.spaceNames && state.spaceNames[space.id]) || space.name;
  if (nameEl) {
    nameEl.innerText = displayName;
  }

  const bStyle = state?.buildingStyle || {
    singleName: 'Tiny Home',
    singlePlural: 'Tiny Homes',
    topName: 'Luxury Mansion'
  };

  if (badgeEl) {
    if (event.type === 'BUILD') {
      badgeEl.className = 'presented-deed-header-badge upgrade';
      const unitLabel = event.houses === 5 ? bStyle.topName : `${bStyle.singleName} #${event.houses}`;
      badgeEl.innerText = `🏗️ UPGRADED: ${unitLabel.toUpperCase()}!`;
    } else {
      badgeEl.className = 'presented-deed-header-badge';
      badgeEl.innerText = `🏠 ACQUIRED FOR $${event.cost || space.price}!`;
    }
  }

  const isMe = event.playerId === appState.myPlayerId;
  if (tokenEl) {
    tokenEl.innerText = TOKEN_ICONS[event.playerToken] || '🛹';
  }
  if (ownerNameEl) {
    ownerNameEl.innerText = `${event.playerName}${isMe ? ' (You)' : ''}`;
  }
  if (bannerEl) {
    bannerEl.style.borderColor = event.playerColor || '#10b981';
  }

  if (rentBodyEl) {
    rentBodyEl.innerHTML = '';
    if (space.type === 'street') {
      const curH = event.houses || 0;
      const rows = [
        { label: 'Base Rent', val: `$${space.rent[0]}`, tier: 0 },
        { label: `With 1 ${bStyle.singleName}`, val: `$${space.rent[1]}`, tier: 1 },
        { label: `With 2 ${bStyle.singlePlural}`, val: `$${space.rent[2]}`, tier: 2 },
        { label: `With 3 ${bStyle.singlePlural}`, val: `$${space.rent[3]}`, tier: 3 },
        { label: `With 4 ${bStyle.singlePlural}`, val: `$${space.rent[4]}`, tier: 4 },
        { label: `With ${bStyle.topName}`, val: `$${space.rent[5]}`, tier: 5 }
      ];

      rows.forEach(r => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `presented-rent-row ${curH === r.tier ? 'current-tier' : ''}`;
        rowDiv.innerHTML = `<span>${r.label}</span><span>${r.val}</span>`;
        rentBodyEl.appendChild(rowDiv);
      });
    } else if (space.type === 'railroad') {
      const rows = [
        { label: 'Rent with 1 Transit Line', val: '$25' },
        { label: 'Rent with 2 Transit Lines', val: '$50' },
        { label: 'Rent with 3 Transit Lines', val: '$100' },
        { label: 'Rent with 4 Transit Lines', val: '$200' }
      ];
      rows.forEach(r => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'presented-rent-row';
        rowDiv.innerHTML = `<span>${r.label}</span><span>${r.val}</span>`;
        rentBodyEl.appendChild(rowDiv);
      });
    } else if (space.type === 'utility') {
      const rows = [
        { label: 'If 1 Town Utility owned', val: '4× Dice Roll' },
        { label: 'If 2 Town Utilities owned', val: '10× Dice Roll' }
      ];
      rows.forEach(r => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'presented-rent-row';
        rowDiv.innerHTML = `<span>${r.label}</span><span>${r.val}</span>`;
        rentBodyEl.appendChild(rowDiv);
      });
    }
  }

  if (footerEl) {
    footerEl.innerHTML = '';
    const mortRow = document.createElement('div');
    mortRow.innerText = `Mortgage Value: $${space.mortgage}`;
    footerEl.appendChild(mortRow);

    if (space.type === 'street') {
      const costRow = document.createElement('div');
      costRow.innerText = `Cost per ${bStyle.singleName}: $${space.houseCost}`;
      footerEl.appendChild(costRow);
    }
  }

  modal.classList.add('open');

  if (timerBar) {
    timerBar.style.transition = 'none';
    timerBar.style.width = '100%';
    setTimeout(() => {
      timerBar.style.transition = 'width 3.4s linear';
      timerBar.style.width = '0%';
    }, 50);
  }

  if (appState.deedPresentationTimeout) {
    clearTimeout(appState.deedPresentationTimeout);
  }
  appState.deedPresentationTimeout = setTimeout(() => {
    modal.classList.remove('open');
  }, 3600);
}

// --- Card Modal ---
export function showCardModal(card) {
  sounds.playCard();
  const typeEl = els.cardDrawType || document.getElementById('card-draw-type');
  const boxEl = els.cardDisplayBox || document.getElementById('card-display-box');
  const textEl = els.cardDrawText || document.getElementById('card-draw-text');
  const modal = els.modalCardDraw || document.getElementById('modal-card-draw');

  if (typeEl) typeEl.innerText = card.deckType === 'chance' ? '❓ CHANCE' : '🎁 COMMUNITY CHEST';
  if (boxEl) boxEl.className = `card-draw-display ${card.deckType}`;
  if (textEl) textEl.innerText = card.text;
  if (modal) modal.classList.add('open');
}

// --- Auction Modal ---
export function showAuctionModal(auction) {
  const space = BOARD_SPACES[auction.spaceId];
  const nameEl = els.auctionPropName || document.getElementById('auction-prop-name');
  const bidEl = els.auctionHighBid || document.getElementById('auction-high-bid');
  const bidderEl = els.auctionHighBidder || document.getElementById('auction-high-bidder');
  const modal = els.modalAuction || document.getElementById('modal-auction');

  if (nameEl) nameEl.innerText = space.name;
  if (bidEl) bidEl.innerText = `$${auction.currentBid}`;

  if (auction.highBidderId) {
    const bidder = appState.gameState?.players?.find(p => p.id === auction.highBidderId);
    if (bidderEl) bidderEl.innerText = `Highest Bidder: ${bidder?.name || 'Unknown'}`;
  } else {
    if (bidderEl) bidderEl.innerText = 'No bids yet. Minimum increment: $10';
  }

  const btn10 = els.btnBid10 || document.getElementById('btn-bid-10');
  const btn50 = els.btnBid50 || document.getElementById('btn-bid-50');
  const btn100 = els.btnBid100 || document.getElementById('btn-bid-100');
  const btnPass = els.btnPassAuction || document.getElementById('btn-pass-auction');

  if (appState.isSpectator) {
    if (btn10) btn10.style.display = 'none';
    if (btn50) btn50.style.display = 'none';
    if (btn100) btn100.style.display = 'none';
    if (btnPass) {
      btnPass.innerText = 'Close Auction View';
      btnPass.onclick = () => modal?.classList.remove('open');
    }
  } else {
    if (btn10) btn10.style.display = 'inline-block';
    if (btn50) btn50.style.display = 'inline-block';
    if (btn100) btn100.style.display = 'inline-block';
    if (btnPass) {
      btnPass.innerText = 'Pass on Auction';
      btnPass.onclick = () => sendAction('PASS_AUCTION');
    }
  }

  if (modal) modal.classList.add('open');
}

// --- Trade Modals ---
export function openTradeModal() {
  const targetSelect = els.tradeTargetPlayer || document.getElementById('trade-target-player');
  const myPropsList = els.tradeOfferPropsList || document.getElementById('trade-offer-props-list');
  const modal = els.modalTrade || document.getElementById('modal-trade');
  if (!targetSelect || !myPropsList || !modal) return;

  targetSelect.innerHTML = '';
  myPropsList.innerHTML = '';

  const others = appState.gameState?.players?.filter(p => p.id !== appState.myPlayerId && !p.bankrupt) || [];
  others.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.innerText = p.name;
    targetSelect.appendChild(opt);
  });

  if (appState.gameState?.properties) {
    for (const [idStr, prop] of Object.entries(appState.gameState.properties)) {
      if (prop.ownerId === appState.myPlayerId) {
        const space = BOARD_SPACES[Number(idStr)];
        const row = document.createElement('div');
        row.innerHTML = `<label><input type="checkbox" value="${space.id}"> ${space.name}</label>`;
        myPropsList.appendChild(row);
      }
    }
  }

  updateTradeTargetProps();
  targetSelect.onchange = updateTradeTargetProps;
  modal.classList.add('open');
}

export function updateTradeTargetProps() {
  const targetSelect = els.tradeTargetPlayer || document.getElementById('trade-target-player');
  const targetPropsList = els.tradeRequestPropsList || document.getElementById('trade-request-props-list');
  if (!targetSelect || !targetPropsList) return;

  const targetId = targetSelect.value;
  targetPropsList.innerHTML = '';

  if (appState.gameState?.properties) {
    for (const [idStr, prop] of Object.entries(appState.gameState.properties)) {
      if (prop.ownerId === targetId) {
        const space = BOARD_SPACES[Number(idStr)];
        const row = document.createElement('div');
        row.innerHTML = `<label><input type="checkbox" value="${space.id}"> ${space.name}</label>`;
        targetPropsList.appendChild(row);
      }
    }
  }
}

export function showIncomingTradeModal(trade) {
  const from = appState.gameState?.players?.find(p => p.id === trade.fromPlayerId);
  const detailsEl = els.incomingTradeDetails || document.getElementById('incoming-trade-details');
  const modal = els.modalTradeIncoming || document.getElementById('modal-trade-incoming');
  if (!detailsEl || !modal) return;

  const offerPropNames = trade.offerProperties.map(id => BOARD_SPACES[id]?.name || `Space ${id}`).join(', ') || 'None';
  const reqPropNames = trade.requestProperties.map(id => BOARD_SPACES[id]?.name || `Space ${id}`).join(', ') || 'None';

  detailsEl.innerHTML = `
    <p><b>${from?.name || 'Player'} offers you:</b></p>
    <p style="color: #86efac;">• Cash: $${trade.offerMoney}</p>
    <p style="color: #86efac;">• Properties: ${offerPropNames}</p>
    <br>
    <p><b>In exchange for:</b></p>
    <p style="color: #93c5fd;">• Cash: $${trade.requestMoney}</p>
    <p style="color: #93c5fd;">• Properties: ${reqPropNames}</p>
  `;
  modal.classList.add('open');
}

// --- Rent Negotiation Modals ---
export function showRentNegotiationModal(pendingRent) {
  const modal = els.modalRentNegotiation || document.getElementById('modal-rent-negotiation');
  if (!modal) return;

  const creditor = appState.gameState?.players?.find(p => p.id === pendingRent.creditorId);
  const space = BOARD_SPACES[pendingRent.spaceId];
  const debtor = appState.gameState?.players?.find(p => p.id === pendingRent.debtorId);

  const summaryEl = els.rentNegotiationSummary || document.getElementById('rent-negotiation-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      You landed on <b style="color: var(--accent-gold);">${space ? space.name : 'property'}</b> owned by <b>${creditor ? creditor.name : 'Opponent'}</b>.<br>
      Required Rent: <span style="font-size: 1.3rem; font-weight: bold; color: #ef4444;">$${pendingRent.rent}</span><br>
      <span style="font-size: 0.85rem; color: var(--text-muted);">Your Current Cash: $${debtor ? debtor.money : 0}</span>
    `;
  }

  const propSelect = els.rentOfferProperty || document.getElementById('rent-offer-property');
  if (propSelect) {
    propSelect.innerHTML = '<option value="">-- None --</option>';
    if (appState.gameState?.properties) {
      for (const [idStr, prop] of Object.entries(appState.gameState.properties)) {
        if (prop.ownerId === appState.myPlayerId && !prop.mortgaged && (!prop.houses || prop.houses === 0)) {
          const s = BOARD_SPACES[Number(idStr)];
          const opt = document.createElement('option');
          opt.value = idStr;
          opt.innerText = `${s.name} (Value $${s.price})`;
          propSelect.appendChild(opt);
        }
      }
    }
  }

  const jailGroup = els.rentOfferJailGroup || document.getElementById('rent-offer-jail-group');
  const jailCb = els.rentOfferJailCard || document.getElementById('rent-offer-jail-card');
  if (jailGroup && jailCb) {
    if (debtor && (debtor.getOutOfJailCards?.chance || debtor.getOutOfJailCards?.communityChest)) {
      jailGroup.style.display = 'flex';
      jailCb.checked = false;
    } else {
      jailGroup.style.display = 'none';
      jailCb.checked = false;
    }
  }

  const cashInput = els.rentOfferCash || document.getElementById('rent-offer-cash');
  if (cashInput) {
    cashInput.value = Math.max(0, Math.floor(pendingRent.rent * 0.5));
    cashInput.max = debtor ? debtor.money : 0;
  }

  modal.classList.add('open');
}

export function showIncomingRentDealModal(pendingRent) {
  const modal = els.modalRentIncoming || document.getElementById('modal-rent-incoming');
  if (!modal) return;

  const debtor = appState.gameState?.players?.find(p => p.id === pendingRent.debtorId);
  const space = BOARD_SPACES[pendingRent.spaceId];
  const offer = pendingRent.dealOffer;

  const detailsEl = els.incomingRentDealDetails || document.getElementById('incoming-rent-deal-details');
  if (detailsEl && offer) {
    let items = `<li>Cash: <b>$${offer.cashOffer}</b> (vs $${pendingRent.rent} full rent)</li>`;
    if (offer.propertyOffer !== null && offer.propertyOffer !== undefined && offer.propertyOffer !== '') {
      const pSpace = BOARD_SPACES[offer.propertyOffer];
      items += `<li>Property Deed: <b style="color: var(--accent-gold);">${pSpace ? pSpace.name : 'Deed'}</b></li>`;
    }
    if (offer.jailCardOffer) {
      items += `<li>Get Out of Jail Free Card 🎫</li>`;
    }

    detailsEl.innerHTML = `
      <b>${debtor ? debtor.name : 'Debtor'}</b> landed on <b>${space ? space.name : 'your property'}</b> and owes <b>$${pendingRent.rent}</b> rent.<br>
      They are proposing a compromise to settle the debt:<br>
      <ul style="margin: 8px 0 8px 20px; color: #86efac; line-height: 1.8;">
        ${items}
      </ul>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">
        Accepting transfers the offered cash/deeds and clears the rent. Rejecting demands full payment.
      </p>
    `;
  }
  modal.classList.add('open');
}

// --- Exit / End Game Modal ---
export function openExitModal() {
  const modal = els.modalConfirmExit || document.getElementById('modal-confirm-exit');
  const titleEl = els.exitModalTitle || document.getElementById('exit-modal-title');
  const descEl = els.exitModalDesc || document.getElementById('exit-modal-desc');
  const actionsEl = els.exitModalActions || document.getElementById('exit-modal-actions');
  if (!modal || !actionsEl) return;

  const isHost = appState.gameState && appState.gameState.hostId === appState.myPlayerId;
  const isPlaying = appState.gameState && appState.gameState.status === 'playing';

  actionsEl.innerHTML = '';

  if (appState.isSpectator) {
    titleEl.innerText = 'Leave Spectator Mode?';
    descEl.innerText = 'Stop spectating this match and return to the main lobby.';

    const btnLeave = document.createElement('button');
    btnLeave.className = 'btn-primary';
    btnLeave.innerText = '🚪 Return to Lobby';
    btnLeave.onclick = () => {
      sendAction('LEAVE_ROOM');
      leaveGameCleanup('Left spectator mode.');
    };
    actionsEl.appendChild(btnLeave);
  } else if (isHost && isPlaying) {
    titleEl.innerText = 'Host Game Options';
    descEl.innerText = 'As host, you can end this match for all players or forfeit and leave.';

    const btnEndAll = document.createElement('button');
    btnEndAll.className = 'btn-primary btn-danger';
    btnEndAll.innerText = '🛑 End Game for Everyone';
    btnEndAll.onclick = () => {
      sendAction('END_GAME');
      leaveGameCleanup('You ended the game.');
    };
    actionsEl.appendChild(btnEndAll);

    const btnForfeit = document.createElement('button');
    btnForfeit.className = 'btn-secondary';
    btnForfeit.style.color = '#fbbf24';
    btnForfeit.innerText = '🏃 Forfeit & Leave Game';
    btnForfeit.onclick = () => {
      sendAction('LEAVE_ROOM');
      leaveGameCleanup('You forfeited and left the game.');
    };
    actionsEl.appendChild(btnForfeit);
  } else if (isHost && !isPlaying) {
    titleEl.innerText = 'Close Lobby?';
    descEl.innerText = 'Are you sure you want to exit? This will close the lobby for all waiting players.';

    const btnCloseLobby = document.createElement('button');
    btnCloseLobby.className = 'btn-primary btn-danger';
    btnCloseLobby.innerText = '🚪 Close Lobby';
    btnCloseLobby.onclick = () => {
      sendAction('LEAVE_ROOM');
      leaveGameCleanup('Lobby closed.');
    };
    actionsEl.appendChild(btnCloseLobby);
  } else {
    titleEl.innerText = 'Leave Game?';
    descEl.innerText = isPlaying
      ? 'Are you sure you want to leave? Your assets will be surrendered to the bank.'
      : 'Are you sure you want to leave this waiting lobby?';

    const btnLeave = document.createElement('button');
    btnLeave.className = 'btn-primary btn-danger';
    btnLeave.innerText = '🚪 Leave Game';
    btnLeave.onclick = () => {
      sendAction('LEAVE_ROOM');
      leaveGameCleanup('You left the game.');
    };
    actionsEl.appendChild(btnLeave);
  }

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn-secondary';
  btnCancel.innerText = appState.isSpectator ? '✕ Keep Watching' : '✕ Cancel & Keep Playing';
  btnCancel.onclick = () => modal.classList.remove('open');
  actionsEl.appendChild(btnCancel);

  modal.classList.add('open');
}
