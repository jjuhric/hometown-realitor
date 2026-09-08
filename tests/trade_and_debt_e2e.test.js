import assert from 'assert';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:3050';
const WS_URL = 'ws://localhost:3050';

async function runTradeAndDebtTest() {
  console.log('🧪 Starting Trade Negotiation & Debt E2E Test...\n');

  // 1. Create Room
  const createRes = await fetch(`${BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hostName: 'Tycoon_Host',
      rules: { startingCash: 1500 }
    })
  });
  const { roomId, playerId: hostId } = await createRes.json();
  console.log(`Step 1: Created room ${roomId} with Host ${hostId}`);

  // 2. Connect Host WebSocket
  const hostWs = new WebSocket(WS_URL);
  await new Promise((resolve) => {
    hostWs.on('open', () => {
      hostWs.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomId,
        playerId: hostId,
        name: 'Tycoon_Host',
        color: '#e74c3c',
        tokenIcon: 'car'
      }));
    });
    hostWs.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'JOINED_SUCCESS') resolve();
    });
  });

  // 3. Add AI Bot
  hostWs.send(JSON.stringify({
    type: 'ADD_BOT',
    roomId,
    playerId: hostId
  }));

  let botPlayer = null;
  await new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'ROOM_STATE') {
        const bot = msg.state.players.find(p => p.isBot);
        if (bot) {
          botPlayer = bot;
          hostWs.off('message', handler);
          resolve();
        }
      }
    };
    hostWs.on('message', handler);
  });
  console.log(`Step 2: Added AI Bot ${botPlayer.name} (${botPlayer.id})`);

  // 4. Start Game
  hostWs.send(JSON.stringify({
    type: 'START_GAME',
    roomId,
    playerId: hostId
  }));

  await new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'ROOM_STATE' && msg.state.status === 'playing') {
        hostWs.off('message', handler);
        resolve();
      }
    };
    hostWs.on('message', handler);
  });
  console.log('Step 3: Game is playing!');

  // 5. Propose Trade to Bot
  console.log('Step 4: Proposing trade to AI Bot...');
  hostWs.send(JSON.stringify({
    type: 'PROPOSE_TRADE',
    roomId,
    playerId: hostId,
    toPlayerId: botPlayer.id,
    offer: {
      offerMoney: 200,
      offerProperties: [],
      requestMoney: 0,
      requestProperties: []
    }
  }));

  // Wait for bot to respond to fair trade
  await new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'ROOM_STATE') {
        const chatLog = msg.state.logs.find(l => l.type === 'chat' && l.text.includes(botPlayer.name) && l.text.includes('Deal'));
        if (chatLog) {
          console.log(`  ✅ Bot accepted fair trade in chat: ${chatLog.text}`);
          hostWs.off('message', handler);
          resolve();
        }
      }
    };
    hostWs.on('message', handler);
  });

  // 6. Propose Unfair Trade to Bot
  console.log('Step 5: Proposing unfair trade to AI Bot (demanding $500 for nothing)...');
  hostWs.send(JSON.stringify({
    type: 'PROPOSE_TRADE',
    roomId,
    playerId: hostId,
    toPlayerId: botPlayer.id,
    offer: {
      offerMoney: 0,
      offerProperties: [],
      requestMoney: 500,
      requestProperties: []
    }
  }));

  // Wait for bot to reject
  await new Promise((resolve) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'ROOM_STATE') {
        const chatLog = msg.state.logs.find(l => l.type === 'chat' && l.text.includes(botPlayer.name) && (l.text.includes('No way') || l.text.includes('reserve')));
        if (chatLog) {
          console.log(`  ✅ Bot rejected unfair trade in chat: ${chatLog.text}`);
          hostWs.off('message', handler);
          resolve();
        }
      }
    };
    hostWs.on('message', handler);
  });

  hostWs.close();
  console.log('\n🎉 Trade & Debt E2E Test Passed Successfully!');
}

runTradeAndDebtTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

