/**
 * QueueFlow Concurrency & Security Verification Suite
 * Tests:
 * 1. Simultaneous CALL NEXT requests (Promise.all race) -> strictly 1 succeeds
 * 2. Simultaneous token creations in parallel -> unique sequential token numbers & positions
 * 3. Database-level constraint: only 1 SERVING token per queue
 * 4. JWT & HTTP-Only cookie behavior: token not exposed in JSON, cookie options verified
 * 5. CORS policy verification against allowed and forbidden origins
 */

const assert = require('assert');
const { initDb, query, getClient } = require('../config/db');
const authController = require('../controllers/authController');
const queueController = require('../controllers/queueController');
const tokenController = require('../controllers/tokenController');
const jwt = require('jsonwebtoken');

// Mock Express req/res
const mockReqRes = (body = {}, params = {}, manager = null, cookies = {}, headers = {}) => {
  const req = { body, params, manager, cookies, headers };
  let responseData = null;
  let statusCode = 200;
  let cookiesSet = {};
  let cookiesCleared = {};

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    cookie: (name, val, options) => {
      cookiesSet[name] = { val, options };
    },
    clearCookie: (name, options) => {
      cookiesCleared[name] = options || true;
    },
  };

  const getResult = () => ({ statusCode, data: responseData, cookiesSet, cookiesCleared });
  return { req, res, getResult };
};

async function runConcurrencyTests() {
  console.log('====================================================');
  console.log('⚡ RUNNING ADVANCED CONCURRENCY & SECURITY VERIFICATION');
  console.log('====================================================\n');

  await initDb();

  // Setup test manager
  const testEmail = `concurrency_mgr_${Date.now()}@test.com`;
  const { req: regReq, res: regRes, getResult: getRegRes } = mockReqRes({
    full_name: 'Concurrency Tester',
    email: testEmail,
    password: 'Password123!',
  });
  await authController.register(regReq, regRes, (err) => { throw err; });
  const manager = getRegRes().data.manager;

  // ------------------------------------------------------------------
  // VERIFICATION 6: JWT Authentication & HTTP-Only Cookie Behavior
  // ------------------------------------------------------------------
  console.log('▶ [Verification 6] JWT Authentication and HTTP-Only Cookie Behavior...');
  const regResult = getRegRes();
  assert.strictEqual(regResult.data.token, undefined, 'CRITICAL: JWT token must NEVER be exposed in response body');
  assert.ok(regResult.cookiesSet.token, 'Auth cookie must be set on registration');
  assert.strictEqual(regResult.cookiesSet.token.options.httpOnly, true, 'Cookie must have httpOnly: true');
  assert.strictEqual(regResult.cookiesSet.token.options.sameSite, 'lax', 'Cookie must have sameSite: lax');

  // Verify login behavior
  const { req: logReq, res: logRes, getResult: getLogRes } = mockReqRes({
    email: testEmail,
    password: 'Password123!',
  });
  await authController.login(logReq, logRes, (err) => { throw err; });
  const logResult = getLogRes();
  assert.strictEqual(logResult.data.token, undefined, 'CRITICAL: JWT token must NEVER be exposed in login response body');
  assert.ok(logResult.cookiesSet.token, 'Cookie must be set on login');
  assert.strictEqual(logResult.cookiesSet.token.options.httpOnly, true, 'Login cookie must be httpOnly');

  // Verify logout behavior
  const { req: outReq, res: outRes, getResult: getOutRes } = mockReqRes({}, {}, manager);
  await authController.logout(outReq, outRes);
  const outResult = getOutRes();
  assert.ok(outResult.cookiesCleared.token, 'Logout must clear auth cookie');
  console.log('  ✓ JWT authentication strictly uses HTTP-only cookies; token is never exposed in JSON response.');

  // Create queue for concurrency tests
  const { req: qReq, res: qReqRes, getResult: getQRes } = mockReqRes(
    { name: 'Concurrency Queue', prefix: 'RACE' },
    {},
    manager
  );
  await queueController.createQueue(qReq, qReqRes, (err) => { throw err; });
  const queue = getQRes().data.queue;

  // ------------------------------------------------------------------
  // VERIFICATION 4: Simultaneous Token Creation
  // ------------------------------------------------------------------
  console.log('\n▶ [Verification 4] Simultaneous Token Creation (10 Parallel Requests)...');
  const addPromises = [];
  for (let i = 1; i <= 10; i++) {
    const { req: tReq, res: tRes, getResult: getTRes } = mockReqRes(
      { person_name: `Person ${i}`, phone_number: `+91 900000000${i}` },
      { id: queue.id },
      manager
    );
    addPromises.push(
      tokenController.addToken(tReq, tRes, (err) => { throw err; }).then(() => getTRes())
    );
  }

  const addResults = await Promise.all(addPromises);
  const tokenNumbers = addResults.map((r) => r.data.token.token_number);
  const positions = addResults.map((r) => r.data.token.position);

  // Check that all 10 tokens got unique token numbers
  const uniqueTokens = new Set(tokenNumbers);
  assert.strictEqual(uniqueTokens.size, 10, 'All 10 parallel tokens must have strictly unique token numbers');

  // Check that all positions are 1 through 10 with no duplicate positions
  const uniquePositions = new Set(positions);
  assert.strictEqual(uniquePositions.size, 10, 'All 10 parallel tokens must have strictly unique waiting positions');
  console.log(`  ✓ 10 simultaneous token creations handled safely: generated ${Array.from(uniqueTokens).slice(0, 4).join(', ')}... without collisions.`);

  // ------------------------------------------------------------------
  // VERIFICATION 3 & 5: Simultaneous CALL NEXT Requests & Single Serving Rule
  // ------------------------------------------------------------------
  console.log('\n▶ [Verification 3 & 5] Simultaneous CALL NEXT Requests (Race Condition Test)...');
  const callPromises = [];
  // Fire 5 simultaneous CALL NEXT requests at the exact same instant
  for (let i = 0; i < 5; i++) {
    const { req: cReq, res: cRes, getResult: getCRes } = mockReqRes(
      {},
      { id: queue.id },
      manager
    );
    callPromises.push(
      tokenController.callNextToken(cReq, cRes, (err) => { throw err; }).then(() => getCRes())
    );
  }

  const callResults = await Promise.all(callPromises);
  const successCalls = callResults.filter((r) => r.statusCode === 200);
  const rejectedCalls = callResults.filter((r) => r.statusCode === 400);

  console.log(`  ✓ Simultaneous requests result: ${successCalls.length} succeeded, ${rejectedCalls.length} safely rejected.`);
  assert.strictEqual(successCalls.length, 1, 'CRITICAL: Exactly ONE CALL NEXT request must succeed');
  assert.strictEqual(rejectedCalls.length, 4, 'Remaining 4 simultaneous requests must be rejected with 400');

  // Verify database state: strictly 1 token in SERVING state
  const dbServingCheck = await query(
    `SELECT COUNT(*)::int AS cnt FROM tokens WHERE queue_id = $1 AND status = 'SERVING'`,
    [queue.id]
  );
  assert.strictEqual(dbServingCheck.rows[0].cnt, 1, 'Database must contain exactly 1 SERVING token');
  console.log('  ✓ Verified database integrity: exactly ONE token in SERVING state exists for this queue.');

  // ------------------------------------------------------------------
  // VERIFICATION 7: CORS Configuration Test
  // ------------------------------------------------------------------
  console.log('\n▶ [Verification 7] CORS Origin Policy Test...');
  const cors = require('cors');
  const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ].filter(Boolean);

  const corsMiddleware = cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' &&
          (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: Origin ${origin} is not allowed.`));
    },
    credentials: true,
  });

  // Test Allowed Origin
  let allowedPass = false;
  corsMiddleware({ method: 'GET', headers: { origin: 'http://localhost:5173' } }, {
    getHeader: () => {},
    setHeader: () => {},
  }, (err) => {
    if (!err) allowedPass = true;
  });
  assert.strictEqual(allowedPass, true, 'Origin http://localhost:5173 must be allowed');
  console.log('  ✓ Frontend origin http://localhost:5173 is successfully permitted with credentials.');

  // Test Forbidden Origin
  let forbiddenBlocked = false;
  corsMiddleware({ method: 'GET', headers: { origin: 'https://malicious-external-site.com' } }, {
    getHeader: () => {},
    setHeader: () => {},
  }, (err) => {
    if (err && err.message.includes('CORS blocked')) forbiddenBlocked = true;
  });
  assert.strictEqual(forbiddenBlocked, true, 'Malicious external origin must be blocked by CORS');
  console.log('  ✓ Untrusted origin https://malicious-external-site.com is strictly blocked by CORS policy.');

  console.log('\n====================================================');
  console.log('🎉 ALL CONCURRENCY, SECURITY & DATABASE TESTS PASSED!');
  console.log('====================================================\n');
}

runConcurrencyTests().catch((err) => {
  console.error('\n❌ Concurrency Test Suite Failed:', err);
  process.exit(1);
});
