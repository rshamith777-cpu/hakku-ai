import { spawn } from 'child_process';

const server = spawn('node', ['server.js'], {
  env: { ...process.env, HAKKU_TEST_MODE: '1', PORT: '3000' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let started = false;
server.stdout.on('data', async (d) => {
  const str = d.toString();
  if (str.includes('Server running') || str.includes('listening') || str.includes('3000')) {
    if (started) return;
    started = true;
    console.log('Server started. Running tests/session_expiry.test.mjs...');
    const unitTest = spawn('node', ['tests/session_expiry.test.mjs'], { stdio: 'inherit' });
    unitTest.on('close', (unitCode) => {
      if (unitCode !== 0) {
        console.error('Session expiry tests failed!');
        server.kill();
        process.exit(unitCode);
      }
      console.log('Session expiry tests passed! Running 100-profile sweep...');
      const sweep = spawn('node', ['tests/sweep.mjs'], { stdio: 'inherit' });
      sweep.on('close', (code) => {
        server.kill();
        process.exit(code || 0);
      });
    });
  }
});

server.stderr.on('data', (d) => {
  console.error('Server err:', d.toString());
});

setTimeout(() => {
  if (!started) {
    console.error('Timed out waiting for server to start');
    server.kill();
    process.exit(1);
  }
}, 7000);

