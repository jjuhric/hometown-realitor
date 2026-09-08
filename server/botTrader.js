import { BOARD_SPACES } from './boardData.js';

/**
 * AI Bot Trade Negotiation Engine
 * Evaluates trade proposals directed to AI bots.
 */
export function evaluateBotTrade(game, botId, offer) {
  const bot = game.players.find(p => p.id === botId);
  const proposer = game.players.find(p => p.id === offer.fromPlayerId);

  if (!bot || !proposer) {
    return {
      accept: false,
      reason: 'Invalid trading partners.',
      chatMessage: 'I cannot trade right now.'
    };
  }

  // 1. Calculate value of what the Bot is receiving (offerMoney, offerProperties, offerJailCard)
  let receivingValue = offer.offerMoney || 0;

  for (const spaceId of offer.offerProperties || []) {
    const space = BOARD_SPACES[spaceId];
    if (!space) continue;

    let propValue = space.price;

    // Check monopoly completion synergy for bot
    if (space.group) {
      const groupSpaces = BOARD_SPACES.filter(s => s.group === space.group);
      const botOwnedInGroup = groupSpaces.filter(s => {
        const prop = game.properties[s.id];
        return prop && prop.ownerId === botId;
      }).length;

      // If this completes the set for bot -> massive multiplier
      if (botOwnedInGroup === groupSpaces.length - 1) {
        propValue *= 2.6; // Huge value: completes monopoly
      } else if (botOwnedInGroup > 0) {
        propValue *= 1.5; // Building towards monopoly
      }
    } else if (space.type === 'railroad') {
      const botRRs = BOARD_SPACES.filter(s => s.type === 'railroad' && game.properties[s.id]?.ownerId === botId).length;
      propValue *= (1 + botRRs * 0.3);
    }

    receivingValue += propValue;
  }

  if (offer.offerJailCard) {
    receivingValue += 50;
  }

  // 2. Calculate value of what the Bot is giving away (requestMoney, requestProperties, requestJailCard)
  let givingValue = offer.requestMoney || 0;

  for (const spaceId of offer.requestProperties || []) {
    const space = BOARD_SPACES[spaceId];
    if (!space) continue;

    let propValue = space.price;

    // Check if bot would break its own monopoly
    if (space.group && game.hasMonopoly(botId, space.group)) {
      propValue *= 4.0; // Bot will virtually never break its complete monopoly
    } else if (space.group) {
      const groupSpaces = BOARD_SPACES.filter(s => s.group === space.group);
      const botOwnedInGroup = groupSpaces.filter(s => game.properties[s.id]?.ownerId === botId).length;
      if (botOwnedInGroup > 1) {
        propValue *= 1.6; // Giving up a majority piece
      }

      // Check if giving this to proposer completes proposer's monopoly (Kingmaker check)
      const proposerOwned = groupSpaces.filter(s => game.properties[s.id]?.ownerId === proposer.id).length;
      if (proposerOwned === groupSpaces.length - 1) {
        propValue *= 2.2; // High penalty: would give opponent a complete monopoly!
      }
    }

    givingValue += propValue;
  }

  if (offer.requestJailCard) {
    givingValue += 60;
  }

  // 3. Decision Logic
  const botCash = bot.money;
  // If bot is requested to give more cash than it can safely spare, decline
  if ((offer.requestMoney || 0) > botCash * 0.6) {
    return {
      accept: false,
      reason: 'Bot cannot spare that much cash.',
      chatMessage: `I can't afford to give away $${offer.requestMoney}. I need to keep a cash reserve!`
    };
  }

  // Minimum threshold: receiving at least 102% of giving value
  const ratio = givingValue > 0 ? (receivingValue / givingValue) : (receivingValue > 0 ? 2 : 0);

  if (ratio >= 1.05) {
    return {
      accept: true,
      reason: 'Fair or favorable trade.',
      chatMessage: `🤝 Deal! That trade makes good business sense for both of us.`
    };
  } else if (ratio >= 0.75) {
    return {
      accept: false,
      reason: 'Offer slightly too low.',
      chatMessage: `That's close, but you need to sweeten the deal with more cash or another property for me to accept.`
    };
  } else {
    return {
      accept: false,
      reason: 'Offer is too one-sided.',
      chatMessage: `No way! That deal is completely one-sided. I'm not giving up valuable assets for that.`
    };
  }
}

/**
 * AI Bot Rent Compromise Evaluation
 * Evaluates rent settlement offers when an opponent lands on bot's property.
 */
export function evaluateRentDeal(game, creditorId, pendingRent, dealOffer) {
  const creditor = game.players.find(p => p.id === creditorId);
  const debtor = game.players.find(p => p.id === pendingRent.debtorId);

  if (!creditor || !debtor || !dealOffer) {
    return { accept: false, chatMessage: 'No deal.' };
  }

  // Calculate offered compensation value
  let offerValue = dealOffer.cashOffer || 0;

  if (dealOffer.propertyOffer !== null && dealOffer.propertyOffer !== undefined) {
    const space = BOARD_SPACES[dealOffer.propertyOffer];
    if (space) {
      let val = space.price;
      if (space.group) {
        const groupSpaces = BOARD_SPACES.filter(s => s.group === space.group);
        const owned = groupSpaces.filter(s => game.properties[s.id]?.ownerId === creditorId).length;
        if (owned === groupSpaces.length - 1) {
          val *= 2.6; // Completes monopoly for bot!
        } else if (owned > 0) {
          val *= 1.5;
        }
      }
      offerValue += val;
    }
  }

  if (dealOffer.jailCardOffer) {
    offerValue += 50;
  }

  const rentOwed = pendingRent.rent;

  // Bot accepts if offer is at least 80% of rent owed, or if property offered is high-value
  if (offerValue >= rentOwed * 0.8 || offerValue > rentOwed) {
    return {
      accept: true,
      chatMessage: `🤝 Deal! I accept your offer to settle the $${rentOwed} rent.`
    };
  } else if (offerValue >= rentOwed * 0.5) {
    return {
      accept: false,
      chatMessage: `That's not enough to waive $${rentOwed} rent! Throw in more cash or a property.`
    };
  } else {
    return {
      accept: false,
      chatMessage: `No way! Pay me the full $${rentOwed} rent you owe.`
    };
  }
}

/**
 * Evaluates whether an AI bot should place a bid in an ongoing auction, and how much.
 */
export function evaluateBotAuctionBid(game, botId, spaceId, currentBid) {
  const bot = game.players.find(p => p.id === botId);
  if (!bot || bot.bankrupt) {
    return { bid: false, reason: 'Invalid or bankrupt bot.' };
  }

  // Never outbid self
  if (game.pendingAuction && game.pendingAuction.highBidderId === botId) {
    return { bid: false, reason: 'Bot is already the highest bidder.' };
  }

  const space = BOARD_SPACES[spaceId];
  if (!space) {
    return { bid: false, reason: 'Invalid space.' };
  }

  const basePrice = space.price || 100;
  let multiplier = 1.0;

  // Monopoly synergy & blocking valuation
  if (space.group) {
    const groupSpaces = BOARD_SPACES.filter(s => s.group === space.group);
    const botOwnedInGroup = groupSpaces.filter(s => game.properties[s.id]?.ownerId === botId).length;

    if (botOwnedInGroup === groupSpaces.length - 1) {
      multiplier = 2.4; // Completes monopoly for bot!
    } else if (botOwnedInGroup > 0) {
      multiplier = 1.5; // Building towards monopoly
    }

    // Defensive check: is an opponent 1 away from monopoly?
    for (const opponent of game.players) {
      if (opponent.id === botId || opponent.bankrupt) continue;
      const oppOwned = groupSpaces.filter(s => game.properties[s.id]?.ownerId === opponent.id).length;
      if (oppOwned === groupSpaces.length - 1) {
        multiplier = Math.max(multiplier, 1.8); // Defensive block!
        break;
      }
    }
  } else if (space.type === 'railroad') {
    const botRRs = BOARD_SPACES.filter(s => s.type === 'railroad' && game.properties[s.id]?.ownerId === botId).length;
    multiplier = 1 + botRRs * 0.35;
  } else if (space.type === 'utility') {
    const botUtils = BOARD_SPACES.filter(s => s.type === 'utility' && game.properties[s.id]?.ownerId === botId).length;
    multiplier = 1 + botUtils * 0.25;
  }

  const maxValuation = Math.round(basePrice * multiplier);
  // Cash safety buffer: keep at least $80 or 15% of bot money
  const cashReserve = Math.max(80, Math.round(bot.money * 0.15));
  const maxAffordable = Math.max(0, bot.money - cashReserve);
  const maxBidWillingToPay = Math.min(maxValuation, maxAffordable);

  const nextBid = currentBid + 10;
  if (nextBid <= maxBidWillingToPay && bot.money >= nextBid) {
    return {
      bid: true,
      bidAmount: nextBid,
      maxValuation
    };
  }

  return {
    bid: false,
    reason: nextBid > maxAffordable ? 'Cannot safely afford bid.' : 'Exceeds property valuation.',
    maxValuation
  };
}

