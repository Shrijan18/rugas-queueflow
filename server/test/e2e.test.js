/**
 * QueueFlow End-to-End Automated Test Suite
 * Validates Authentication, Queue Management, Token Ordering, Concurrency, and Analytics.
 */

const assert = require('assert');
const { initDb } = require('../config/db');

// Import controllers directly or test via server
const authController = require('../controllers/authController');
const queueController = require('../controllers/queueController');
const tokenController = require('../controllers/tokenController');
const dashboardController = require('../controllers/dashboardController');
const analyticsController = require('../controllers/analyticsController');

// Mock Express req/res generator
const mockReqRes = (body = {}, params = {}, manager = null) => {
  const req = {
    body,
    params,
    manager,
    cookies: {},
    headers: {},
  };
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
    clearCookie: (name) => {
      cookiesCleared[name] = true;
    },
  };

  const getResult = () => ({ statusCode, data: responseData, cookiesSet, cookiesCleared });

  return { req, res, getResult };
};

async function runTestSuite() {
  console.log('====================================================');
  console.log('🚀 RUNNING QUEUEFLOW COMPREHENSIVE END-TO-END TESTS');
  console.log('====================================================\n');

  await initDb();

  // Test 1: Manager Registration
  console.log('▶ Test 1: Manager Registration...');
  const testEmail = `dr.sharma_${Date.now()}@test.com`;
  const { req: regReq, res: regRes, getResult: getRegRes } = mockReqRes({
    full_name: 'Dr. Ramesh Sharma',
    email: testEmail,
    password: 'Password123!',
  });

  await authController.register(regReq, regRes, (err) => { throw err; });
  const regResult = getRegRes();
  assert.strictEqual(regResult.statusCode, 201, 'Registration should return 201');
  assert.ok(regResult.data.success, 'Registration success should be true');
  assert.ok(regResult.cookiesSet.token, 'HTTP-only cookie must be set');
  const manager = regResult.data.manager;
  console.log(`  ✓ Manager registered successfully: ID ${manager.id}, Email ${manager.email}`);

  // Test 2: Prevent Duplicate Email Registration
  console.log('▶ Test 2: Prevent Duplicate Registration...');
  const { req: dupReq, res: dupRes, getResult: getDupRes } = mockReqRes({
    full_name: 'Imposter',
    email: testEmail,
    password: 'Password123!',
  });
  await authController.register(dupReq, dupRes, (err) => { throw err; });
  const dupResult = getDupRes();
  assert.strictEqual(dupResult.statusCode, 409, 'Duplicate registration should return 409');
  console.log('  ✓ Duplicate email rejected with 409 Conflict.');

  // Test 3: Manager Login
  console.log('▶ Test 3: Manager Login...');
  const { req: loginReq, res: loginRes, getResult: getLoginRes } = mockReqRes({
    email: testEmail,
    password: 'Password123!',
  });
  await authController.login(loginReq, loginRes, (err) => { throw err; });
  const loginResult = getLoginRes();
  assert.strictEqual(loginResult.statusCode, 200, 'Login should return 200');
  assert.ok(loginResult.cookiesSet.token, 'Login must set auth cookie');
  console.log('  ✓ Manager authenticated successfully.');

  // Test 4: Queue Creation
  console.log('▶ Test 4: Create Queues...');
  const { req: q1Req, res: q1Res, getResult: getQ1Res } = mockReqRes(
    { name: 'General Consultation', prefix: 'DOC' },
    {},
    manager
  );
  await queueController.createQueue(q1Req, q1Res, (err) => { throw err; });
  const q1Result = getQ1Res();
  assert.strictEqual(q1Result.statusCode, 201);
  const queue1 = q1Result.data.queue;
  console.log(`  ✓ Queue created: "${queue1.name}" with prefix "${queue1.prefix}" (ID: ${queue1.id})`);

  // Test 5: Add Tokens (Rahul, Amit, Priya)
  console.log('▶ Test 5: Add Tokens to Queue (Rahul, Amit, Priya)...');
  const names = ['Rahul Verma', 'Amit Patel', 'Priya Singh'];
  const tokens = [];

  for (const name of names) {
    const { req: tokReq, res: tokRes, getResult: getTokRes } = mockReqRes(
      { person_name: name, phone_number: '+91 9876543210' },
      { id: queue1.id },
      manager
    );
    await tokenController.addToken(tokReq, tokRes, (err) => { throw err; });
    const tokResult = getTokRes();
    assert.strictEqual(tokResult.statusCode, 201);
    tokens.push(tokResult.data.token);
    console.log(`  ✓ Issued Token ${tokResult.data.token.token_number} for ${name} at Position ${tokResult.data.token.position}`);
  }

  assert.strictEqual(tokens[0].token_number, 'DOC001');
  assert.strictEqual(tokens[0].position, 1);
  assert.strictEqual(tokens[1].token_number, 'DOC002');
  assert.strictEqual(tokens[1].position, 2);
  assert.strictEqual(tokens[2].token_number, 'DOC003');
  assert.strictEqual(tokens[2].position, 3);

  // Test 6: Move Token Up (Amit moves from Pos 2 to Pos 1)
  console.log('▶ Test 6: Move Token Up (Swap Positions)...');
  const { req: upReq, res: upRes, getResult: getUpRes } = mockReqRes(
    {},
    { id: tokens[1].id },
    manager
  );
  await tokenController.moveTokenUp(upReq, upRes, (err) => { throw err; });
  const upResult = getUpRes();
  assert.strictEqual(upResult.statusCode, 200);
  console.log('  ✓ Token DOC002 moved up to Position 1.');

  // Test 7: Bound Check (Token at position 1 cannot move up)
  console.log('▶ Test 7: Verify Boundary Protection (Position 1 cannot move up)...');
  const { req: boundReq, res: boundRes, getResult: getBoundRes } = mockReqRes(
    {},
    { id: tokens[1].id },
    manager
  );
  await tokenController.moveTokenUp(boundReq, boundRes, (err) => { throw err; });
  const boundResult = getBoundRes();
  assert.strictEqual(boundResult.statusCode, 400);
  console.log(`  ✓ Boundary protected: "${boundResult.data.message}"`);

  // Move it back down
  const { req: downReq, res: downRes } = mockReqRes({}, { id: tokens[1].id }, manager);
  await tokenController.moveTokenDown(downReq, downRes, (err) => { throw err; });
  console.log('  ✓ Token moved back down to original order.');

  // Test 8: CALL NEXT TOKEN
  console.log('▶ Test 8: Call Next Token for Service...');
  const { req: callReq, res: callRes, getResult: getCallRes } = mockReqRes(
    {},
    { id: queue1.id },
    manager
  );
  await tokenController.callNextToken(callReq, callRes, (err) => { throw err; });
  const callResult = getCallRes();
  assert.strictEqual(callResult.statusCode, 200);
  const servingToken = callResult.data.token;
  assert.strictEqual(servingToken.status, 'SERVING');
  assert.strictEqual(servingToken.token_number, 'DOC001');
  console.log(`  ✓ Now serving Token ${servingToken.token_number} (${servingToken.person_name}).`);

  // Test 9: Enforce Single Serving Token Rule
  console.log('▶ Test 9: Enforce Single Serving Token Rule (Attempt concurrent Call Next)...');
  const { req: callFailReq, res: callFailRes, getResult: getCallFailRes } = mockReqRes(
    {},
    { id: queue1.id },
    manager
  );
  await tokenController.callNextToken(callFailReq, callFailRes, (err) => { throw err; });
  const callFailResult = getCallFailRes();
  assert.strictEqual(callFailResult.statusCode, 400);
  console.log(`  ✓ Call Next blocked while token is serving: "${callFailResult.data.message}"`);

  // Test 10: COMPLETE SERVICE
  console.log('▶ Test 10: Complete Service...');
  const { req: compReq, res: compRes, getResult: getCompRes } = mockReqRes(
    {},
    { id: servingToken.id },
    manager
  );
  await tokenController.completeService(compReq, compRes, (err) => { throw err; });
  const compResult = getCompRes();
  assert.strictEqual(compResult.statusCode, 200);
  assert.strictEqual(compResult.data.token.status, 'COMPLETED');
  console.log(`  ✓ Completed service for Token ${compResult.data.token.token_number}. Service duration calculated.`);

  // Test 11: Call Next Token after completion
  console.log('▶ Test 11: Call Next Token after completion...');
  const { req: call2Req, res: call2Res, getResult: getCall2Res } = mockReqRes(
    {},
    { id: queue1.id },
    manager
  );
  await tokenController.callNextToken(call2Req, call2Res, (err) => { throw err; });
  const call2Result = getCall2Res();
  assert.strictEqual(call2Result.statusCode, 200);
  const nextServing = call2Result.data.token;
  assert.strictEqual(nextServing.token_number, 'DOC002');
  console.log(`  ✓ Successfully called next Token ${nextServing.token_number} (${nextServing.person_name}).`);

  // Test 12: Cancel Waiting Token (Cancel DOC003)
  console.log('▶ Test 12: Cancel Waiting Token...');
  const { req: cancelReq, res: cancelRes, getResult: getCancelRes } = mockReqRes(
    {},
    { id: tokens[2].id },
    manager
  );
  await tokenController.cancelToken(cancelReq, cancelRes, (err) => { throw err; });
  const cancelResult = getCancelRes();
  assert.strictEqual(cancelResult.statusCode, 200);
  assert.strictEqual(cancelResult.data.token.status, 'CANCELLED');
  console.log(`  ✓ Token ${cancelResult.data.token.token_number} cancelled.`);

  // Test 13: Analytics Verification
  console.log('▶ Test 13: Verify Analytics & KPI Calculations...');
  const { req: anReq, res: anRes, getResult: getAnRes } = mockReqRes({}, {}, manager);
  await analyticsController.getAnalyticsOverview(anReq, anRes, (err) => { throw err; });
  const anResult = getAnRes();
  assert.strictEqual(anResult.statusCode, 200);
  const kpis = anResult.data.kpis;
  console.log(`  ✓ Total Tokens: ${kpis.totalTokens}`);
  console.log(`  ✓ Total Completed: ${kpis.totalCompleted}`);
  console.log(`  ✓ Total Cancelled: ${kpis.totalCancelled}`);
  console.log(`  ✓ Currently Serving: ${kpis.currentServing}`);
  console.log(`  ✓ Currently Waiting: ${kpis.currentWaiting}`);
  assert.strictEqual(kpis.totalTokens, 3);
  assert.strictEqual(kpis.totalCompleted, 1);
  assert.strictEqual(kpis.totalCancelled, 1);
  assert.strictEqual(kpis.currentServing, 1);
  assert.strictEqual(kpis.currentWaiting, 0);

  // Test 14: Ownership Isolation
  console.log('▶ Test 14: Manager Ownership Security...');
  const otherManager = { id: 99999, full_name: 'Other Manager', email: 'other@test.com' };
  const { req: ownReq, res: ownRes, getResult: getOwnRes } = mockReqRes(
    {},
    { id: queue1.id },
    otherManager
  );
  await queueController.getQueueById(ownReq, ownRes, (err) => { throw err; });
  const ownResult = getOwnRes();
  assert.strictEqual(ownResult.statusCode, 403, 'Unauthorized manager must be blocked with 403');
  console.log('  ✓ Resource ownership access control verified (403 Forbidden).');

  console.log('\n====================================================');
  console.log('🎉 ALL 14 TEST SUITES PASSED FLAWLESSLY!');
  console.log('====================================================\n');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
