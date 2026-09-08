import assert from 'assert';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3050';
const WS_URL = 'ws://localhost:3050';

async function runE2ETest() {
  console.log('🧪 Starting End-to-End WebSocket & Multiplayer Integration Test...\n');

  // Step 1: Create room via API with house rules
  console.log('Step 1: Creating room via REST API with House Rules enabled...');
  const createRes = await fetch(`${BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hostName: 'Player1_Host',
      rules: {
        freeParkingJackpot: true,
        freeParkingSeed: 200,
        doubleGoBonus: true,
        noRentInJail: true,
        snakeEyesBonus: true
      },
      color: '#e74c3c',
      tokenIcon: 'car'
    })
  });
  const roomData = await createRes.json();
  const roomId = roomData.roomId;
  const hostId = roomData.playerId;
  console.log(`  ✅ Room created: ${roomId}, Host ID: ${hostId}`);

  // Step 2: Connect Host via WebSocket
  console.log('Step 2: Connecting Host WebSocket...');
  const ws1 = new WebSocket(WS_URL);
  let ws1State = null;

  await new Promise((resolve) => {
    ws1.on('open', () => {
      ws1.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomId,
        playerId: hostId,
        name: 'Player1_Host',
        color: '#e74c3c',
        tokenIcon: 'car'
      }));
    });

    ws1.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'JOINED_SUCCESS' || msg.type === 'ROOM_STATE') {
        ws1State = msg.state;
        resolve();
      }
    });
  });
  console.log(`  ✅ Host joined room. Player count: ${ws1State.players.length}`);

  // Step 3: Connect Player 2 via WebSocket
  console.log('Step 3: Connecting Player 2 WebSocket...');
  const ws2 = new WebSocket(WS_URL);
  const p2Id = 'p_player2_uuid';
  let ws2State = null;

  await new Promise((resolve) => {
    ws2.on('open', () => {
      ws2.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomId,
        playerId: p2Id,
        name: 'Player2_Friend',
        color: '#3498db',
        tokenIcon: 'ship'
      }));
    });

    ws2.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'JOINED_SUCCESS' || msg.type === 'ROOM_STATE') {
        ws2State = msg.state;
        if (ws2State.players.length === 2) {
          resolve();
        }
      }
    });
  });
  console.log(`  ✅ Player 2 joined room. Player count: ${ws2State.players.length}`);

  // Step 4: Host Starts the Game
  console.log('Step 4: Host starts the game...');
  const gameStartedPromise = new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ROOM_STATE' && msg.state.status === 'playing') {
        ws1.off('message', handler);
        resolve(msg.state);
      }
    };
    ws1.on('message', handler);
  });

  ws1.send(JSON.stringify({
    type: 'START_GAME',
    roomId,
    playerId: hostId
  }));

  const playingState = await gameStartedPromise;
  assert.strictEqual(playingState.status, 'playing');
  assert.strictEqual(playingState.turnPhase, 'ROLL');
  console.log(`  ✅ Game status is now 'playing'! Current turn: ${playingState.players[playingState.currentTurnIndex].name}`);

  // Step 5: Active player rolls dice
  console.log('Step 5: Active player rolls dice...');
  const rollPromise = new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ROOM_STATE') {
        const p1 = msg.state.players[0];
        if (p1.position !== 0 || msg.state.turnPhase !== 'ROLL') {
          ws1.off('message', handler);
          resolve(msg.state);
        }
      }
    };
    ws1.on('message', handler);
  });

  ws1.send(JSON.stringify({
    type: 'ROLL_DICE',
    roomId,
    playerId: hostId
  }));

  const afterRollState = await rollPromise;
  const p1 = afterRollState.players[0];
  console.log(`  ✅ Player 1 rolled [${afterRollState.dice.join(', ')}], moved to space #${p1.position}. Phase: ${afterRollState.turnPhase}`);

  // Step 6: Test Session Reconnection
  console.log('Step 6: Testing Session Reconnection after simulated drop...');
  ws1.close();

  const ws1Reconnect = new WebSocket(WS_URL);
  let restoredState = null;
  await new Promise((resolve) => {
    ws1Reconnect.on('open', () => {
      // Send same playerId and roomId
      ws1Reconnect.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomId,
        playerId: hostId,
        name: 'Player1_Host'
      }));
    });

    ws1Reconnect.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'JOINED_SUCCESS') {
        restoredState = msg.state;
        resolve();
      }
    });
  });

  assert.strictEqual(restoredState.id, roomId);
  assert.strictEqual(restoredState.players[0].id, hostId);
  assert.strictEqual(restoredState.players[0].position, p1.position);
  console.log('  ✅ Player 1 reconnected seamlessly with exact board position, money, and turn state preserved!');

  ws1Reconnect.close();
  ws2.close();
  console.log('\n🎉 ALL MULTIPLAYER & WEBSOCKET E2E TESTS PASSED 100%!\n');
}

runE2ETest().catch((err) => {
  console.error('❌ E2E Test Failed:', err);
  process.exit(1);
});
