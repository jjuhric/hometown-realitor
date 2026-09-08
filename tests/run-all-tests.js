import { spawn } from 'child_process';
import http from 'http';

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3050/api/info', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const executable = cmd === 'node' ? process.execPath : cmd;
    const proc = spawn(executable, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function main() {
  let serverProcess = null;
  const running = await checkServer();

  if (!running) {
    console.log('🚀 Launching background test server on port 3050...');
    serverProcess = spawn(process.execPath, ['server/server.js'], { stdio: 'ignore', detached: false });

    // Wait for server to become responsive
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 300));
      if (await checkServer()) {
        ready = true;
        break;
      }
    }

    if (!ready) {
      if (serverProcess) serverProcess.kill();
      console.error('❌ Failed to start test server on port 3050.');
      process.exit(1);
    }
    console.log('✅ Test server ready!\n');
  } else {
    console.log('⚡ Using active server on port 3050.\n');
  }

  try {
    console.log('▶️ Running Test 1: Rules & Core Engine...');
    await runCommand('node', ['tests/rules.test.js']);

    console.log('\n▶️ Running Test 2: Multiplayer & Reconnection E2E...');
    await runCommand('node', ['tests/e2e.test.js']);

    console.log('\n▶️ Running Test 3: Trade & Debt E2E...');
    await runCommand('node', ['tests/trade_and_debt_e2e.test.js']);

    console.log('\n▶️ Running Test 4: Rent Negotiation E2E...');
    await runCommand('node', ['tests/rent_negotiation_e2e.test.js']);

    console.log('\n▶️ Running Test 5: Lobby, Spectator, Rematch & Rate Limit E2E...');
    await runCommand('node', ['tests/lobby_and_exit_e2e.test.js']);

    console.log('\n🎉 ALL TEST SUITES COMPLETED WITH 100% SUCCESS!');
  } finally {
    if (serverProcess) {
      console.log('🛑 Stopping background test server...');
      serverProcess.kill();
    }
  }
}

main().catch((err) => {
  console.error('❌ Test suite execution failed:', err);
  process.exit(1);
});
