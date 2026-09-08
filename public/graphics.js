import { BOARD_SPACES, COLOR_GROUPS, TOKEN_ICONS } from './boardData.js';
import { sounds } from './audio.js';

// Board layout coordinate helper (11x11 grid)
// 0: Bottom-Right (GO)
// 1..9: Bottom row (right to left)
// 10: Bottom-Left (Jail)
// 11..19: Left col (bottom to top)
// 20: Top-Left (Free Parking)
// 21..29: Top row (left to right)
// 30: Top-Right (Go to Jail)
// 31..39: Right col (top to bottom)

export function getGridCoordinatesForSpace(spaceId) {
  if (spaceId === 0) return { col: 11, row: 11 }; // GO (bottom-right)
  if (spaceId >= 1 && spaceId <= 9) return { col: 11 - spaceId, row: 11 }; // bottom row
  if (spaceId === 10) return { col: 1, row: 11 }; // Jail (bottom-left)
  if (spaceId >= 11 && spaceId <= 19) return { col: 1, row: 11 - (spaceId - 10) }; // left col
  if (spaceId === 20) return { col: 1, row: 1 }; // Free Parking (top-left)
  if (spaceId >= 21 && spaceId <= 29) return { col: 1 + (spaceId - 20), row: 1 }; // top row
  if (spaceId === 30) return { col: 11, row: 1 }; // Go to Jail (top-right)
  if (spaceId >= 31 && spaceId <= 39) return { col: 11, row: 1 + (spaceId - 30) }; // right col
  return { col: 11, row: 11 };
}

export class BoardRenderer {
  constructor(boardEl, onSpaceClick) {
    this.boardEl = boardEl;
    this.onSpaceClick = onSpaceClick;
    this.spaceElements = new Map();
    this.playerPositions = new Map(); // playerId -> current visual spaceId
    this.animatingPlayers = new Set();
  }

  buildBoard() {
    this.boardEl.innerHTML = '';

    // Create 40 space tiles
    for (const space of BOARD_SPACES) {
      const coords = getGridCoordinatesForSpace(space.id);
      const isCorner = [0, 10, 20, 30].includes(space.id);

      const tile = document.createElement('div');
      tile.className = `board-tile ${isCorner ? 'corner-tile' : 'standard-tile'} type-${space.type}`;
      tile.id = `tile-${space.id}`;
      tile.style.gridColumn = coords.col;
      tile.style.gridRow = coords.row;

      // Color band if street
      if (space.type === 'street' && space.group) {
        const band = document.createElement('div');
        band.className = 'color-band';
        band.style.backgroundColor = COLOR_GROUPS[space.group].hex;
        tile.appendChild(band);
      }

      // Title & Content
      const content = document.createElement('div');
      content.className = 'tile-content';

      const nameEl = document.createElement('div');
      nameEl.className = 'tile-name';
      nameEl.innerText = space.name;
      content.appendChild(nameEl);

      // Icon for specials
      if (space.type === 'railroad') {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        icon.innerText = '🚊';
        content.appendChild(icon);
      } else if (space.type === 'utility') {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        icon.innerText = space.id === 12 ? '💡' : '🚰';
        content.appendChild(icon);
      } else if (space.type === 'chance') {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        icon.innerText = '✈️';
        content.appendChild(icon);
      } else if (space.type === 'community_chest') {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        icon.innerText = '🏛️';
        content.appendChild(icon);
      } else if (space.type === 'free_parking') {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        icon.innerText = '🌳';
        content.appendChild(icon);
      } else if (space.type === 'go_to_jail') {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        icon.innerText = '🚨';
        content.appendChild(icon);
      } else if (space.type === 'jail') {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        icon.innerText = '🏛️';
        content.appendChild(icon);
      } else if (space.type === 'go') {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        icon.innerText = '💵';
        content.appendChild(icon);
      }

      // Price label
      if (space.price) {
        const priceEl = document.createElement('div');
        priceEl.className = 'tile-price';
        priceEl.innerText = `$${space.price}`;
        content.appendChild(priceEl);
      } else if (space.amount) {
        const priceEl = document.createElement('div');
        priceEl.className = 'tile-price';
        priceEl.innerText = `$${space.amount}`;
        content.appendChild(priceEl);
      }

      // Container for house/hotel indicators
      const houseBar = document.createElement('div');
      houseBar.className = 'house-bar';
      houseBar.id = `house-bar-${space.id}`;
      tile.appendChild(houseBar);

      // Ownership badge indicator
      const ownerBar = document.createElement('div');
      ownerBar.className = 'owner-bar';
      ownerBar.id = `owner-bar-${space.id}`;
      tile.appendChild(ownerBar);

      // Container for tokens
      const tokenBox = document.createElement('div');
      tokenBox.className = 'token-container';
      tokenBox.id = `tokens-space-${space.id}`;
      tile.appendChild(tokenBox);

      tile.appendChild(content);

      tile.addEventListener('click', () => {
        if (this.onSpaceClick) this.onSpaceClick(space.id);
      });

      this.boardEl.appendChild(tile);
      this.spaceElements.set(space.id, tile);
    }

    // Center board area (Center Stage)
    const center = document.createElement('div');
    center.className = 'board-center';
    center.id = 'board-center-stage';
    center.innerHTML = `
      <div class="center-branding">
        <h1 class="logo-text" style="font-size: 1.7rem; color: #10b981; letter-spacing: 2px;">HOMETOWN REALITOR</h1>
        <div class="subtitle-text">NEIGHBORHOOD PROPERTY GAME</div>
      </div>
      
      <!-- Town Square Pot Display -->
      <div class="free-parking-pot-card" id="center-pot-display">
        <div class="pot-label">TOWN SQUARE POT</div>
        <div class="pot-amount" id="center-pot-amount">$100</div>
      </div>

      <!-- 3D Decks & Animated Dice Roller Tray -->
      <div class="center-decks-row">
        <!-- 3D Stacked Travel Deck -->
        <div class="card-deck-stack chance-stack" id="deck-chance-stack" title="Travel Deck" style="background: linear-gradient(135deg, #0d9488, #0f766e);">
          <div class="deck-card layer-3"></div>
          <div class="deck-card layer-2"></div>
          <div class="deck-card layer-1">
            <div class="deck-label">TRAVEL</div>
            <div class="deck-icon">✈️</div>
          </div>
        </div>

        <!-- 3D Animated Dice Roller Tray -->
        <div class="dice-tray" id="dice-tray">
          <div class="die" id="die-1">${renderDiePips(1)}</div>
          <div class="die" id="die-2">${renderDiePips(1)}</div>
        </div>

        <!-- 3D Stacked City Council Deck -->
        <div class="card-deck-stack chest-stack" id="deck-chest-stack" title="City Council Deck" style="background: linear-gradient(135deg, #d97706, #b45309);">
          <div class="deck-card layer-3"></div>
          <div class="deck-card layer-2"></div>
          <div class="deck-card layer-1">
            <div class="deck-label">COUNCIL</div>
            <div class="deck-icon">🏛️</div>
          </div>
        </div>
      </div>

      <!-- Turn & Event Status Banner -->
      <div class="center-turn-indicator" id="center-turn-banner">
        Waiting for game to start...
      </div>
    `;
    this.boardEl.appendChild(center);
  }

  // Update space names on the board
  updateSpaceNames(spaceNames) {
    if (!spaceNames) return;
    for (const [idStr, name] of Object.entries(spaceNames)) {
      const spaceId = Number(idStr);
      const tile = this.spaceElements.get(spaceId);
      if (tile) {
        const nameEl = tile.querySelector('.tile-name');
        if (nameEl) nameEl.innerText = name;
      }
    }
  }

  // Update properties ownership and building development
  updateProperties(properties, players, buildingStyle = null) {
    const bStyle = buildingStyle || {
      singleIcon: '🛖',
      topIcon: '🏰',
      singleName: 'Tiny Home',
      topName: 'Luxury Mansion',
      singlePlural: 'Tiny Homes'
    };

    for (const [idStr, prop] of Object.entries(properties)) {
      const spaceId = Number(idStr);
      const ownerBar = document.getElementById(`owner-bar-${spaceId}`);
      const houseBar = document.getElementById(`house-bar-${spaceId}`);
      const tile = this.spaceElements.get(spaceId);

      if (!ownerBar || !houseBar) continue;

      if (prop.ownerId) {
        const owner = players.find(p => p.id === prop.ownerId);
        if (owner) {
          ownerBar.style.display = 'block';
          ownerBar.style.backgroundColor = owner.color;
          ownerBar.title = `Owned by ${owner.name}${prop.mortgaged ? ' (MORTGAGED)' : ''}`;
          if (tile) {
            tile.classList.toggle('is-mortgaged', Boolean(prop.mortgaged));
          }
        }
      } else {
        ownerBar.style.display = 'none';
        if (tile) tile.classList.remove('is-mortgaged');
      }

      // Building Units with 3D drop-in bounce
      houseBar.innerHTML = '';
      if (prop.houses === 5) {
        const topUnit = document.createElement('span');
        topUnit.className = 'hotel-icon animate-pop';
        topUnit.innerText = bStyle.topIcon || '🏰';
        topUnit.title = bStyle.topName || 'Mansion';
        houseBar.appendChild(topUnit);
      } else if (prop.houses > 0) {
        for (let i = 0; i < prop.houses; i++) {
          const unit = document.createElement('span');
          unit.className = 'house-icon animate-pop';
          unit.innerText = bStyle.singleIcon || '🛖';
          unit.title = `${prop.houses} ${bStyle.singlePlural || 'Units'}`;
          houseBar.appendChild(unit);
        }
      }
    }
  }

  // Animate piece movement tile-by-tile with deliberate pacing and spotlight
  animatePlayerMove(player, targetSpaceId, onComplete) {
    const startSpaceId = this.playerPositions.get(player.id) ?? player.position;
    if (startSpaceId === targetSpaceId) {
      this.renderPlayerTokens([player]);
      if (onComplete) onComplete();
      return;
    }

    this.animatingPlayers.add(player.id);

    // Calculate path
    let path = [];
    let current = startSpaceId;
    while (current !== targetSpaceId) {
      current = (current + 1) % 40;
      path.push(current);
    }

    let stepIndex = 0;
    // Deliberate pace: 320ms per hop so user can comfortably track piece around the board
    const stepDuration = 320;

    const interval = setInterval(() => {
      // Clear previous tile highlight
      if (stepIndex > 0) {
        const prevTile = this.spaceElements.get(path[stepIndex - 1]);
        if (prevTile) prevTile.classList.remove('stepping-active');
      }

      if (stepIndex >= path.length) {
        clearInterval(interval);
        this.animatingPlayers.delete(player.id);
        this.playerPositions.set(player.id, targetSpaceId);
        sounds.playStep();
        this.triggerTileRipple(targetSpaceId, player.color);
        if (onComplete) onComplete();
        return;
      }

      const nextSpaceId = path[stepIndex];
      const nextTile = this.spaceElements.get(nextSpaceId);
      if (nextTile) nextTile.classList.add('stepping-active');

      this._moveTokenElementToSpace(player, nextSpaceId, true);
      sounds.playStep();
      stepIndex++;
    }, stepDuration);
  }

  // Go To Jail Cinematic Transition
  animateGoToJail(player, onComplete) {
    sounds.playSiren();
    const board = this.boardEl;
    if (!board) {
      if (onComplete) onComplete();
      return;
    }

    // 1. Add police siren flashing overlay
    const siren = document.createElement('div');
    siren.className = 'jail-siren-overlay';
    board.appendChild(siren);

    // 2. Add arrest banner
    const banner = document.createElement('div');
    banner.className = 'jail-arrest-banner';
    banner.innerHTML = `🚨 CODE VIOLATION! ${player.name}<br><span style="font-size: 1rem; color: #f87171;">REPORT DIRECTLY TO CITY HALL</span>`;
    board.appendChild(banner);

    // 3. Glide token straight to Jail (Space 10)
    setTimeout(() => {
      sounds.playJail();
      this.playerPositions.set(player.id, 10);
      this._moveTokenElementToSpace(player, 10, true);

      // 4. Drop iron bars over tile 10
      const jailTile = this.spaceElements.get(10);
      let bars = null;
      if (jailTile) {
        bars = document.createElement('div');
        bars.className = 'jail-bars-overlay';
        jailTile.appendChild(bars);
      }

      setTimeout(() => {
        siren.remove();
        banner.remove();
        if (bars) {
          setTimeout(() => bars.remove(), 1400);
        }
        if (onComplete) onComplete();
      }, 1400);
    }, 900);
  }

  // Corner orientation helper
  _getCornerRotation(spaceId) {
    if (spaceId >= 0 && spaceId <= 9) return 0; // Bottom row: moving left
    if (spaceId >= 10 && spaceId <= 19) return 90; // Left column: moving up
    if (spaceId >= 20 && spaceId <= 29) return 180; // Top row: moving right
    if (spaceId >= 30 && spaceId <= 39) return 270; // Right column: moving down
    return 0;
  }

  _moveTokenElementToSpace(player, spaceId, isHopping = false) {
    // Remove old token instance if present
    const existing = document.getElementById(`token-${player.id}`);
    if (existing) existing.remove();

    const container = document.getElementById(`tokens-space-${spaceId}`);
    if (container) {
      const wrapper = document.createElement('div');
      wrapper.id = `token-${player.id}`;
      wrapper.className = 'token-wrapper';

      const rotation = this._getCornerRotation(spaceId);
      wrapper.style.transform = `rotate(${rotation}deg)`;

      const shadow = document.createElement('div');
      shadow.className = 'token-shadow';
      wrapper.appendChild(shadow);

      const token = document.createElement('div');
      token.className = `player-token ${isHopping ? 'parabolic-hop' : ''}`;
      token.style.borderColor = player.color;
      token.style.boxShadow = `0 0 10px ${player.color}`;
      token.innerText = TOKEN_ICONS[player.tokenIcon] || '🛹';
      token.title = `${player.name} ($${player.money})`;

      wrapper.appendChild(token);
      container.appendChild(wrapper);
    }
  }

  renderPlayerTokens(players) {
    // Render static tokens for players not currently hopping
    for (const player of players) {
      if (player.bankrupt) {
        const el = document.getElementById(`token-${player.id}`);
        if (el) el.remove();
        continue;
      }
      if (!this.animatingPlayers.has(player.id)) {
        this.playerPositions.set(player.id, player.position);
        this._moveTokenElementToSpace(player, player.position, false);
      }
    }
  }

  // Version 1.5: 3D Rolling Dice Animation with Pips & Zoom-In Callout
  animateDiceRoll(d1, d2, isDoubles, onFinish) {
    sounds.playDiceRoll();
    const die1 = document.getElementById('die-1');
    const die2 = document.getElementById('die-2');
    const diceTray = document.getElementById('dice-tray');
    if (!die1 || !die2) return;

    die1.classList.add('rolling');
    die2.classList.add('rolling');

    let count = 0;
    const flicker = setInterval(() => {
      const r1 = Math.floor(Math.random() * 6) + 1;
      const r2 = Math.floor(Math.random() * 6) + 1;
      die1.innerHTML = renderDiePips(r1);
      die2.innerHTML = renderDiePips(r2);
      count++;
      if (count > 9) {
        clearInterval(flicker);
        die1.classList.remove('rolling');
        die2.classList.remove('rolling');
        die1.innerHTML = renderDiePips(d1);
        die2.innerHTML = renderDiePips(d2);

        // Zoom-in showcase callout
        if (diceTray) {
          diceTray.classList.add('zoomed');
          let callout = diceTray.querySelector('.dice-roll-callout');
          if (!callout) {
            callout = document.createElement('div');
            callout.className = 'dice-roll-callout';
            diceTray.appendChild(callout);
          }
          callout.innerText = `🎲 ROLLED ${d1} & ${d2} (${d1 + d2})${isDoubles ? ' - DOUBLES!' : ''}`;
        }

        if (isDoubles) {
          die1.classList.add('doubles-glow');
          die2.classList.add('doubles-glow');
        }

        // Savor pause: 850ms so user can enjoy seeing what was rolled
        setTimeout(() => {
          if (diceTray) {
            diceTray.classList.remove('zoomed');
            const callout = diceTray.querySelector('.dice-roll-callout');
            if (callout) callout.remove();
          }
          die1.classList.remove('doubles-glow');
          die2.classList.remove('doubles-glow');
          if (onFinish) onFinish();
        }, 850);
      }
    }, 60);
  }

  // Version 1.5: Landing Ripple Impact
  triggerTileRipple(spaceId, color = '#fbbf24') {
    const tile = this.spaceElements.get(spaceId);
    if (!tile) return;

    const ripple = document.createElement('div');
    ripple.className = 'landing-ripple';
    ripple.style.borderColor = color;
    tile.appendChild(ripple);

    setTimeout(() => ripple.remove(), 700);
  }

  // Floating Cash Change Tag (+/- $200)
  showFloatingMoney(spaceId, amount, isPositive = true) {
    const tile = this.spaceElements.get(spaceId);
    if (!tile) return;

    const pop = document.createElement('div');
    pop.className = `floating-money ${isPositive ? 'positive' : 'negative'}`;
    pop.innerText = `${isPositive ? '+' : '-'}$${Math.abs(amount)}`;
    tile.appendChild(pop);

    setTimeout(() => {
      pop.remove();
    }, 1800);
  }

  // Version 1.5: Free Parking Jackpot Coin Shower Celebration
  triggerJackpotCoinsCelebration() {
    sounds.playFanfare();
    const potDisplay = document.getElementById('center-pot-display');
    const rect = potDisplay ? potDisplay.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };

    for (let i = 0; i < 28; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-particle';
      coin.style.left = `${rect.left + rect.width / 2}px`;
      coin.style.top = `${rect.top + rect.height / 2}px`;

      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 160;
      const vx = Math.cos(angle) * dist;
      const vy = Math.sin(angle) * dist - 30; // slightly upward arc

      coin.style.setProperty('--vx', `${vx}px`);
      coin.style.setProperty('--vy', `${vy}px`);

      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 1400);
    }
  }
}

// 3D Pip Renderer Helper (1 to 6)
export function renderDiePips(val) {
  const value = Math.max(1, Math.min(6, Number(val) || 1));
  const pips = [];
  if (value === 1) pips.push('pip-center');
  if (value === 2) pips.push('pip-tl', 'pip-br');
  if (value === 3) pips.push('pip-tl', 'pip-center', 'pip-br');
  if (value === 4) pips.push('pip-tl', 'pip-tr', 'pip-bl', 'pip-br');
  if (value === 5) pips.push('pip-tl', 'pip-tr', 'pip-center', 'pip-bl', 'pip-br');
  if (value === 6) pips.push('pip-tl', 'pip-tr', 'pip-ml', 'pip-mr', 'pip-bl', 'pip-br');

  return `<div class="die-pips-grid val-${value}">${pips.map(p => `<span class="pip ${p}"></span>`).join('')}</div>`;
}
