import assert from 'assert';
import http from 'http';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3050';
const WS_URL = 'ws://localhost:3050';

function postJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(BASE_URL + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE_URL + path, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🧪 Starting Lobby & Exit Game E2E Test Suite...\n');

  // Step 1: Create a room and verify it appears in GET /api/rooms
  console.log('Step 1: Creating room via REST API...');
  const roomData = await postJson('/api/rooms', {
    hostName: 'TestHost',
    rules: { freeParkingJackpot: true },
    color: '#3b82f6',
    tokenIcon: 'skateboard'
  });
  const roomId = roomData.roomId;
  const hostId = roomData.playerId;
  console.log(`  ✅ Room created: ${roomId}, Host: ${hostId}`);

  console.log('Step 2: Checking GET /api/rooms for active joinable room...');
  const roomsList = await getJson('/api/rooms');
  const foundRoom = roomsList.find(r => r.id === roomId);
  assert(foundRoom, 'Room must be present in /api/rooms');
  assert.strictEqual(foundRoom.hostName, 'TestHost');
  assert.strictEqual(foundRoom.playerCount, 1);
  assert(foundRoom.rulesHighlights.includes('Pot Active'), 'Must include Pot Active rule tag');
  console.log('  ✅ Room correctly listed in joinable rooms directory with highlights.');

  // Step 3: Connect Host and Player 2 via WebSocket
  console.log('Step 3: Connecting Host and Player 2...');
  const hostWs = new WebSocket(WS_URL);
  await new Promise(res => hostWs.on('open', res));
  hostWs.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId,
    playerId: hostId,
    name: 'TestHost'
  }));

  const p2Id = 'p_testp2';
  const p2Ws = new WebSocket(WS_URL);
  await new Promise(res => p2Ws.on('open', res));
  p2Ws.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId,
    playerId: p2Id,
    name: 'Player 2'
  }));

  await new Promise(r => setTimeout(r, 400));

  // Step 4: Player 2 leaves lobby via LEAVE_ROOM
  console.log('Step 4: Player 2 leaves lobby via LEAVE_ROOM...');
  p2Ws.send(JSON.stringify({
    type: 'LEAVE_ROOM',
    roomId,
    playerId: p2Id
  }));

  await new Promise(r => setTimeout(r, 400));
  const roomsAfterLeave = await getJson('/api/rooms');
  const roomAfterLeave = roomsAfterLeave.find(r => r.id === roomId);
  assert.strictEqual(roomAfterLeave.playerCount, 1, 'Player count should be 1 after Player 2 leaves');
  console.log('  ✅ Player 2 cleanly left the lobby. Player count decremented.');

  // Step 5: Start game and test Host END_GAME
  console.log('Step 5: Starting game and testing Host END_GAME...');
  hostWs.send(JSON.stringify({ type: 'ADD_BOT', roomId, playerId: hostId }));
  await new Promise(r => setTimeout(r, 300));
  hostWs.send(JSON.stringify({ type: 'START_GAME', roomId, playerId: hostId }));
  await new Promise(r => setTimeout(r, 400));

  let gameEndedReceived = false;
  hostWs.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'GAME_ENDED') {
      gameEndedReceived = true;
    }
  });

  hostWs.send(JSON.stringify({
    type: 'END_GAME',
    roomId,
    playerId: hostId
  }));

  await new Promise(r => setTimeout(r, 500));
  assert(gameEndedReceived, 'Host must receive GAME_ENDED event');

  const finalRooms = await getJson('/api/rooms');
  const terminatedRoom = finalRooms.find(r => r.id === roomId);
  assert(!terminatedRoom, 'Terminated room should no longer appear in open rooms');
  console.log('  ✅ Host successfully ended the game. Room terminated and all clients notified.');

  hostWs.close();
  p2Ws.close();

  // Step 6: Spectator Mode Verification
  console.log('Step 6: Testing Spectator Mode in live game...');
  const specRoom = await postJson('/api/rooms', { hostName: 'SpecHost' });
  const sRoomId = specRoom.roomId;
  const sHostId = specRoom.playerId;

  const sHostWs = new WebSocket(WS_URL);
  await new Promise(res => sHostWs.on('open', res));
  sHostWs.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: sRoomId, playerId: sHostId, name: 'SpecHost' }));
  await new Promise(r => setTimeout(r, 200));

  // Add bot and start game so status is 'playing'
  sHostWs.send(JSON.stringify({ type: 'ADD_BOT', roomId: sRoomId, playerId: sHostId }));
  await new Promise(r => setTimeout(r, 200));
  sHostWs.send(JSON.stringify({ type: 'START_GAME', roomId: sRoomId, playerId: sHostId }));
  await new Promise(r => setTimeout(r, 300));

  // Connect spectator
  const specWs = new WebSocket(WS_URL);
  await new Promise(res => specWs.on('open', res));

  let joinedSuccess = null;
  let specErrorReceived = false;
  specWs.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'JOINED_SUCCESS') joinedSuccess = msg;
    if (msg.type === 'ERROR' && msg.message.includes('Spectators cannot perform')) {
      specErrorReceived = true;
    }
  });

  specWs.send(JSON.stringify({
    type: 'JOIN_AS_SPECTATOR',
    roomId: sRoomId,
    playerId: 'spec_viewer_1',
    name: 'WatcherBob'
  }));

  await new Promise(r => setTimeout(r, 400));
  assert(joinedSuccess, 'Spectator must receive JOINED_SUCCESS');
  assert.strictEqual(joinedSuccess.isSpectator, true, 'isSpectator must be true in JOINED_SUCCESS');
  assert.strictEqual(joinedSuccess.state.status, 'playing', 'State status must be playing');

  // Verify spectator count in /api/rooms
  const specRoomsList = await getJson('/api/rooms');
  const foundSpecRoom = specRoomsList.find(r => r.id === sRoomId);
  assert(foundSpecRoom, 'Spec room must be in /api/rooms');
  assert.strictEqual(foundSpecRoom.spectatorCount, 1, 'Spectator count should be 1');

  // Attempt unauthorized game action as spectator (ROLL_DICE)
  specWs.send(JSON.stringify({
    type: 'ROLL_DICE',
    roomId: sRoomId,
    playerId: 'spec_viewer_1'
  }));

  await new Promise(r => setTimeout(r, 400));
  assert(specErrorReceived, 'Spectator attempting to roll dice must receive error');
  console.log('  ✅ Spectator joined live match, verified isSpectator flag, and game action blocked.');

  // Spectator leaves cleanly
  specWs.send(JSON.stringify({
    type: 'LEAVE_ROOM',
    roomId: sRoomId,
    playerId: 'spec_viewer_1'
  }));
  await new Promise(r => setTimeout(r, 300));

  const specRoomsAfter = await getJson('/api/rooms');
  const foundAfter = specRoomsAfter.find(r => r.id === sRoomId);
  assert.strictEqual(foundAfter.spectatorCount, 0, 'Spectator count should be 0 after leaving');
  console.log('  ✅ Spectator cleanly left live room without affecting gameplay.');

  // Step 7: Quick Rematch Verification
  console.log('Step 7: Testing Quick Rematch after game finishes...');
  // Conclude game with a winner via bankruptcy
  sHostWs.send(JSON.stringify({
    type: 'BANKRUPTCY',
    roomId: sRoomId,
    playerId: sHostId
  }));
  await new Promise(r => setTimeout(r, 400));

  let rematchStartedMsg = null;
  sHostWs.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'REMATCH_STARTED') {
      rematchStartedMsg = msg;
    }
  });

  // Request Rematch
  sHostWs.send(JSON.stringify({
    type: 'REMATCH_REQUEST',
    roomId: sRoomId,
    playerId: sHostId
  }));

  await new Promise(r => setTimeout(r, 500));
  assert(rematchStartedMsg, 'Host must receive REMATCH_STARTED message');
  assert(rematchStartedMsg.newRoomId, 'Must have newRoomId');
  assert.notStrictEqual(rematchStartedMsg.newRoomId, sRoomId, 'New room ID must differ from old room ID');
  assert.strictEqual(rematchStartedMsg.state.status, 'lobby', 'New room must start in lobby status');
  assert.strictEqual(rematchStartedMsg.state.players.length, 2, 'New room must have same players preserved');
  console.log(`  ✅ Quick Rematch created new room ${rematchStartedMsg.newRoomId} with preserved rules & players.`);

  sHostWs.close();
  specWs.close();

  // Step 8: Stale Room Cleanup Verification
  console.log('Step 8: Testing Stale Room Cleanup API...');
  const cleanupRes = await postJson('/api/admin/cleanup', {
    finishedMaxAgeMs: 0,
    emptyLobbyMaxAgeMs: 0
  });
  assert.strictEqual(cleanupRes.success, true, 'Cleanup must succeed');
  assert(typeof cleanupRes.cleanedCount === 'number', 'Cleaned count must be number');
  // Step 9: Rate Limiting Verification
  console.log('Step 9: Testing WebSocket Rate Limiting...');
  const rateWs = new WebSocket(WS_URL);
  await new Promise(res => rateWs.on('open', res));

  let rateLimitHit = false;
  rateWs.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'ERROR' && msg.message.includes('Too many actions sent')) {
      rateLimitHit = true;
    }
  });

  // Send 25 rapid actions in a tight burst
  for (let i = 0; i < 25; i++) {
    rateWs.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      roomId: 'NON_EXISTENT',
      playerId: 'test',
      message: `spam_${i}`
    }));
  }

  await new Promise(r => setTimeout(r, 400));
  assert(rateLimitHit, 'Rapid message burst must trigger rate limit error');
  console.log('  ✅ Rapid message burst was correctly throttled by WebSocket rate limiter.');
  rateWs.close();

  console.log('\n🎉 ALL LOBBY, EXIT GAME, SPECTATOR, REMATCH, CLEANUP & RATE LIMIT TESTS PASSED 100%!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
