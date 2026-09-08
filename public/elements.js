// DOM Elements and UI Utility Helpers

export const els = {
  // Navigation & LAN
  lanUrlText: document.getElementById('lan-url-text'),
  btnCopyLan: document.getElementById('btn-copy-lan'),
  btnToggleSound: document.getElementById('btn-toggle-sound'),
  navRoomBadge: document.getElementById('nav-room-badge'),
  btnExitGame: document.getElementById('btn-exit-game'),

  // Toasts
  toastContainer: document.getElementById('toast-container'),

  // Screens
  lobbyScreen: document.getElementById('lobby-screen'),
  waitingScreen: document.getElementById('room-waiting-screen'),
  gameScreen: document.getElementById('game-screen'),
  turnActionBar: document.getElementById('turn-action-bar'),

  // Waiting Room
  waitingRoomCode: document.getElementById('waiting-room-code'),
  waitingPlayersList: document.getElementById('waiting-players-list'),
  btnStartGame: document.getElementById('btn-start-game'),
  waitingHostNotice: document.getElementById('waiting-host-notice'),
  btnAddBot: document.getElementById('btn-add-bot'),
  btnLeaveWaiting: document.getElementById('btn-leave-waiting'),

  // HUD & Game Info
  hudPlayersContainer: document.getElementById('hud-players-container'),
  hudRulesSummary: document.getElementById('hud-rules-summary'),
  activityLogBox: document.getElementById('activity-log-box'),
  spectatorActionNotice: document.getElementById('spectator-action-notice'),

  // Action Buttons
  btnRoll: document.getElementById('btn-action-roll'),
  btnBuy: document.getElementById('btn-action-buy'),
  btnDecline: document.getElementById('btn-action-decline'),
  btnTrade: document.getElementById('btn-action-trade'),
  btnJailFine: document.getElementById('btn-action-jail-fine'),
  btnJailCard: document.getElementById('btn-action-jail-card'),
  btnJailRoll: document.getElementById('btn-action-jail-roll'),
  btnEnd: document.getElementById('btn-action-end'),
  btnBankruptcy: document.getElementById('btn-action-bankruptcy'),
  btnLiquidate: document.getElementById('btn-action-liquidate'),

  // In-Game Chat
  chatInput: document.getElementById('chat-input'),
  btnSendChat: document.getElementById('btn-send-chat'),

  // Directory & Session
  joinableRoomsList: document.getElementById('joinable-rooms-list'),
  btnRefreshRooms: document.getElementById('btn-refresh-rooms'),
  reconnectBox: document.getElementById('reconnect-box'),
  btnResumeSession: document.getElementById('btn-resume-session'),

  // Modals: Card Draw
  modalCardDraw: document.getElementById('modal-card-draw'),
  cardDrawType: document.getElementById('card-draw-type'),
  cardDrawText: document.getElementById('card-draw-text'),
  cardDisplayBox: document.getElementById('card-display-box'),
  btnCloseCard: document.getElementById('btn-close-card'),

  // Modals: Deed Inspector
  modalDeed: document.getElementById('modal-deed'),
  deedTitle: document.getElementById('deed-title'),
  deedBody: document.getElementById('deed-body'),
  deedActions: document.getElementById('deed-actions'),
  btnCloseDeed: document.getElementById('btn-close-deed'),

  // Modals: Auction
  modalAuction: document.getElementById('modal-auction'),
  auctionPropName: document.getElementById('auction-prop-name'),
  auctionHighBid: document.getElementById('auction-high-bid'),
  auctionHighBidder: document.getElementById('auction-high-bidder'),
  btnPassAuction: document.getElementById('btn-pass-auction'),
  btnBid10: document.getElementById('btn-bid-10'),
  btnBid50: document.getElementById('btn-bid-50'),
  btnBid100: document.getElementById('btn-bid-100'),

  // Modals: Trade
  modalTrade: document.getElementById('modal-trade'),
  tradeTargetPlayer: document.getElementById('trade-target-player'),
  tradeOfferPropsList: document.getElementById('trade-offer-props-list'),
  tradeRequestPropsList: document.getElementById('trade-request-props-list'),
  tradeOfferCash: document.getElementById('trade-offer-cash'),
  tradeRequestCash: document.getElementById('trade-request-cash'),
  btnCloseTrade: document.getElementById('btn-close-trade'),
  btnSendTradeOffer: document.getElementById('btn-send-trade-offer'),
  modalTradeIncoming: document.getElementById('modal-trade-incoming'),
  incomingTradeDetails: document.getElementById('incoming-trade-details'),
  btnAcceptTrade: document.getElementById('btn-accept-trade'),
  btnRejectTrade: document.getElementById('btn-reject-trade'),

  // Modals: Rent Negotiation
  modalRentNegotiation: document.getElementById('modal-rent-negotiation'),
  rentNegotiationSummary: document.getElementById('rent-negotiation-summary'),
  rentOfferCash: document.getElementById('rent-offer-cash'),
  rentOfferProperty: document.getElementById('rent-offer-property'),
  rentOfferJailGroup: document.getElementById('rent-offer-jail-group'),
  rentOfferJailCard: document.getElementById('rent-offer-jail-card'),
  btnPayFullRent: document.getElementById('btn-pay-full-rent'),
  btnProposeRentDeal: document.getElementById('btn-propose-rent-deal'),
  modalRentIncoming: document.getElementById('modal-rent-incoming'),
  incomingRentDealDetails: document.getElementById('incoming-rent-deal-details'),
  btnAcceptRentDeal: document.getElementById('btn-accept-rent-deal'),
  btnRejectRentDeal: document.getElementById('btn-reject-rent-deal'),

  // Modals: Winner Celebration
  modalWinner: document.getElementById('modal-winner'),
  winnerNameDisplay: document.getElementById('winner-name-display'),
  winnerDetailDisplay: document.getElementById('winner-detail-display'),
  btnRematch: document.getElementById('btn-rematch'),
  btnWinnerExit: document.getElementById('btn-winner-exit'),

  // Modals: Confirm Exit
  modalConfirmExit: document.getElementById('modal-confirm-exit'),
  exitModalTitle: document.getElementById('exit-modal-title'),
  exitModalDesc: document.getElementById('exit-modal-desc'),
  exitModalActions: document.getElementById('exit-modal-actions'),

  // Modals: Street Customizer
  modalStreetCustomizer: document.getElementById('modal-street-customizer'),
  customStreetsList: document.getElementById('custom-streets-list'),
  btnOpenStreetCustomizer: document.getElementById('btn-open-street-customizer'),
  btnCloseCustomizer: document.getElementById('btn-close-customizer'),
  btnSaveCustomStreets: document.getElementById('btn-save-custom-streets'),
  btnPresetHometown: document.getElementById('btn-preset-hometown'),
  btnPresetBeach: document.getElementById('btn-preset-beach'),
  btnPresetMetro: document.getElementById('btn-preset-metro'),
  btnResetStreets: document.getElementById('btn-reset-streets'),

  // Modals: Deed Presentation Showcase
  modalDeedPresentation: document.getElementById('modal-deed-presentation'),
  deedShowcaseEventBadge: document.getElementById('deed-showcase-event-badge'),
  presentedDeedTop: document.getElementById('presented-deed-top'),
  presentedDeedName: document.getElementById('presented-deed-name'),
  presentedDeedOwnerBanner: document.getElementById('presented-deed-owner-banner'),
  presentedDeedOwnerToken: document.getElementById('presented-deed-owner-token'),
  presentedDeedOwnerName: document.getElementById('presented-deed-owner-name'),
  presentedDeedRentBody: document.getElementById('presented-deed-rent-body'),
  presentedDeedFooter: document.getElementById('presented-deed-footer'),
  deedTimerBar: document.getElementById('deed-timer-bar')
};

// Center Stage dynamic getters
export function getCenterPotAmount() {
  return document.getElementById('center-pot-amount');
}

export function getCenterTurnBanner() {
  return document.getElementById('center-turn-banner');
}

// Toast notification helper
export function showToast(text, type = 'info') {
  const container = els.toastContainer || document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'danger') toast.style.borderLeftColor = '#ef4444';
  if (type === 'success') toast.style.borderLeftColor = '#22c55e';
  if (type === 'warning') toast.style.borderLeftColor = '#f59e0b';
  toast.innerText = text;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
