const autocannon = require('autocannon');
const { promisify } = require('util');

const run = promisify(autocannon);

async function loadTest() {
  console.log('Starting load tests...\n');

  // Test 1: Health check endpoint
  console.log('1. Testing health check endpoint...');
  const healthTest = await run({
    url: 'http://localhost:3000/health',
    connections: 10,
    duration: 10
  });
  console.log(`Health check: ${healthTest.requests.average} req/sec\n`);

  // Test 2: Auth registration
  console.log('2. Testing auth registration...');
  const authTest = await run({
    url: 'http://localhost:3000/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'loadtest@example.com',
      password: 'password123',
      name: 'Load Test User'
    }),
    connections: 5,
    duration: 10
  });
  console.log(`Auth registration: ${authTest.requests.average} req/sec\n`);

  // Test 3: Chat message processing
  console.log('3. Testing chat message processing...');
  const chatTest = await run({
    url: 'http://localhost:3000/api/chat/message',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      message: 'Hello, this is a load test message',
      sessionId: 'load-test-session',
      model: 'gpt-4',
      userId: 'load-test-user'
    }),
    connections: 3,
    duration: 10
  });
  console.log(`Chat processing: ${chatTest.requests.average} req/sec\n`);

  // Test 4: Concurrent mixed load
  console.log('4. Testing concurrent mixed load...');
  const mixedTest = await run({
    url: 'http://localhost:3000',
    connections: 20,
    duration: 30,
    requests: [
      { method: 'GET', path: '/health' },
      { method: 'GET', path: '/api/auth/health' },
      { method: 'GET', path: '/api/chat/health' }
    ]
  });
  console.log(`Mixed load: ${mixedTest.requests.average} req/sec\n`);

  console.log('Load testing completed!');
}

// Stress test function
async function stressTest() {
  console.log('Starting stress test...\n');

  const stressTest = await run({
    url: 'http://localhost:3000/health',
    connections: 100,
    duration: 60,
    timeout: 10
  });

  console.log(`Stress test results:`);
  console.log(`- Requests: ${stressTest.requests.total}`);
  console.log(`- Average: ${stressTest.requests.average} req/sec`);
  console.log(`- Min: ${stressTest.latency.min} ms`);
  console.log(`- Max: ${stressTest.latency.max} ms`);
  console.log(`- P99: ${stressTest.latency.p99} ms`);
  console.log(`- Errors: ${stressTest.errors}`);
  console.log(`- Timeouts: ${stressTest.timeouts}`);
}

// Memory leak test
async function memoryLeakTest() {
  console.log('Starting memory leak test...\n');

  for (let i = 0; i < 10; i++) {
    const test = await run({
      url: 'http://localhost:3000/health',
      connections: 50,
      duration: 30
    });

    console.log(`Round ${i + 1}: ${test.requests.average} req/sec`);
    
    // Wait between rounds
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  switch (args[0]) {
    case 'load':
      await loadTest();
      break;
    case 'stress':
      await stressTest();
      break;
    case 'memory':
      await memoryLeakTest();
      break;
    default:
      console.log('Usage: node load-test.js [load|stress|memory]');
      console.log('  load   - Basic load testing');
      console.log('  stress - Stress testing with high concurrency');
      console.log('  memory - Memory leak testing');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { loadTest, stressTest, memoryLeakTest };






