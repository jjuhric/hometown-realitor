import { BOARD_SPACES, COLOR_GROUPS, CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from './boardData.js';
import { sanitizeRules } from './rulesConfig.js';
import { saveRoomState } from './persistence.js';
import { BUILDING_STYLES, NEIGHBORHOOD_PRESETS } from './themes.js';

export class GameEngine {
  constructor(roomId, hostId, userRules = {}) {
    this.id = roomId;
    this.hostId = hostId;
    this.status = 'lobby'; // 'lobby' | 'playing' | 'finished'
    this.rules = sanitizeRules(userRules);

    this.players = [];
    this.currentTurnIndex = 0;
    this.turnPhase = 'ROLL'; // 'ROLL' | 'ACTION' | 'AUCTION' | 'JAIL_DECISION' | 'END_TURN'
    this.dice = [1, 1];
    this.doublesCount = 0;
    this.lastRollWasDoubles = false;
    this.freeParkingPot = this.rules.freeParkingJackpot ? this.rules.freeParkingSeed : 0;

    // Property state: spaceId -> { ownerId, houses: 0..5, mortgaged: false }
    this.properties = {};
    for (const space of BOARD_SPACES) {
      if (['street', 'railroad', 'utility'].includes(space.type)) {
        this.properties[space.id] = {
          ownerId: null,
          houses: 0,
          mortgaged: false
        };
      }
    }

    this.bankHouses = this.rules.unlimitedHouses ? 9999 : 32;
    this.bankHotels = this.rules.unlimitedHouses ? 9999 : 12;

    this.chanceDeck = this._shuffle([...Array(CHANCE_CARDS.length).keys()]);
    this.chanceIndex = 0;
    this.communityChestDeck = this._shuffle([...Array(COMMUNITY_CHEST_CARDS.length).keys()]);
    this.communityChestIndex = 0;

    this.pendingAuction = null;
    this.pendingTrade = null;
    this.pendingRent = null;
    this.lastJailEvent = null;
    this.lastDrawnCard = null;
    this.lastPropertyEvent = null;
    this.lastCreditorId = null;
    this.winner = null;
    this.spectators = [];
    this.logs = [];

    this._addLog(`Room ${roomId} created. Rules configured.`);
  }

  // Restore game engine from a saved JSON state
  static fromJSON(data) {
    const engine = Object.assign(new GameEngine(data.id, data.hostId, data.rules), data);
    if (!engine.spectators) engine.spectators = [];
    return engine;
  }

  getBuildingStyle() {
    return BUILDING_STYLES[this.rules.buildingStyle] || BUILDING_STYLES.TINY_MANSION;
  }

  getSpaceName(spaceId) {
    if (this.rules.customSpaceNames && this.rules.customSpaceNames[spaceId]) {
      return this.rules.customSpaceNames[spaceId];
    }
    const preset = NEIGHBORHOOD_PRESETS[this.rules.neighborhoodPreset];
    if (preset && preset.spaces && preset.spaces[spaceId]) {
      return preset.spaces[spaceId];
    }
    return BOARD_SPACES[spaceId]?.name || `Space ${spaceId}`;
  }

  getAllSpaceNames() {
    const names = {};
    for (let i = 0; i < 40; i++) {
      names[i] = this.getSpaceName(i);
    }
    return names;
  }

  toJSON() {
    return {
      id: this.id,
      hostId: this.hostId,
      status: this.status,
      rules: this.rules,
      buildingStyle: this.getBuildingStyle(),
      spaceNames: this.getAllSpaceNames(),
      players: this.players,
      currentTurnIndex: this.currentTurnIndex,
      turnPhase: this.turnPhase,
      dice: this.dice,
      doublesCount: this.doublesCount,
      lastRollWasDoubles: this.lastRollWasDoubles,
      freeParkingPot: this.freeParkingPot,
      properties: this.properties,
      bankHouses: this.bankHouses,
      bankHotels: this.bankHotels,
      chanceDeck: this.chanceDeck,
      chanceIndex: this.chanceIndex,
      communityChestDeck: this.communityChestDeck,
      communityChestIndex: this.communityChestIndex,
      pendingAuction: this.pendingAuction,
      pendingTrade: this.pendingTrade,
      pendingRent: this.pendingRent,
      lastJailEvent: this.lastJailEvent,
      lastDrawnCard: this.lastDrawnCard,
      lastPropertyEvent: this.lastPropertyEvent,
      lastCreditorId: this.lastCreditorId,
      winner: this.winner,
      spectators: this.spectators || [],
      netWorths: this.getNetWorths(),
      logs: this.logs.slice(-100) // keep last 100 logs
    };
  }

  persist() {
    saveRoomState(this.id, this.toJSON());
  }

  _addLog(text, type = 'info') {
    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      text,
      type
    };
    this.logs.push(entry);
    if (this.logs.length > 150) this.logs.shift();
  }

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  updateRules(newRules) {
    if (this.status !== 'lobby') return false;
    this.rules = sanitizeRules({ ...this.rules, ...newRules });
    this.freeParkingPot = this.rules.freeParkingJackpot ? this.rules.freeParkingSeed : 0;
    this.bankHouses = this.rules.unlimitedHouses ? 9999 : 32;
    this.bankHotels = this.rules.unlimitedHouses ? 9999 : 12;
    this._addLog('Host updated room rules.');
    this.persist();
    return true;
  }

  addPlayer(playerId, name, color = null, tokenIcon = 'car', isBot = false) {
    if (this.status !== 'lobby') {
      // Check if reconnecting
      const existing = this.players.find(p => p.id === playerId);
      if (existing) {
        existing.connected = true;
        this._addLog(`${existing.name} reconnected to the game.`, 'success');
        this.persist();
        return existing;
      }
      return null;
    }

    if (this.players.length >= 8) return null;

    const DEFAULT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#e84393'];
    const chosenColor = color || DEFAULT_COLORS[this.players.length % DEFAULT_COLORS.length];

    const player = {
      id: playerId,
      name: name.trim() || `Player ${this.players.length + 1}`,
      color: chosenColor,
      tokenIcon,
      money: this.rules.startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutOfJailCards: { chance: false, communityChest: false },
      bankrupt: false,
      connected: true,
      isBot: Boolean(isBot)
    };

    this.players.push(player);
    this._addLog(`${player.name} joined the lobby.`);
    this.persist();
    return player;
  }

  removePlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    if (this.status === 'lobby') {
      this.players = this.players.filter(p => p.id !== playerId);
      if (this.hostId === playerId && this.players.length > 0) {
        this.hostId = this.players[0].id;
      }
      this._addLog(`${player.name} left the room.`);
    } else {
      player.connected = false;
      this._addLog(`${player.name} disconnected.`);
    }
    this.persist();
  }

  addSpectator(spectatorId, name) {
    if (!this.spectators) this.spectators = [];
    const existing = this.spectators.find(s => s.id === spectatorId);
    if (existing) {
      existing.name = name || existing.name;
      return existing;
    }
    const spectator = {
      id: spectatorId,
      name: name || 'Spectator',
      joinedAt: Date.now()
    };
    this.spectators.push(spectator);
    this._addLog(`👁️ ${spectator.name} joined as a spectator.`, 'info');
    this.persist();
    return spectator;
  }

  removeSpectator(spectatorId) {
    if (!this.spectators) return;
    const idx = this.spectators.findIndex(s => s.id === spectatorId);
    if (idx !== -1) {
      const spec = this.spectators[idx];
      this.spectators.splice(idx, 1);
      this._addLog(`👁️ ${spec.name} stopped spectating.`, 'info');
      this.persist();
    }
  }

  startGame(requestPlayerId) {
    if (this.hostId !== requestPlayerId) throw new Error('Only the host can start the game.');
    if (this.players.length < 1) throw new Error('At least 1 player is required to start.');
    if (this.status !== 'lobby') throw new Error('Game has already started.');

    this.status = 'playing';
    this.currentTurnIndex = 0;
    this.turnPhase = this.getActivePlayer().inJail ? 'JAIL_DECISION' : 'ROLL';
    this.doublesCount = 0;
    this._addLog(`Game started! It's ${this.getActivePlayer().name}'s turn.`, 'turn');
    this.persist();
    return true;
  }

  getActivePlayer() {
    return this.players[this.currentTurnIndex];
  }

  _nextTurn() {
    this.lastDrawnCard = null;
    this.lastPropertyEvent = null;
    this.doublesCount = 0;
    this.lastRollWasDoubles = false;

    // Check mercy rule
    if (this.rules.mercyRuleNetWorth > 0) {
      for (const p of this.players.filter(pl => !pl.bankrupt)) {
        if (this.calculateNetWorth(p.id) >= this.rules.mercyRuleNetWorth) {
          this._setWinner(p, `reached the target net worth of $${this.rules.mercyRuleNetWorth}!`);
          return;
        }
      }
    }

    // Check last player standing (if multi-player game)
    const activeRemaining = this.players.filter(p => !p.bankrupt);
    if (this.players.length > 1 && activeRemaining.length === 1) {
      this._setWinner(activeRemaining[0], 'is the last solvent player standing!');
      return;
    }

    // Advance to next non-bankrupt player
    let nextIdx = (this.currentTurnIndex + 1) % this.players.length;
    let count = 0;
    while (this.players[nextIdx].bankrupt && count < this.players.length) {
      nextIdx = (nextIdx + 1) % this.players.length;
      count++;
    }

    this.currentTurnIndex = nextIdx;
    const player = this.getActivePlayer();
    this.turnPhase = player.inJail ? 'JAIL_DECISION' : 'ROLL';
    this._addLog(`Turn begins for ${player.name}.`, 'turn');
    this.persist();
  }

  _setWinner(player, reason) {
    this.status = 'finished';
    this.winner = player;
    this.turnPhase = 'END_TURN';
    this._addLog(`🏆 ${player.name} WON THE GAME! ${reason}`, 'winner');
    this.persist();
  }

  // Turn Action: Roll Dice
  rollDice(playerId) {
    const player = this.getActivePlayer();
    if (player.id !== playerId) throw new Error('Not your turn.');
    if (this.turnPhase !== 'ROLL') throw new Error(`Cannot roll during phase: ${this.turnPhase}`);

    this.lastPropertyEvent = null;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    this.dice = [d1, d2];
    const isDoubles = d1 === d2;
    this.lastRollWasDoubles = isDoubles;

    this._addLog(`${player.name} rolled ${d1} and ${d2} (Total: ${d1 + d2})${isDoubles ? ' - DOUBLES!' : ''}`, 'dice');

    // House Rule: Snake Eyes Bonus
    if (this.rules.snakeEyesBonus && d1 === 1 && d2 === 1) {
      player.money += this.rules.snakeEyesReward;
      this._addLog(`🎲 LUCKY ROLLER! ${player.name} rolled Snake Eyes (1-1) and collected a $${this.rules.snakeEyesReward} bonus!`, 'bonus');
    }

    if (isDoubles) {
      this.doublesCount++;
      if (this.doublesCount === 3) {
        this._addLog(`${player.name} rolled doubles 3 times in a row! Go straight to Jail!`, 'warning');
        this._sendToJail(player);
        this.persist();
        return { dice: this.dice, doubles: true, jailed: true };
      }
    } else {
      this.doublesCount = 0;
    }

    // Move player
    const oldPos = player.position;
    const diceSum = d1 + d2;
    const newPos = (oldPos + diceSum) % 40;

    // Check passing or landing on GO
    if (newPos < oldPos) {
      // Wrapped around 40
      if (newPos === 0 && this.rules.doubleGoBonus) {
        player.money += 400;
        this._addLog(`🎯 ${player.name} landed directly on PAYDAY! Collected Double Salary ($400)!`, 'bonus');
      } else {
        player.money += 200;
        this._addLog(`${player.name} passed PAYDAY and collected $200 Salary.`);
      }
    } else if (newPos === 0) {
      // Landed on Payday without wrapping
      const amt = this.rules.doubleGoBonus ? 400 : 200;
      player.money += amt;
      this._addLog(`${player.name} landed on PAYDAY and collected $${amt} Salary!`);
    }

    player.position = newPos;
    this._resolveSpace(player, diceSum, isDoubles);
    this.persist();
    return { dice: this.dice, doubles: isDoubles, newPosition: newPos };
  }

  _finishTurnAction(player, isDoubles = false) {
    if (player && player.money < 0) {
      this.turnPhase = 'RESOLVE_DEBT';
    } else {
      this.turnPhase = isDoubles ? 'ROLL' : 'END_TURN';
    }
  }

  _resolveSpace(player, diceSum, isDoubles) {
    const space = BOARD_SPACES[player.position];
    const spaceName = this.getSpaceName(player.position);
    this._addLog(`${player.name} landed on ${spaceName}.`);

    switch (space.type) {
      case 'go':
        this._finishTurnAction(player, isDoubles);
        break;

      case 'street':
      case 'railroad':
      case 'utility': {
        const propState = this.properties[space.id];
        if (!propState.ownerId) {
          // Unowned property
          this.turnPhase = 'ACTION';
        } else if (propState.ownerId === player.id) {
          // Own property
          this._addLog(`${player.name} already owns ${space.name}.`);
          this._finishTurnAction(player, isDoubles);
        } else {
          // Owned by someone else -> Pay rent
          this._payRent(player, space, diceSum, isDoubles);
        }
        break;
      }

      case 'tax': {
        const taxAmount = space.amount;
        this._deductMoney(player, taxAmount, 'tax', `${space.name}`);
        if (this.rules.freeParkingJackpot) {
          this.freeParkingPot += taxAmount;
          this._addLog(`💰 $${taxAmount} from ${space.name} was added to Free Parking Pot! (Pot: $${this.freeParkingPot})`, 'bonus');
        }
        this._finishTurnAction(player, isDoubles);
        break;
      }

      case 'free_parking': {
        if (this.rules.freeParkingJackpot && this.freeParkingPot > 0) {
          const jackpot = this.freeParkingPot;
          player.money += jackpot;
          this.freeParkingPot = this.rules.freeParkingSeed;
          this._addLog(`🎉 FREE PARKING JACKPOT! ${player.name} won the entire pot of $${jackpot}!`, 'winner');
        } else {
          this._addLog(`${player.name} rests at Free Parking.`);
        }
        this._finishTurnAction(player, isDoubles);
        break;
      }

      case 'go_to_jail': {
        this._addLog(`${player.name} was caught! Go to Jail!`, 'warning');
        this._sendToJail(player);
        break;
      }

      case 'jail': {
        this._addLog(`${player.name} is just visiting Jail.`);
        this._finishTurnAction(player, isDoubles);
        break;
      }

      case 'chance': {
        this._drawCard(player, 'chance', isDoubles);
        break;
      }

      case 'community_chest': {
        this._drawCard(player, 'community_chest', isDoubles);
        break;
      }

      default:
        this._finishTurnAction(player, isDoubles);
        break;
    }
  }

  _payRent(player, space, diceSum, isDoubles) {
    const propState = this.properties[space.id];
    const owner = this.players.find(p => p.id === propState.ownerId);

    if (propState.mortgaged) {
      this._addLog(`${space.name} is mortgaged. No rent owed.`);
      this._finishTurnAction(player, isDoubles);
      return;
    }

    // House Rule: No rent while in jail
    if (this.rules.noRentInJail && owner.inJail) {
      this._addLog(`⚖️ ${owner.name} is in Jail! Due to house rules, no rent is collected.`);
      this._finishTurnAction(player, isDoubles);
      return;
    }

    let rent = 0;
    if (space.type === 'street') {
      const houses = propState.houses;
      if (houses > 0) {
        rent = space.rent[houses];
      } else {
        // Unimproved: double rent if owner has monopoly
        const hasMonopoly = this.hasMonopoly(owner.id, space.group);
        rent = hasMonopoly ? space.rent[0] * 2 : space.rent[0];
      }
    } else if (space.type === 'railroad') {
      const count = this.getOwnedCountInGroup(owner.id, 'RAILROAD');
      rent = space.rent[Math.min(count - 1, 3)];
    } else if (space.type === 'utility') {
      const count = this.getOwnedCountInGroup(owner.id, 'UTILITY');
      const multiplier = count === 2 ? 10 : 4;
      rent = diceSum * multiplier;
    }

    this._addLog(`${player.name} owes $${rent} rent to ${owner.name} for ${space.name}.`);

    if (this.rules.rentNegotiation && rent > 0) {
      this.pendingRent = {
        debtorId: player.id,
        creditorId: owner.id,
        spaceId: space.id,
        rent,
        isDoubles,
        dealOffer: null
      };
      this.turnPhase = 'RENT_NEGOTIATION';
      this._addLog(`🤝 Rent negotiation is available between ${player.name} and ${owner.name}.`, 'trade');
    } else {
      this._transferMoney(player, owner, rent);
      this._finishTurnAction(player, isDoubles);
    }
  }

  _sendToJail(player) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    this.doublesCount = 0;
    this.lastJailEvent = { playerId: player.id, timestamp: Date.now() };
    this.turnPhase = 'END_TURN';
  }

  // --- Rent & Debt Negotiation Methods ---
  payPendingRent(debtorId) {
    if (!this.pendingRent) throw new Error('No pending rent to pay.');
    if (this.pendingRent.debtorId !== debtorId) throw new Error('Not your rent to pay.');

    const { debtorId: dId, creditorId: cId, spaceId, rent, isDoubles } = this.pendingRent;
    const debtor = this.players.find(p => p.id === dId);
    const creditor = this.players.find(p => p.id === cId);
    const space = BOARD_SPACES[spaceId];

    this._addLog(`${debtor.name} paid $${rent} rent to ${creditor.name} for ${space.name}.`);
    this._transferMoney(debtor, creditor, rent);

    this.pendingRent = null;
    this._finishTurnAction(debtor, isDoubles);
    this.persist();
    return true;
  }

  proposeRentDeal(debtorId, offer) {
    if (!this.pendingRent) throw new Error('No pending rent to negotiate.');
    if (this.pendingRent.debtorId !== debtorId) throw new Error('Not your rent to negotiate.');

    const debtor = this.players.find(p => p.id === debtorId);
    const creditor = this.players.find(p => p.id === this.pendingRent.creditorId);

    const cashOffer = Math.max(0, Number(offer.cashOffer) || 0);
    if (debtor.money < cashOffer) throw new Error('You do not have enough cash for that offer.');

    const propertyOffer = (offer.propertyOffer !== null && offer.propertyOffer !== undefined && offer.propertyOffer !== '') 
      ? Number(offer.propertyOffer) 
      : null;

    if (propertyOffer !== null) {
      if (this.properties[propertyOffer]?.ownerId !== debtorId) throw new Error('You do not own that property.');
      if (this.properties[propertyOffer]?.houses > 0) throw new Error('Cannot trade properties with houses.');
    }

    const jailCardOffer = Boolean(offer.jailCardOffer);
    if (jailCardOffer && !debtor.getOutOfJailCards.chance && !debtor.getOutOfJailCards.communityChest) {
      throw new Error('You do not have a Get Out of Jail Free card.');
    }

    this.pendingRent.dealOffer = {
      cashOffer,
      propertyOffer,
      jailCardOffer
    };

    let offerDesc = `$${cashOffer}`;
    if (propertyOffer !== null) offerDesc += ` + ${BOARD_SPACES[propertyOffer].name}`;
    if (jailCardOffer) offerDesc += ` + Jail Card`;

    this._addLog(`🤝 ${debtor.name} offered a rent compromise to ${creditor.name} (Offered: ${offerDesc} to waive $${this.pendingRent.rent} rent).`, 'trade');
    this.persist();
    return true;
  }

  respondRentDeal(creditorId, accept) {
    if (!this.pendingRent) throw new Error('No pending rent.');
    if (this.pendingRent.creditorId !== creditorId) throw new Error('Only the property owner can respond.');
    if (!this.pendingRent.dealOffer) throw new Error('No deal proposed yet.');

    const { debtorId, rent, isDoubles, dealOffer } = this.pendingRent;
    const debtor = this.players.find(p => p.id === debtorId);
    const creditor = this.players.find(p => p.id === creditorId);

    if (accept) {
      if (dealOffer.cashOffer > 0) {
        debtor.money -= dealOffer.cashOffer;
        creditor.money += dealOffer.cashOffer;
      }
      if (dealOffer.propertyOffer !== null) {
        this.properties[dealOffer.propertyOffer].ownerId = creditorId;
      }
      if (dealOffer.jailCardOffer) {
        if (debtor.getOutOfJailCards.chance) {
          debtor.getOutOfJailCards.chance = false;
          creditor.getOutOfJailCards.chance = true;
        } else if (debtor.getOutOfJailCards.communityChest) {
          debtor.getOutOfJailCards.communityChest = false;
          creditor.getOutOfJailCards.communityChest = true;
        }
      }

      this._addLog(`🤝 ${creditor.name} ACCEPTED the rent compromise from ${debtor.name}! Rent of $${rent} is waived.`, 'success');
      this.pendingRent = null;
      this._finishTurnAction(debtor, isDoubles);
    } else {
      this._addLog(`❌ ${creditor.name} REJECTED the rent deal from ${debtor.name}. Full rent ($${rent}) is still owed.`, 'warning');
      this.pendingRent.dealOffer = null;
    }

    this.persist();
    return true;
  }

  // Jail Decisions
  payJailFine(playerId) {
    const player = this.getActivePlayer();
    if (player.id !== playerId || !player.inJail) throw new Error('Cannot pay jail fine.');
    if (this.turnPhase !== 'JAIL_DECISION') throw new Error('Not in jail decision phase.');

    const fine = 50;
    this._deductMoney(player, fine, 'jail_fine', 'Jail release fee');
    if (this.rules.freeParkingJackpot) {
      this.freeParkingPot += fine;
      this._addLog(`💰 $${fine} jail fine was added to the Free Parking Pot! (Pot: $${this.freeParkingPot})`, 'bonus');
    }
    player.inJail = false;
    player.jailTurns = 0;
    this.turnPhase = 'ROLL';
    this._addLog(`${player.name} paid $50 to get out of Jail.`);
    this.persist();
  }

  useJailCard(playerId) {
    const player = this.getActivePlayer();
    if (player.id !== playerId || !player.inJail) throw new Error('Cannot use card.');
    if (this.turnPhase !== 'JAIL_DECISION') throw new Error('Not in jail decision phase.');

    if (player.getOutOfJailCards.chance) {
      player.getOutOfJailCards.chance = false;
    } else if (player.getOutOfJailCards.communityChest) {
      player.getOutOfJailCards.communityChest = false;
    } else {
      throw new Error('No Get Out of Jail Free card available.');
    }

    player.inJail = false;
    player.jailTurns = 0;
    this.turnPhase = 'ROLL';
    this._addLog(`${player.name} used a Get Out of Jail Free card!`);
    this.persist();
  }

  rollJailDice(playerId) {
    const player = this.getActivePlayer();
    if (player.id !== playerId || !player.inJail) throw new Error('Cannot roll in jail.');
    if (this.turnPhase !== 'JAIL_DECISION') throw new Error('Not in jail decision phase.');

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    this.dice = [d1, d2];
    const isDoubles = d1 === d2;

    this._addLog(`${player.name} rolled ${d1} and ${d2} in Jail.${isDoubles ? ' DOUBLES!' : ''}`, 'dice');

    if (isDoubles) {
      player.inJail = false;
      player.jailTurns = 0;
      this._addLog(`${player.name} rolled doubles and is released from Jail!`, 'success');
      const diceSum = d1 + d2;
      player.position = (player.position + diceSum) % 40;
      this._resolveSpace(player, diceSum, false); // Doubles in jail do not award extra roll
    } else {
      player.jailTurns++;
      if (player.jailTurns >= 3) {
        this._addLog(`${player.name} failed to roll doubles for 3 turns. Must pay $50 fine.`, 'warning');
        const fine = 50;
        this._deductMoney(player, fine, 'jail_fine', '3-turn jail penalty');
        if (this.rules.freeParkingJackpot) {
          this.freeParkingPot += fine;
        }
        player.inJail = false;
        player.jailTurns = 0;
        const diceSum = d1 + d2;
        player.position = (player.position + diceSum) % 40;
        this._resolveSpace(player, diceSum, false);
      } else {
        this._addLog(`${player.name} remains in Jail (Attempt ${player.jailTurns}/3).`);
        this.turnPhase = 'END_TURN';
      }
    }
    this.persist();
  }

  // Buy Property
  buyProperty(playerId) {
    const player = this.getActivePlayer();
    if (player.id !== playerId) throw new Error('Not your turn.');
    if (this.turnPhase !== 'ACTION') throw new Error('Cannot buy property right now.');

    const space = BOARD_SPACES[player.position];
    const propState = this.properties[space.id];
    if (propState.ownerId) throw new Error('Property is already owned.');
    if (player.money < space.price) throw new Error('Insufficient funds to buy property.');

    player.money -= space.price;
    propState.ownerId = player.id;
    this._addLog(`🏠 ${player.name} purchased ${this.getSpaceName(space.id)} for $${space.price}!`, 'success');

    this.lastPropertyEvent = {
      type: 'PURCHASE',
      spaceId: space.id,
      spaceName: this.getSpaceName(space.id),
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      playerToken: player.tokenIcon,
      houses: propState.houses,
      cost: space.price,
      timestamp: Date.now()
    };

    this.turnPhase = this.lastRollWasDoubles ? 'ROLL' : 'END_TURN';
    this.persist();
    return true;
  }

  // Decline Property / Start Auction
  declineProperty(playerId) {
    const player = this.getActivePlayer();
    if (player.id !== playerId) throw new Error('Not your turn.');
    if (this.turnPhase !== 'ACTION') throw new Error('Cannot decline right now.');

    const space = BOARD_SPACES[player.position];
    this._addLog(`${player.name} declined to buy ${space.name}.`);

    if (this.rules.auctionsEnabled) {
      this._startAuction(space.id);
    } else {
      this._addLog(`Auctions are disabled in house rules. ${space.name} remains unowned.`);
      this.turnPhase = this.lastRollWasDoubles ? 'ROLL' : 'END_TURN';
    }
    this.persist();
  }

  // Auction System
  _startAuction(spaceId) {
    const eligiblePlayers = this.players.filter(p => !p.bankrupt).map(p => p.id);
    this.pendingAuction = {
      spaceId,
      currentBid: 10,
      highBidderId: null,
      passedPlayerIds: [],
      activePlayerIds: eligiblePlayers
    };
    this.turnPhase = 'AUCTION';
    const space = BOARD_SPACES[spaceId];
    this._addLog(`📢 AUCTION STARTED for ${space.name}! Starting bid: $10.`, 'auction');
  }

  placeBid(playerId, bidAmount) {
    if (this.turnPhase !== 'AUCTION' || !this.pendingAuction) throw new Error('No active auction.');
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.bankrupt) throw new Error('Invalid bidder.');
    if (this.pendingAuction.passedPlayerIds.includes(playerId)) throw new Error('You already passed on this auction.');
    if (bidAmount <= this.pendingAuction.currentBid) throw new Error('Bid must be higher than current bid.');
    if (player.money < bidAmount) throw new Error('You do not have enough money for this bid.');

    this.pendingAuction.currentBid = bidAmount;
    this.pendingAuction.highBidderId = playerId;
    const space = BOARD_SPACES[this.pendingAuction.spaceId];
    this._addLog(`🔨 ${player.name} bid $${bidAmount} on ${space.name}!`, 'auction');
    this.persist();
  }

  passAuction(playerId) {
    if (this.turnPhase !== 'AUCTION' || !this.pendingAuction) throw new Error('No active auction.');
    if (!this.pendingAuction.passedPlayerIds.includes(playerId)) {
      this.pendingAuction.passedPlayerIds.push(playerId);
      const player = this.players.find(p => p.id === playerId);
      this._addLog(`${player.name} passed on the auction.`);
    }

    const remainingBidders = this.pendingAuction.activePlayerIds.filter(
      id => !this.pendingAuction.passedPlayerIds.includes(id)
    );

    // If 1 bidder remains and has made a bid, or everyone passed
    if (remainingBidders.length === 0 || (remainingBidders.length === 1 && this.pendingAuction.highBidderId === remainingBidders[0])) {
      this._concludeAuction();
    }
    this.persist();
  }

  _concludeAuction() {
    const auction = this.pendingAuction;
    const space = BOARD_SPACES[auction.spaceId];

    if (auction.highBidderId) {
      const winner = this.players.find(p => p.id === auction.highBidderId);
      winner.money -= auction.currentBid;
      this.properties[auction.spaceId].ownerId = winner.id;
      this._addLog(`🎉 AUCTION WON! ${winner.name} won ${this.getSpaceName(space.id)} for $${auction.currentBid}!`, 'winner');

      this.lastPropertyEvent = {
        type: 'PURCHASE',
        spaceId: space.id,
        spaceName: this.getSpaceName(space.id),
        playerId: winner.id,
        playerName: winner.name,
        playerColor: winner.color,
        playerToken: winner.tokenIcon,
        houses: this.properties[auction.spaceId].houses,
        cost: auction.currentBid,
        timestamp: Date.now()
      };
    } else {
      this._addLog(`Auction ended with no bids. ${space.name} remains unowned.`);
    }

    this.pendingAuction = null;
    this.turnPhase = this.lastRollWasDoubles ? 'ROLL' : 'END_TURN';
  }

  // Cards (Chance / Community Chest)
  _drawCard(player, deckType, isDoubles) {
    let card, cardList;
    if (deckType === 'chance') {
      const idx = this.chanceDeck[this.chanceIndex % this.chanceDeck.length];
      this.chanceIndex++;
      card = CHANCE_CARDS[idx];
      cardList = 'Chance';
    } else {
      const idx = this.communityChestDeck[this.communityChestIndex % this.communityChestDeck.length];
      this.communityChestIndex++;
      card = COMMUNITY_CHEST_CARDS[idx];
      cardList = 'Community Chest';
    }

    this.lastDrawnCard = { ...card, deckType };
    this._addLog(`🎴 ${player.name} drew a ${cardList} card: "${card.text}"`, 'card');

    this._executeCardAction(player, card, isDoubles);
  }

  _executeCardAction(player, card, isDoubles) {
    switch (card.action) {
      case 'advance': {
        const oldPos = player.position;
        player.position = card.target;
        if (card.target < oldPos) {
          player.money += 200;
          this._addLog(`${player.name} passed GO and collected $200.`);
        }
        this._resolveSpace(player, 0, isDoubles);
        break;
      }
      case 'advance_nearest_utility': {
        const utilities = [12, 28];
        const nextUtil = utilities.find(u => u > player.position) ?? utilities[0];
        if (nextUtil < player.position) player.money += 200;
        player.position = nextUtil;
        this._resolveSpace(player, 7, isDoubles); // dice fallback
        break;
      }
      case 'advance_nearest_railroad': {
        const railroads = [5, 15, 25, 35];
        const nextRR = railroads.find(r => r > player.position) ?? railroads[0];
        if (nextRR < player.position) player.money += 200;
        player.position = nextRR;
        this._resolveSpace(player, 0, isDoubles);
        break;
      }
      case 'collect':
        player.money += card.amount;
        this._finishTurnAction(player, isDoubles);
        break;
      case 'pay':
        this._deductMoney(player, card.amount, 'card_fine', card.text);
        if (this.rules.freeParkingJackpot) {
          this.freeParkingPot += card.amount;
        }
        this._finishTurnAction(player, isDoubles);
        break;
      case 'jail_free':
        if (card.id.startsWith('ch_')) player.getOutOfJailCards.chance = true;
        else player.getOutOfJailCards.communityChest = true;
        this._finishTurnAction(player, isDoubles);
        break;
      case 'go_jail':
        this._sendToJail(player);
        break;
      case 'back': {
        player.position = (player.position - card.count + 40) % 40;
        this._resolveSpace(player, 0, isDoubles);
        break;
      }
      case 'repairs': {
        let total = 0;
        for (const [spaceId, prop] of Object.entries(this.properties)) {
          if (prop.ownerId === player.id) {
            if (prop.houses === 5) total += card.hotel;
            else total += prop.houses * card.house;
          }
        }
        if (total > 0) {
          this._deductMoney(player, total, 'repairs', 'Property Repairs');
          if (this.rules.freeParkingJackpot) this.freeParkingPot += total;
        }
        this._finishTurnAction(player, isDoubles);
        break;
      }
      case 'pay_players': {
        const others = this.players.filter(p => p.id !== player.id && !p.bankrupt);
        const total = card.amount * others.length;
        this._deductMoney(player, total, 'card_players', card.text);
        for (const o of others) o.money += card.amount;
        this._finishTurnAction(player, isDoubles);
        break;
      }
      case 'collect_players': {
        const others = this.players.filter(p => p.id !== player.id && !p.bankrupt);
        for (const o of others) {
          this._deductMoney(o, card.amount, 'card_players', card.text);
          player.money += card.amount;
        }
        this._finishTurnAction(player, isDoubles);
        break;
      }
      default:
        this._finishTurnAction(player, isDoubles);
    }
  }

  // Building Houses / Hotels
  buildHouse(playerId, spaceId) {
    const space = BOARD_SPACES[spaceId];
    if (!space || space.type !== 'street') throw new Error('Not a buildable street property.');
    const propState = this.properties[spaceId];
    if (propState.ownerId !== playerId) throw new Error('You do not own this property.');
    if (propState.mortgaged) throw new Error('Cannot build on mortgaged property.');
    if (propState.houses >= 5) throw new Error('Already at maximum improvement (Hotel).');

    // Check monopoly rule
    if (!this.rules.buildWithoutMonopoly && !this.hasMonopoly(playerId, space.group)) {
      throw new Error(`You must own all properties in the ${COLOR_GROUPS[space.group].name} color group to build.`);
    }

    // Check mortgaged properties in the same color group
    const groupSpaces = BOARD_SPACES.filter(s => s.group === space.group);
    for (const s of groupSpaces) {
      if (this.properties[s.id].mortgaged) {
        throw new Error('Cannot build while any property in this color group is mortgaged.');
      }
    }

    // Check even building rule
    const currentHouses = propState.houses;
    for (const s of groupSpaces) {
      const otherHouses = this.properties[s.id].houses;
      if (currentHouses > otherHouses) {
        throw new Error('You must build evenly across all properties in the color group.');
      }
    }

    // Check bank inventory (if not unlimited)
    if (!this.rules.unlimitedHouses) {
      if (currentHouses === 4) {
        if (this.bankHotels <= 0) throw new Error('No hotels left in the bank.');
      } else {
        if (this.bankHouses <= 0) throw new Error('No houses left in the bank.');
      }
    }

    const player = this.players.find(p => p.id === playerId);
    if (player.money < space.houseCost) throw new Error('Insufficient funds to build.');

    player.money -= space.houseCost;
    propState.houses++;

    if (!this.rules.unlimitedHouses) {
      if (propState.houses === 5) {
        this.bankHotels--;
        this.bankHouses += 4; // return 4 houses to bank
      } else {
        this.bankHouses--;
      }
    }

    const bStyle = this.getBuildingStyle();
    const label = propState.houses === 5 ? `a ${bStyle.topName}` : `${bStyle.singleName} #${propState.houses}`;
    this._addLog(`🏗️ ${player.name} built ${label} on ${this.getSpaceName(space.id)} for $${space.houseCost}.`, 'success');

    this.lastPropertyEvent = {
      type: 'BUILD',
      spaceId: space.id,
      spaceName: this.getSpaceName(space.id),
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      playerToken: player.tokenIcon,
      houses: propState.houses,
      cost: space.houseCost,
      timestamp: Date.now()
    };

    this.persist();
    return true;
  }

  sellHouse(playerId, spaceId) {
    const space = BOARD_SPACES[spaceId];
    if (!space || space.type !== 'street') throw new Error('Not a street property.');
    const propState = this.properties[spaceId];
    if (propState.ownerId !== playerId) throw new Error('You do not own this property.');
    if (propState.houses <= 0) throw new Error('No houses to sell on this property.');

    // Even selling rule
    const groupSpaces = BOARD_SPACES.filter(s => s.group === space.group);
    const currentHouses = propState.houses;
    for (const s of groupSpaces) {
      const otherHouses = this.properties[s.id].houses;
      if (currentHouses < otherHouses) {
        throw new Error('You must sell houses evenly across all properties in the color group.');
      }
    }

    const player = this.players.find(p => p.id === playerId);
    const refund = Math.floor(space.houseCost / 2);
    player.money += refund;
    propState.houses--;

    if (!this.rules.unlimitedHouses) {
      if (propState.houses === 4) {
        this.bankHotels++;
        this.bankHouses -= 4;
      } else {
        this.bankHouses++;
      }
    }

    const bStyle = this.getBuildingStyle();
    const label = propState.houses === 4 ? `the ${bStyle.topName}` : `${bStyle.singleName} #${propState.houses + 1}`;
    this._addLog(`📉 ${player.name} sold ${label} on ${this.getSpaceName(space.id)} for $${refund}.`);
    if (player.money >= 0 && this.turnPhase === 'RESOLVE_DEBT') {
      this.turnPhase = this.lastRollWasDoubles ? 'ROLL' : 'END_TURN';
      this._addLog(`✅ ${player.name} cleared debt! Balance is now $${player.money}.`, 'success');
    }
    this.persist();
    return true;
  }

  // Mortgage / Unmortgage
  mortgageProperty(playerId, spaceId) {
    const space = BOARD_SPACES[spaceId];
    if (!space) throw new Error('Invalid space.');
    const propState = this.properties[spaceId];
    if (propState.ownerId !== playerId) throw new Error('You do not own this property.');
    if (propState.mortgaged) throw new Error('Property is already mortgaged.');

    if (space.type === 'street') {
      const groupSpaces = BOARD_SPACES.filter(s => s.group === space.group);
      for (const s of groupSpaces) {
        if (this.properties[s.id].houses > 0) {
          throw new Error('Must sell all houses in the color group before mortgaging.');
        }
      }
    }

    const player = this.players.find(p => p.id === playerId);
    propState.mortgaged = true;
    player.money += space.mortgage;
    this._addLog(`${player.name} mortgaged ${space.name} for $${space.mortgage}.`);
    if (player.money >= 0 && this.turnPhase === 'RESOLVE_DEBT') {
      this.turnPhase = this.lastRollWasDoubles ? 'ROLL' : 'END_TURN';
      this._addLog(`✅ ${player.name} cleared debt! Balance is now $${player.money}.`, 'success');
    }
    this.persist();
    return true;
  }

  unmortgageProperty(playerId, spaceId) {
    const space = BOARD_SPACES[spaceId];
    if (!space) throw new Error('Invalid space.');
    const propState = this.properties[spaceId];
    if (propState.ownerId !== playerId) throw new Error('You do not own this property.');
    if (!propState.mortgaged) throw new Error('Property is not mortgaged.');

    const cost = Math.floor(space.mortgage * 1.1); // 10% interest
    const player = this.players.find(p => p.id === playerId);
    if (player.money < cost) throw new Error(`Insufficient funds ($${cost} needed).`);

    player.money -= cost;
    propState.mortgaged = false;
    this._addLog(`${player.name} lifted the mortgage on ${space.name} for $${cost}.`);
    this.persist();
    return true;
  }

  // Player Trading
  proposeTrade(fromPlayerId, toPlayerId, offer) {
    if (fromPlayerId === toPlayerId) throw new Error('Cannot trade with yourself.');
    const from = this.players.find(p => p.id === fromPlayerId);
    const to = this.players.find(p => p.id === toPlayerId);
    if (!from || !to || from.bankrupt || to.bankrupt) throw new Error('Invalid trading players.');

    // Validate ownership
    if (from.money < (offer.offerMoney || 0)) throw new Error('Offering more money than you own.');
    if (to.money < (offer.requestMoney || 0)) throw new Error('Requesting more money than target owns.');

    for (const id of offer.offerProperties || []) {
      if (this.properties[id]?.ownerId !== fromPlayerId) throw new Error('You do not own offered property.');
      if (this.properties[id]?.houses > 0) throw new Error('Cannot trade properties with houses on them.');
    }
    for (const id of offer.requestProperties || []) {
      if (this.properties[id]?.ownerId !== toPlayerId) throw new Error('Target player does not own requested property.');
      if (this.properties[id]?.houses > 0) throw new Error('Cannot trade properties with houses on them.');
    }

    this.pendingTrade = {
      id: Math.random().toString(36).substring(2, 9),
      fromPlayerId,
      toPlayerId,
      offerMoney: offer.offerMoney || 0,
      offerProperties: offer.offerProperties || [],
      offerJailCard: Boolean(offer.offerJailCard),
      requestMoney: offer.requestMoney || 0,
      requestProperties: offer.requestProperties || [],
      requestJailCard: Boolean(offer.requestJailCard)
    };

    this._addLog(`🤝 ${from.name} proposed a trade to ${to.name}.`, 'trade');
    this.persist();
    return this.pendingTrade;
  }

  respondTrade(playerId, accept) {
    if (!this.pendingTrade) throw new Error('No pending trade.');
    if (this.pendingTrade.toPlayerId !== playerId) throw new Error('Only the target player can respond.');

    const trade = this.pendingTrade;
    const from = this.players.find(p => p.id === trade.fromPlayerId);
    const to = this.players.find(p => p.id === trade.toPlayerId);

    if (accept) {
      // Execute trade
      from.money = from.money - trade.offerMoney + trade.requestMoney;
      to.money = to.money - trade.requestMoney + trade.offerMoney;

      for (const id of trade.offerProperties) this.properties[id].ownerId = to.id;
      for (const id of trade.requestProperties) this.properties[id].ownerId = from.id;

      if (trade.offerJailCard) {
        if (from.getOutOfJailCards.chance) {
          from.getOutOfJailCards.chance = false;
          to.getOutOfJailCards.chance = true;
        } else if (from.getOutOfJailCards.communityChest) {
          from.getOutOfJailCards.communityChest = false;
          to.getOutOfJailCards.communityChest = true;
        }
      }
      if (trade.requestJailCard) {
        if (to.getOutOfJailCards.chance) {
          to.getOutOfJailCards.chance = false;
          from.getOutOfJailCards.chance = true;
        } else if (to.getOutOfJailCards.communityChest) {
          to.getOutOfJailCards.communityChest = false;
          from.getOutOfJailCards.communityChest = true;
        }
      }

      this._addLog(`🤝 Trade accepted between ${from.name} and ${to.name}!`, 'success');
    } else {
      this._addLog(`Trade rejected by ${to.name}.`);
    }

    this.pendingTrade = null;
    this.persist();
    return true;
  }

  cancelTrade(playerId) {
    if (!this.pendingTrade) return;
    if (this.pendingTrade.fromPlayerId === playerId || this.pendingTrade.toPlayerId === playerId) {
      this.pendingTrade = null;
      this._addLog('Trade proposal cancelled.');
      this.persist();
    }
  }

  // End Turn
  endTurn(playerId) {
    const player = this.getActivePlayer();
    if (player.id !== playerId) throw new Error('Not your turn.');
    if (player.money < 0) {
      throw new Error(`Cannot end turn while in debt ($${player.money}). You must mortgage properties, sell houses, or declare bankruptcy.`);
    }
    if (this.turnPhase !== 'END_TURN') throw new Error(`Cannot end turn during phase: ${this.turnPhase}`);

    this._nextTurn();
  }

  // Bankruptcy
  declareBankruptcy(playerId, creditorId = null) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.bankrupt) return;

    player.bankrupt = true;
    const targetCreditorId = creditorId || this.lastCreditorId;
    const creditor = targetCreditorId ? this.players.find(p => p.id === targetCreditorId && !p.bankrupt) : null;

    if (creditor) {
      this._addLog(`💥 ${player.name} declared BANKRUPTCY to ${creditor.name}!`, 'danger');
      if (player.money > 0) {
        creditor.money += player.money;
      }
      if (player.getOutOfJailCards.chance) {
        creditor.getOutOfJailCards.chance = true;
        player.getOutOfJailCards.chance = false;
      }
      if (player.getOutOfJailCards.communityChest) {
        creditor.getOutOfJailCards.communityChest = true;
        player.getOutOfJailCards.communityChest = false;
      }
      // Transfer properties
      for (const [spaceId, prop] of Object.entries(this.properties)) {
        if (prop.ownerId === player.id) {
          if (prop.houses > 0) {
            const space = BOARD_SPACES[Number(spaceId)];
            const houseRefund = prop.houses * Math.floor(space.houseCost / 2);
            creditor.money += houseRefund;
            if (!this.rules.unlimitedHouses) {
              if (prop.houses === 5) {
                this.bankHotels++;
                this.bankHouses += 4;
              } else {
                this.bankHouses += prop.houses;
              }
            }
            prop.houses = 0;
          }
          prop.ownerId = creditor.id;
        }
      }
    } else {
      this._addLog(`💥 ${player.name} declared BANKRUPTCY to the Bank!`, 'danger');
      // Surrender properties to bank
      for (const [spaceId, prop] of Object.entries(this.properties)) {
        if (prop.ownerId === player.id) {
          if (prop.houses > 0 && !this.rules.unlimitedHouses) {
            if (prop.houses === 5) {
              this.bankHotels++;
              this.bankHouses += 4;
            } else {
              this.bankHouses += prop.houses;
            }
          }
          prop.ownerId = null;
          prop.houses = 0;
          prop.mortgaged = false;
        }
      }
    }

    player.money = 0;

    // Check winner
    const solvent = this.players.filter(p => !p.bankrupt);
    if (solvent.length === 1) {
      this._setWinner(solvent[0], 'is the last solvent player remaining! All other rivals went bankrupt.');
    } else if (player.id === this.getActivePlayer()?.id) {
      this._nextTurn();
    }
    this.persist();
  }

  // Player Forfeit / Exit Game
  forfeitPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.bankrupt) return;
    this._addLog(`🚪 ${player.name} forfeited and left the neighborhood.`, 'warning');
    this.declareBankruptcy(playerId, null);
  }

  // Helpers
  _deductMoney(player, amount, reason, detail) {
    player.money -= amount;
    if (player.money < 0) {
      this.lastCreditorId = null;
      this.turnPhase = 'RESOLVE_DEBT';
      this._addLog(`⚠️ ${player.name} has negative cash ($${player.money})! Must mortgage properties, sell houses, or declare bankruptcy.`, 'danger');
    }
  }

  _transferMoney(fromPlayer, toPlayer, amount) {
    fromPlayer.money -= amount;
    toPlayer.money += amount;
    if (fromPlayer.money < 0) {
      this.lastCreditorId = toPlayer.id;
      this.turnPhase = 'RESOLVE_DEBT';
      this._addLog(`⚠️ ${fromPlayer.name} has negative cash ($${fromPlayer.money}) owed to ${toPlayer.name}! Must mortgage properties, sell houses, or declare bankruptcy.`, 'danger');
    }
  }

  calculateMaxLiquidationValue(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.bankrupt) return 0;
    let total = player.money;

    for (const [spaceId, prop] of Object.entries(this.properties)) {
      if (prop.ownerId === playerId) {
        const space = BOARD_SPACES[Number(spaceId)];
        if (prop.houses > 0) {
          total += prop.houses * Math.floor(space.houseCost / 2);
        }
        if (!prop.mortgaged) {
          total += space.mortgage;
        }
      }
    }
    return total;
  }

  autoLiquidate(playerId, targetCash = 0) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.money >= targetCash) return true;

    // 1. Sell houses evenly across owned streets
    let soldAny = true;
    while (player.money < targetCash && soldAny) {
      soldAny = false;
      for (const [spaceIdStr, prop] of Object.entries(this.properties)) {
        if (prop.ownerId === playerId && prop.houses > 0) {
          try {
            this.sellHouse(playerId, Number(spaceIdStr));
            soldAny = true;
            if (player.money >= targetCash) break;
          } catch (e) {
            // Even building rule might require selling on another property in group first
          }
        }
      }
    }

    // 2. Mortgage properties (prioritize non-monopolies and utilities/railroads first)
    if (player.money < targetCash) {
      const owned = [];
      for (const [spaceIdStr, prop] of Object.entries(this.properties)) {
        if (prop.ownerId === playerId && !prop.mortgaged && prop.houses === 0) {
          const space = BOARD_SPACES[Number(spaceIdStr)];
          const hasMonopoly = space.group ? this.hasMonopoly(playerId, space.group) : false;
          owned.push({ id: Number(spaceIdStr), space, hasMonopoly });
        }
      }
      owned.sort((a, b) => (a.hasMonopoly ? 1 : 0) - (b.hasMonopoly ? 1 : 0));

      for (const item of owned) {
        if (player.money >= targetCash) break;
        try {
          this.mortgageProperty(playerId, item.id);
        } catch (e) {}
      }
    }

    return player.money >= targetCash;
  }

  hasMonopoly(playerId, groupKey) {
    if (!playerId || !groupKey || ['RAILROAD', 'UTILITY'].includes(groupKey)) return false;
    const groupSpaces = BOARD_SPACES.filter(s => s.group === groupKey);
    return groupSpaces.every(s => this.properties[s.id]?.ownerId === playerId);
  }

  getOwnedCountInGroup(playerId, groupKey) {
    if (!playerId || !groupKey) return 0;
    const groupSpaces = BOARD_SPACES.filter(s => s.group === groupKey);
    return groupSpaces.filter(s => this.properties[s.id]?.ownerId === playerId).length;
  }

  calculateNetWorth(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.bankrupt) return 0;
    let net = player.money;

    for (const [spaceId, prop] of Object.entries(this.properties)) {
      if (prop.ownerId === playerId) {
        const space = BOARD_SPACES[Number(spaceId)];
        net += prop.mortgaged ? space.mortgage : space.price;
        if (space.type === 'street' && prop.houses > 0) {
          net += prop.houses * space.houseCost;
        }
      }
    }
    return net;
  }

  getNetWorths() {
    const map = {};
    for (const p of this.players) {
      map[p.id] = this.calculateNetWorth(p.id);
    }
    return map;
  }
}
