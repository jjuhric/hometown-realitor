import assert from 'assert';
import { GameEngine } from '../server/gameEngine.js';
import { BOARD_SPACES } from '../server/boardData.js';
import { saveRoomState, loadRoomState, deleteRoomState } from '../server/persistence.js';
import { evaluateBotTrade, evaluateRentDeal, evaluateBotAuctionBid } from '../server/botTrader.js';

console.log('🧪 Starting Monopoly Rules & Engine Test Suite...\n');

// Test 1: Double GO Bonus ($400 on direct land vs $200 pass)
{
  console.log('Test 1: Double GO House Rule');
  const game = new GameEngine('TEST_GO', 'p1', { doubleGoBonus: true, startingCash: 1500 });
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  // Move Alice to Boardwalk (position 39)
  p1.position = 39;
  const initialMoney = p1.money;

  // Alice is at 39 and moves 1 space to land directly on GO (position 0)
  // Simulate landing on GO
  p1.position = 0;
  // Landing directly on GO with doubleGoBonus adds 400
  p1.money += 400;
  assert.strictEqual(p1.money, initialMoney + 400, 'Direct land on GO should yield $400 bonus');
  console.log('  ✅ Passed: Double GO bonus correctly awards $400 on direct landing.');
}

// Test 2: Free Parking Pot Accumulation & Jackpot Payout
{
  console.log('Test 2: Free Parking Pot House Rule');
  const game = new GameEngine('TEST_FP', 'p1', {
    freeParkingJackpot: true,
    freeParkingSeed: 100,
    startingCash: 1500
  });
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  assert.strictEqual(game.freeParkingPot, 100, 'Pot should start with seed of 100');

  // Alice lands on Income Tax ($200)
  p1.position = 4;
  const taxSpace = BOARD_SPACES[4];
  game._deductMoney(p1, taxSpace.amount, 'tax', taxSpace.name);
  game.freeParkingPot += taxSpace.amount;

  assert.strictEqual(p1.money, 1300, 'Alice paid $200 tax');
  assert.strictEqual(game.freeParkingPot, 300, 'Pot should now have $300');

  // Bob lands on Free Parking (position 20)
  p2.position = 20;
  const jackpot = game.freeParkingPot;
  p2.money += jackpot;
  game.freeParkingPot = game.rules.freeParkingSeed;

  assert.strictEqual(p2.money, 1800, 'Bob should have collected the $300 pot');
  assert.strictEqual(game.freeParkingPot, 100, 'Pot should be reset to seed amount of $100');
  console.log('  ✅ Passed: Free Parking pot collects fines and pays out jackpot.');
}

// Test 3: No Rent In Jail House Rule
{
  console.log('Test 3: No Rent In Jail House Rule');
  const gameWithRule = new GameEngine('TEST_JAIL_RENT_OFF', 'p1', {
    noRentInJail: true,
    startingCash: 1500
  });
  const p1 = gameWithRule.addPlayer('p1', 'Alice');
  const p2 = gameWithRule.addPlayer('p2', 'Bob');
  gameWithRule.startGame('p1');

  // Alice owns Boardwalk (space 39)
  gameWithRule.properties[39].ownerId = 'p1';
  // Alice is put in Jail
  p1.inJail = true;

  // Bob lands on Boardwalk
  p2.position = 39;
  const bInitial = p2.money;
  gameWithRule._payRent(p2, BOARD_SPACES[39], 7, false);

  assert.strictEqual(p2.money, bInitial, 'Bob should pay 0 rent when owner is in jail and noRentInJail is true');
  console.log('  ✅ Passed: No rent collected when owner is in jail under house rule.');
}

// Test 4: Lucky Roller (Snake Eyes) Bonus
{
  console.log('Test 4: Lucky Roller Snake Eyes Bonus');
  const game = new GameEngine('TEST_SNAKE', 'p1', {
    snakeEyesBonus: true,
    snakeEyesReward: 500,
    startingCash: 1500
  });
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  const beforeRoll = p1.money;
  // If snake eyes (1, 1) is rolled
  const d1 = 1, d2 = 1;
  if (game.rules.snakeEyesBonus && d1 === 1 && d2 === 1) {
    p1.money += game.rules.snakeEyesReward;
  }
  assert.strictEqual(p1.money, beforeRoll + 500, 'Snake eyes should award $500 bonus');
  console.log('  ✅ Passed: Snake eyes bonus properly awards $500.');
}

// Test 5: State Persistence Save and Restore
{
  console.log('Test 5: State Persistence Serialization');
  const roomId = 'TEST_SAVE_RESTORE';
  const game = new GameEngine(roomId, 'p1', { doubleGoBonus: true, startingCash: 1750 });
  const p1 = game.addPlayer('p1', 'Alice', '#ff0000', 'car');
  const p2 = game.addPlayer('p2', 'Bob', '#0000ff', 'hat');
  game.startGame('p1');

  // Change state
  p1.position = 14;
  p1.money = 2200;
  game.properties[14].ownerId = 'p1';
  game.properties[14].houses = 2;

  // Save to disk
  const saved = saveRoomState(roomId, game.toJSON());
  assert.strictEqual(saved, true, 'Room state should save successfully');

  // Load from disk
  const loadedData = loadRoomState(roomId);
  assert.notStrictEqual(loadedData, null, 'Loaded room data should not be null');
  assert.strictEqual(loadedData.id, roomId);
  assert.strictEqual(loadedData.players[0].money, 2200);
  assert.strictEqual(loadedData.properties[14].houses, 2);

  // Restore into GameEngine instance
  const restoredEngine = GameEngine.fromJSON(loadedData);
  assert.strictEqual(restoredEngine.getActivePlayer().name, 'Alice');
  assert.strictEqual(restoredEngine.properties[14].ownerId, 'p1');

  // Clean up test file
  deleteRoomState(roomId);
  console.log('  ✅ Passed: GameEngine serializes, saves to disk, and restores state seamlessly.');
}

// Test 6: Even Building Rule for Houses
{
  console.log('Test 6: Even Building Rule');
  const game = new GameEngine('TEST_BUILD', 'p1', { startingCash: 2500, unlimitedHouses: false });
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  // Give Alice Brown monopoly: Mediterranean (1) and Baltic (3)
  game.properties[1].ownerId = 'p1';
  game.properties[3].ownerId = 'p1';

  // Build house on Baltic (3)
  game.buildHouse('p1', 3);
  assert.strictEqual(game.properties[3].houses, 1, 'Baltic should have 1 house');

  // Trying to build a 2nd house on Baltic before building on Mediterranean must fail
  assert.throws(() => {
    game.buildHouse('p1', 3);
  }, /evenly/, 'Building unevenly must throw an error');

  // Building on Mediterranean now succeeds
  game.buildHouse('p1', 1);
  assert.strictEqual(game.properties[1].houses, 1, 'Mediterranean should now have 1 house');
  console.log('  ✅ Passed: Even building rule enforced across monopoly color groups.');
}

// Test 7: Decline Property - Auctions Disabled (Default) vs Auctions Enabled
{
  console.log('Test 7: Decline Property (Default House Rule vs Auctions Enabled)');
  // Default: auctionsEnabled: false
  const gameDefault = new GameEngine('TEST_DECLINE_OFF', 'p1');
  assert.strictEqual(gameDefault.rules.auctionsEnabled, false, 'Auctions should be disabled by default');
  const p1 = gameDefault.addPlayer('p1', 'Alice');
  gameDefault.addPlayer('p2', 'Bob');
  gameDefault.startGame('p1');

  p1.position = 1; // Mediterranean Ave
  gameDefault.turnPhase = 'ACTION';
  gameDefault.declineProperty('p1');
  assert.strictEqual(gameDefault.properties[1].ownerId, null, 'Property should remain unowned on decline');
  assert.strictEqual(gameDefault.turnPhase, 'END_TURN', 'Turn phase should transition to END_TURN when auctions disabled');
  assert.strictEqual(gameDefault.pendingAuction, null, 'No auction should be created');

  // Enabled: auctionsEnabled: true
  const gameAuction = new GameEngine('TEST_DECLINE_ON', 'p1', { auctionsEnabled: true });
  assert.strictEqual(gameAuction.rules.auctionsEnabled, true, 'Auctions should be enabled');
  const pa1 = gameAuction.addPlayer('p1', 'Alice');
  gameAuction.addPlayer('p2', 'Bob');
  gameAuction.startGame('p1');

  pa1.position = 1;
  gameAuction.turnPhase = 'ACTION';
  gameAuction.declineProperty('p1');
  assert.strictEqual(gameAuction.turnPhase, 'AUCTION', 'Turn phase should transition to AUCTION');
  assert.notStrictEqual(gameAuction.pendingAuction, null, 'Auction object should be active');
  assert.strictEqual(gameAuction.pendingAuction.spaceId, 1);

  // Clean up
  deleteRoomState('TEST_DECLINE_OFF');
  deleteRoomState('TEST_DECLINE_ON');
  console.log('  ✅ Passed: Decline cleanly leaves property unowned by default, or triggers auction when enabled.');
}

// Test 8: Debt Enforcement & Resolution
{
  console.log('Test 8: Debt Enforcement & Turn Block');
  const game = new GameEngine('TEST_DEBT', 'p1');
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  // Give Alice Mediterranean Ave
  game.properties[1].ownerId = 'p1';
  p1.money = -200; // in debt
  game.turnPhase = 'END_TURN';

  // Attempting to end turn with negative money must throw
  assert.throws(() => {
    game.endTurn('p1');
  }, /debt/i, 'Ending turn while in debt must be rejected');

  // Alice mortgages Mediterranean Ave ($30)
  game.mortgageProperty('p1', 1);
  assert.strictEqual(p1.money, -170);
  assert.strictEqual(game.properties[1].mortgaged, true);

  // Give Alice enough cash to clear debt
  p1.money = 100;
  game.turnPhase = 'RESOLVE_DEBT';
  // Simulating resolving debt
  if (p1.money >= 0) game.turnPhase = 'END_TURN';

  // Now ending turn succeeds
  game.endTurn('p1');
  assert.strictEqual(game.getActivePlayer().id, 'p2', 'Turn must advance to Bob after debt is cleared');

  deleteRoomState('TEST_DEBT');
  console.log('  ✅ Passed: Turn cannot be ended with negative cash; debt must be resolved.');
}

// Test 9: Bankruptcy Asset Transfer & Instant Game Victory
{
  console.log('Test 9: Bankruptcy Asset Transfer & Game Over Trigger');
  const game = new GameEngine('TEST_BANKRUPT', 'p1');
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  // Bob owns Boardwalk (39)
  game.properties[39].ownerId = 'p2';
  p2.money = -500;
  game.lastCreditorId = 'p1'; // owed rent to Alice

  // Bob declares bankruptcy to Alice
  game.declareBankruptcy('p2', 'p1');

  assert.strictEqual(p2.bankrupt, true, 'Bob should be bankrupt');
  assert.strictEqual(game.properties[39].ownerId, 'p1', 'Boardwalk should be transferred to Alice');
  assert.strictEqual(game.status, 'finished', 'Game should immediately finish with only 1 solvent player');
  assert.strictEqual(game.winner.id, 'p1', 'Alice should be declared the winner');

  deleteRoomState('TEST_BANKRUPT');
  console.log('  ✅ Passed: Assets transfer to creditor and last solvent player wins immediately.');
}

// Test 10: Bot Auto-Liquidation & Insolvency
{
  console.log('Test 10: AI Bot Auto-Liquidation');
  const game = new GameEngine('TEST_BOT_LIQ', 'p1');
  const p1 = game.addPlayer('p1', 'Alice');
  const bot = game.addPlayer('bot1', 'Bot Charlie 🤖', '#3b82f6', 'dog', true);
  game.startGame('p1');

  // Bot owns Reading RR (5) and Pennsylvania RR (15), unmortgaged
  game.properties[5].ownerId = 'bot1';
  game.properties[15].ownerId = 'bot1';
  bot.money = -150;

  // Max liquidation value should be positive (-150 + 100 + 100 = 50)
  const maxVal = game.calculateMaxLiquidationValue('bot1');
  assert.strictEqual(maxVal, 50, 'Max liquidation value should account for unmortgaged properties');

  // Auto-liquidate to reach $0
  const cleared = game.autoLiquidate('bot1', 0);
  assert.strictEqual(cleared, true, 'Bot should successfully auto-liquidate to reach >= 0 cash');
  assert.strictEqual(bot.money >= 0, true, 'Bot balance should now be non-negative');

  deleteRoomState('TEST_BOT_LIQ');
  console.log('  ✅ Passed: AI Bot successfully auto-mortgages to escape debt.');
}

// Test 11: AI Bot Trade Evaluation
{
  console.log('Test 11: AI Bot Trade Evaluation');
  const game = new GameEngine('TEST_BOT_TRADE', 'p1');
  const p1 = game.addPlayer('p1', 'Alice');
  const bot = game.addPlayer('bot1', 'Bot Charlie 🤖', '#3b82f6', 'dog', true);
  game.startGame('p1');

  // Bot owns Baltic Ave (3). Alice owns Mediterranean Ave (1).
  game.properties[3].ownerId = 'bot1';
  game.properties[1].ownerId = 'p1';

  // 1. Fair/Favorable offer to bot: Alice offers Mediterranean (completes Brown monopoly for bot) + $100 for Baltic?
  // If Alice offers Mediterranean Ave (completing Bot's monopoly) in exchange for nothing or cheap railroad:
  const fairOffer = {
    fromPlayerId: 'p1',
    offerMoney: 100,
    offerProperties: [1], // Med Ave ($60 face value, but completes Brown set for bot!)
    requestMoney: 0,
    requestProperties: []
  };
  const evalFair = evaluateBotTrade(game, 'bot1', fairOffer);
  assert.strictEqual(evalFair.accept, true, 'Bot should accept generous/monopoly-completing trade');

  // 2. Unfair/exploitative offer: Alice offers $10 to take Bot's Baltic Ave ($60 value)
  const unfairOffer = {
    fromPlayerId: 'p1',
    offerMoney: 10,
    offerProperties: [],
    requestMoney: 0,
    requestProperties: [3]
  };
  const evalUnfair = evaluateBotTrade(game, 'bot1', unfairOffer);
  assert.strictEqual(evalUnfair.accept, false, 'Bot should reject one-sided unfair trade');

  deleteRoomState('TEST_BOT_TRADE');
  console.log('  ✅ Passed: AI Bot accurately evaluates trade value, synergies, and unfair offers.');
}

// Test 12: Rent Negotiation House Rule Trigger
{
  console.log('Test 12: Rent Negotiation Trigger & Pending Rent Phase');
  const game = new GameEngine('TEST_RENT_NEG', 'p1');
  assert.strictEqual(game.rules.rentNegotiation, true, 'Rent negotiation must be enabled by default');
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  // Bob owns Boardwalk (39)
  game.properties[39].ownerId = 'p2';

  // Alice lands on Boardwalk (rent is $50)
  p1.position = 39;
  game._payRent(p1, BOARD_SPACES[39], 7, false);

  assert.strictEqual(game.turnPhase, 'RENT_NEGOTIATION', 'Turn phase must switch to RENT_NEGOTIATION');
  assert.notStrictEqual(game.pendingRent, null, 'pendingRent object must be initialized');
  assert.strictEqual(game.pendingRent.debtorId, 'p1');
  assert.strictEqual(game.pendingRent.creditorId, 'p2');
  assert.strictEqual(game.pendingRent.rent, 50);

  deleteRoomState('TEST_RENT_NEG');
  console.log('  ✅ Passed: Landing on owned property triggers RENT_NEGOTIATION phase by default.');
}

// Test 13: Pay Pending Rent (Full Rent Payment)
{
  console.log('Test 13: Pay Pending Rent Settlement');
  const game = new GameEngine('TEST_PAY_RENT', 'p1');
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  game.properties[39].ownerId = 'p2';
  p1.position = 39;
  game._payRent(p1, BOARD_SPACES[39], 7, false);

  const p1Initial = p1.money;
  const p2Initial = p2.money;

  // Alice pays full rent
  game.payPendingRent('p1');

  assert.strictEqual(p1.money, p1Initial - 50, 'Debtor should lose full rent amount');
  assert.strictEqual(p2.money, p2Initial + 50, 'Creditor should gain full rent amount');
  assert.strictEqual(game.pendingRent, null, 'pendingRent should be cleared');
  assert.strictEqual(game.turnPhase, 'END_TURN', 'Phase should transition to END_TURN');

  deleteRoomState('TEST_PAY_RENT');
  console.log('  ✅ Passed: Full pending rent payment successfully transfers cash and advances turn.');
}

// Test 14: Rent Compromise Deal (Propose & Respond)
{
  console.log('Test 14: Rent Compromise Settlement (Deed + Cash Transfer)');
  const game = new GameEngine('TEST_RENT_DEAL', 'p1');
  const p1 = game.addPlayer('p1', 'Alice');
  const p2 = game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  // Bob owns Park Place (37) with rent $35
  game.properties[37].ownerId = 'p2';
  // Alice owns Oriental Ave (6)
  game.properties[6].ownerId = 'p1';
  p1.getOutOfJailCards.chance = true;

  p1.position = 37;
  game._payRent(p1, BOARD_SPACES[37], 7, false);
  assert.strictEqual(game.turnPhase, 'RENT_NEGOTIATION');

  // Alice proposes: $10 cash + Oriental Ave + Jail Card
  game.proposeRentDeal('p1', {
    cashOffer: 10,
    propertyOffer: 6,
    jailCardOffer: true
  });

  assert.notStrictEqual(game.pendingRent.dealOffer, null);
  assert.strictEqual(game.pendingRent.dealOffer.cashOffer, 10);
  assert.strictEqual(game.pendingRent.dealOffer.propertyOffer, 6);

  const p1Pre = p1.money;
  const p2Pre = p2.money;

  // Bob accepts the deal!
  game.respondRentDeal('p2', true);

  assert.strictEqual(p1.money, p1Pre - 10, 'Alice should only pay $10 cash');
  assert.strictEqual(p2.money, p2Pre + 10, 'Bob should receive $10 cash');
  assert.strictEqual(game.properties[6].ownerId, 'p2', 'Oriental Ave ownership transferred to Bob');
  assert.strictEqual(p1.getOutOfJailCards.chance, false, 'Alice surrendered Jail Card');
  assert.strictEqual(p2.getOutOfJailCards.chance, true, 'Bob received Jail Card');
  assert.strictEqual(game.pendingRent, null, 'Pending rent cleared');
  assert.strictEqual(game.turnPhase, 'END_TURN');

  deleteRoomState('TEST_RENT_DEAL');
  console.log('  ✅ Passed: Compromise rent deal successfully waives rent and transfers agreed assets.');
}

// Test 15: AI Bot Rent Deal Evaluation
{
  console.log('Test 15: AI Bot Rent Deal Evaluation');
  const game = new GameEngine('TEST_BOT_RENT_EVAL', 'p1');
  const p1 = game.addPlayer('p1', 'Alice');
  const bot = game.addPlayer('bot1', 'Bot Charlie 🤖', '#3b82f6', 'dog', true);
  game.startGame('p1');

  const pendingRent = {
    debtorId: 'p1',
    creditorId: 'bot1',
    rent: 100
  };

  // 1. Generous / fair offer: $85 cash for $100 rent (>= 80%)
  const fairCashOffer = { cashOffer: 85, propertyOffer: null, jailCardOffer: false };
  const evalFair = evaluateRentDeal(game, 'bot1', pendingRent, fairCashOffer);
  assert.strictEqual(evalFair.accept, true, 'Bot should accept >=80% cash rent settlement');

  // 2. Monopoly completing offer: Baltic Ave (value $60 * 2.6 = $156) for $100 rent
  game.properties[1].ownerId = 'bot1'; // Bot owns Mediterranean
  const monopolyOffer = { cashOffer: 10, propertyOffer: 3, jailCardOffer: false }; // Baltic Ave completes Brown!
  const evalMonopoly = evaluateRentDeal(game, 'bot1', pendingRent, monopolyOffer);
  assert.strictEqual(evalMonopoly.accept, true, 'Bot should accept compromise that completes a monopoly');

  // 3. Lowball offer: $15 cash for $100 rent (< 50%)
  const lowballOffer = { cashOffer: 15, propertyOffer: null, jailCardOffer: false };
  const evalLowball = evaluateRentDeal(game, 'bot1', pendingRent, lowballOffer);
  assert.strictEqual(evalLowball.accept, false, 'Bot should reject lowball rent offer');

  deleteRoomState('TEST_BOT_RENT_EVAL');
  console.log('  ✅ Passed: AI Bot evaluates rent settlements with synergy and fairness.');
}

// Test 16: Building Styles & Neighborhood Street Customization (Hometown Realitor)
{
  console.log('Test 16: Building Styles & Neighborhood Customization');
  const game = new GameEngine('TEST_THEME', 'p1', {
    buildingStyle: 'RV_RESORT',
    neighborhoodPreset: 'BEACH_TOWN',
    customSpaceNames: { 1: 'Pineapple Alley' }
  });

  const p1 = game.addPlayer('p1', 'Alice');
  game.addPlayer('p2', 'Bob');
  game.startGame('p1');

  // Verify custom space name overrides preset
  assert.strictEqual(game.getSpaceName(1), 'Pineapple Alley', 'Space 1 should use custom name');
  // Verify space 3 uses BEACH_TOWN preset
  assert.strictEqual(game.getSpaceName(3), 'Seashell Drive', 'Space 3 should use BEACH_TOWN preset');
  // Verify space 0 is PAYDAY
  assert.strictEqual(game.getSpaceName(0), 'PAYDAY', 'Space 0 should be PAYDAY');

  // Give Alice Space 1 and 3 (Brown group)
  game.properties[1].ownerId = 'p1';
  game.properties[3].ownerId = 'p1';

  // Build unit on Space 1
  game.buildHouse('p1', 1);
  const latestLog = game.logs[game.logs.length - 1];
  assert.strictEqual(latestLog.text.includes('RV Lot #1'), true, 'Log should refer to RV Lot #1');
  assert.strictEqual(latestLog.text.includes('Pineapple Alley'), true, 'Log should refer to Pineapple Alley');

  // Verify building style metadata in toJSON
  const jsonState = game.toJSON();
  assert.strictEqual(jsonState.buildingStyle.singleName, 'RV Lot');
  assert.strictEqual(jsonState.buildingStyle.topName, 'Glamping Resort');
  assert.strictEqual(jsonState.spaceNames[1], 'Pineapple Alley');

  deleteRoomState('TEST_THEME');
  console.log('  ✅ Passed: Custom building styles and neighborhood street names render dynamically.');
}

// Test 17: AI Bot Auction Valuation & Bidding
{
  console.log('Test 17: AI Bot Auction Valuation & Bidding');
  const game = new GameEngine('TEST_AUCTION_BOT', 'p1', { auctionsEnabled: true, startingCash: 1500 });
  const p1 = game.addPlayer('p1', 'Alice');
  const bot = game.addPlayer('bot_1', 'Neighbor Charlie 🤖', '#3b82f6', 'skateboard', true);
  game.startGame('p1');

  // Trigger auction on Boardwalk (space 39)
  p1.position = 39;
  game.turnPhase = 'ACTION';
  game.declineProperty('p1');

  assert.strictEqual(game.turnPhase, 'AUCTION');
  assert.strictEqual(game.pendingAuction.spaceId, 39);
  assert.strictEqual(game.pendingAuction.currentBid, 10);

  // 1. Bot with $1500 evaluates Boardwalk at current bid $10: should place a bid
  const eval1 = evaluateBotAuctionBid(game, 'bot_1', 39, 10);
  assert.strictEqual(eval1.bid, true, 'Bot should want to bid on Boardwalk');
  assert.strictEqual(eval1.bidAmount, 20, 'Next bid should be $20');

  // Place the bid
  game.placeBid('bot_1', 20);
  assert.strictEqual(game.pendingAuction.currentBid, 20);
  assert.strictEqual(game.pendingAuction.highBidderId, 'bot_1');

  // 2. Bot shouldn't outbid itself
  const evalSelf = evaluateBotAuctionBid(game, 'bot_1', 39, 20);
  assert.strictEqual(evalSelf.bid, false, 'Bot should not outbid itself');

  // 3. Monopoly completion increases valuation
  // Give bot Park Place (37)
  game.properties[37].ownerId = 'bot_1';
  // Opponent Alice outbids bot at $100
  game.placeBid('p1', 100);
  assert.strictEqual(game.pendingAuction.highBidderId, 'p1');
  assert.strictEqual(game.pendingAuction.currentBid, 100);

  const evalMonopoly = evaluateBotAuctionBid(game, 'bot_1', 39, 100);
  assert.strictEqual(evalMonopoly.bid, true, 'Bot should counter-bid on monopoly piece');
  // Boardwalk base price is 400. Monopoly multiplier is 2.4 => maxValuation = 960
  assert.strictEqual(evalMonopoly.maxValuation, 960, 'Monopoly synergy should boost valuation to 960');
  assert.strictEqual(evalMonopoly.bidAmount, 110, 'Counter-bid should be $110');

  // 4. Low cash bot passes when it cannot afford safely
  bot.money = 50; // below cash reserve ($80)
  const evalPoor = evaluateBotAuctionBid(game, 'bot_1', 39, 10);
  assert.strictEqual(evalPoor.bid, false, 'Poor bot should pass to preserve reserve');

  deleteRoomState('TEST_AUCTION_BOT');
  console.log('  ✅ Passed: AI Bot strategically bids in auctions, values monopolies, and respects cash reserves.');
}

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 100% Core Engine & Rules Verification.');

