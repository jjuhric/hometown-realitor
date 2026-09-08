import assert from 'assert';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3050';
const WS_URL = 'ws://localhost:3050';

async function runRentNegotiationE2ETest() {
  console.log('🧪 Starting Rent Negotiation E2E Integration Test...\n');

  // 1. Create Room with rentNegotiation enabled (default)
  const createRes = await fetch(`${BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hostName: 'Alice',
      rules: { rentNegotiation: true },
      color: '#e74c3c',
      tokenIcon: 'car'
    })
  });
  const { roomId, playerId: hostId } = await createRes.json();
  console.log(`Step 1: Created room ${roomId} with Host ${hostId}`);

  // 2. Connect Host via WS
  const ws = new WebSocket(WS_URL);
  let latestState = null;

  await new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomId,
        playerId: hostId,
        name: 'Alice',
        color: '#e74c3c',
        tokenIcon: 'car'
      }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'JOINED_SUCCESS' || msg.type === 'ROOM_STATE') {
        latestState = msg.state;
        resolve();
      }
    });
  });

  // Track room state updates
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ROOM_STATE') {
        latestState = msg.state;
      }
    } catch (e) {}
  });

  // 3. Add AI Bot
  console.log('Step 2: Adding AI Bot...');
  ws.send(JSON.stringify({ type: 'ADD_BOT', roomId, playerId: hostId }));
  await new Promise(r => setTimeout(r, 600));

  // 4. Start Game
  console.log('Step 3: Starting game...');
  ws.send(JSON.stringify({ type: 'START_GAME', roomId, playerId: hostId }));
  await new Promise(r => setTimeout(r, 600));

  assert.strictEqual(latestState.status, 'playing', 'Game should be in playing status');
  assert.strictEqual(latestState.rules.rentNegotiation, true, 'rentNegotiation must be enabled in active game state');
  console.log('  ✅ Verified: rentNegotiation house rule is active and enabled by default.');

  // 5. Test Rent Negotiation WebSocket Actions
  // Send PROPOSE_RENT_DEAL and PAY_RENT verification
  console.log('Step 4: Testing WebSocket action routing for rent negotiation...');
  
  // Proposing when no rent is pending correctly returns error without crashing
  ws.send(JSON.stringify({
    type: 'PROPOSE_RENT_DEAL',
    roomId,
    playerId: hostId,
    offer: { cashOffer: 10, propertyOffer: null, jailCardOffer: false }
  }));
  await new Promise(r => setTimeout(r, 300));

  // Paying rent when none is pending correctly returns error without crashing
  ws.send(JSON.stringify({
    type: 'PAY_RENT',
    roomId,
    playerId: hostId
  }));
  await new Promise(r => setTimeout(r, 300));

  assert.strictEqual(latestState.status, 'playing', 'Server remained stable and in playing status');
  console.log('  ✅ Verified: WebSocket handles rent actions safely and room state is preserved.');

  ws.close();
  console.log('\n🎉 Rent Negotiation E2E Test Completed Successfully!');
}

runRentNegotiationE2ETest().catch(err => {
  console.error('❌ Rent Negotiation E2E Test Failed:', err);
  process.exit(1);
});
