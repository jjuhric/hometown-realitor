import { BOARD_SPACES } from './boardData.js';

export const DEFAULT_TOKENS = ['skateboard', 'bicycle', 'scooter', 'rollerblade', 'delivery_van', 'dog', 'basketball', 'lawnmower'];
export const DEFAULT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#e84393'];

export const appState = {
  ws: null,
  currentRoomId: null,
  myPlayerId: null,
  gameState: null,
  boardRenderer: null,
  lanInfo: null,
  isSpectator: false,
  selectedToken: DEFAULT_TOKENS[0],
  selectedColor: DEFAULT_COLORS[0],
  prevDice: [1, 1],
  prevPositions: new Map(),
  customSpaceNames: {},
  themesData: null,
  lastJailTimestamp: 0,
  lastPresentedPropertyTimestamp: 0,
  deedPresentationTimeout: null
};

export function calculateNetWorth(playerId) {
  const p = appState.gameState?.players?.find(pl => pl.id === playerId);
  if (!p) return 0;
  let net = p.money;
  if (appState.gameState?.properties) {
    for (const [idStr, prop] of Object.entries(appState.gameState.properties)) {
      if (prop.ownerId === playerId) {
        const s = BOARD_SPACES[Number(idStr)];
        if (!s) continue;
        net += prop.mortgaged ? s.mortgage : s.price;
        if (s.type === 'street' && prop.houses > 0) {
          net += prop.houses * s.houseCost;
        }
      }
    }
  }
  return net;
}

export function resetSessionState() {
  appState.currentRoomId = null;
  appState.myPlayerId = null;
  appState.gameState = null;
  appState.isSpectator = false;
  window.gameState = null;
  if (appState.ws) {
    try {
      appState.ws.close();
    } catch (e) {}
    appState.ws = null;
  }
}
