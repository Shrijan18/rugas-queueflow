const { validationResult } = require('express-validator');
const db = require('../config/db');

// In-process lock map per queue to serialize concurrent mutations safely
const queueLocks = new Map();

const withQueueLock = async (queueId, fn) => {
  const qId = parseInt(queueId, 10);
  if (isNaN(qId)) return await fn();

  const currentPromise = queueLocks.get(qId) || Promise.resolve();
  let release;
  const nextPromise = new Promise((resolve) => {
    release = resolve;
  });
  queueLocks.set(qId, nextPromise);

  try {
    await currentPromise;
    return await fn();
  } finally {
    release();
    if (queueLocks.get(qId) === nextPromise) {
      queueLocks.delete(qId);
    }
  }
};

/**
 * Helper to verify that a queue belongs to the logged-in manager
 */
const verifyQueueOwnership = async (queueId, managerId) => {
  const result = await db.query(
    'SELECT id, name, prefix, manager_id FROM queues WHERE id = $1',
    [queueId]
  );
  if (result.rows.length === 0) return { error: 'Queue not found.', status: 404 };
  if (result.rows[0].manager_id !== managerId) {
    return { error: 'Access denied. You do not own this queue.', status: 403 };
  }
  return { queue: result.rows[0] };
};

/**
 * Calculate estimated waiting time in minutes for a given position
 * Uses average past service duration for this queue (defaulting to 5 minutes)
 */
const calculateEstimatedWaitMinutes = (position, avgServiceMinutes = 5) => {
  if (!position || position <= 1) return 0;
  return Math.round((position - 1) * avgServiceMinutes);
};

/**
 * Get all tokens for a queue
 * GET /api/queues/:id/tokens
 */
const getQueueTokens = async (req, res, next) => {
  try {
    const queueId = parseInt(req.params.id, 10);
    const managerId = req.manager.id;

    const { queue, error, status } = await verifyQueueOwnership(queueId, managerId);
    if (error) return res.status(status).json({ success: false, message: error });

    // Calculate queue's average service duration from completed tokens
    const avgDurationRes = await db.query(
      `SELECT service_started_at, completed_at
       FROM tokens
       WHERE queue_id = $1 AND status = 'COMPLETED' AND completed_at IS NOT NULL AND service_started_at IS NOT NULL`,
      [queueId]
    );

    let totalServiceDiff = 0;
    let completedCount = 0;
    for (const r of avgDurationRes.rows) {
      const start = new Date(r.service_started_at).getTime();
      const end = new Date(r.completed_at).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        totalServiceDiff += (end - start) / (1000 * 60);
        completedCount++;
      }
    }

    const avgMinutes = completedCount > 0 ? Math.max(1, Math.round(totalServiceDiff / completedCount)) : 5;

    // Fetch tokens sorted by status and position
    const tokensRes = await db.query(
      `SELECT 
        id,
        queue_id,
        token_number,
        person_name,
        phone_number,
        position,
        status,
        created_at,
        called_at,
        service_started_at,
        completed_at,
        cancelled_at
       FROM tokens
       WHERE queue_id = $1
       ORDER BY 
         CASE status
           WHEN 'SERVING' THEN 1
           WHEN 'WAITING' THEN 2
           WHEN 'COMPLETED' THEN 3
           WHEN 'CANCELLED' THEN 4
           ELSE 5
         END,
         position ASC NULLS LAST,
         created_at DESC`,
      [queueId]
    );

    // Annotate tokens with estimated wait time and calculated duration
    const tokens = tokensRes.rows.map((token) => {
      let estWait = null;
      let durationMinutes = null;

      if (token.status === 'WAITING' && token.position) {
        estWait = calculateEstimatedWaitMinutes(token.position, avgMinutes);
      }

      if (token.completed_at && token.service_started_at) {
        const start = new Date(token.service_started_at).getTime();
        const end = new Date(token.completed_at).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          durationMinutes = Math.round((end - start) / (1000 * 60));
        }
      }

      return {
        ...token,
        estimated_waiting_minutes: estWait,
        service_duration_minutes: durationMinutes,
      };
    });

    const waitingTokens = tokens.filter((t) => t.status === 'WAITING');
    const servingToken = tokens.find((t) => t.status === 'SERVING') || null;
    const completedTokens = tokens.filter((t) => t.status === 'COMPLETED');
    const cancelledTokens = tokens.filter((t) => t.status === 'CANCELLED');

    return res.json({
      success: true,
      queue,
      tokens,
      waitingTokens,
      servingToken,
      completedTokens,
      cancelledTokens,
      avgServiceMinutes: avgMinutes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add a person to the queue (generates token)
 * POST /api/queues/:id/tokens
 */
const addToken = async (req, res, next) => {
  const queueId = parseInt(req.params.id, 10);
  return withQueueLock(queueId, async () => {
    const client = await db.getClient();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        client.release();
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
        });
      }

      const managerId = req.manager.id;
      const { person_name, phone_number } = req.body;

      // Verify queue ownership
      const { queue, error, status } = await verifyQueueOwnership(queueId, managerId);
      if (error) {
        client.release();
        return res.status(status).json({ success: false, message: error });
      }

      await client.query('BEGIN');

      // Queue-level row lock to serialize concurrent additions and token operations
      await client.query('SELECT id FROM queues WHERE id = $1 FOR UPDATE', [queueId]);

      // 1. Determine next waiting position
      const posRes = await client.query(
        `SELECT COALESCE(MAX(position), 0) AS max_pos 
         FROM tokens 
         WHERE queue_id = $1 AND status = 'WAITING'`,
        [queueId]
      );
      const nextPosition = parseInt(posRes.rows[0].max_pos, 10) + 1;

      // 2. Generate unique token number (e.g., Q001, Q002...)
      // Inspect all existing tokens ever created in this queue to ensure token numbers are NEVER reused
      const existingTokensRes = await client.query(
        'SELECT token_number FROM tokens WHERE queue_id = $1',
        [queueId]
      );

      let maxNum = 0;
      for (const r of existingTokensRes.rows) {
        const digits = (r.token_number || '').replace(/\D/g, '');
        const parsed = parseInt(digits, 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }

      let tokenSeq = maxNum + 1;
      let tokenNumber = `${queue.prefix || 'Q'}${String(tokenSeq).padStart(3, '0')}`;

      // Ensure absolute token number uniqueness in this queue
      let exists = await client.query(
        'SELECT id FROM tokens WHERE queue_id = $1 AND token_number = $2',
        [queueId, tokenNumber]
      );
      while (exists.rows.length > 0) {
        tokenSeq += 1;
        tokenNumber = `${queue.prefix || 'Q'}${String(tokenSeq).padStart(3, '0')}`;
        exists = await client.query(
          'SELECT id FROM tokens WHERE queue_id = $1 AND token_number = $2',
          [queueId, tokenNumber]
        );
      }

      // 3. Insert new token
      const insertRes = await client.query(
        `INSERT INTO tokens (
          queue_id, token_number, person_name, phone_number, position, status
        )
        VALUES ($1, $2, $3, $4, $5, 'WAITING')
        RETURNING *`,
        [queueId, tokenNumber, person_name.trim(), phone_number?.trim() || null, nextPosition]
      );

      const newToken = insertRes.rows[0];

      // 4. Log queue activity
      await client.query(
        `INSERT INTO queue_activity (queue_id, token_id, activity_type, details)
         VALUES ($1, $2, $3, $4)`,
        [
          queueId,
          newToken.id,
          'TOKEN_CREATED',
          `Token ${tokenNumber} added for ${person_name.trim()} at position ${nextPosition}`,
        ]
      );

      // 5. Update queue snapshot
      const waitingCountRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM tokens WHERE queue_id = $1 AND status = 'WAITING'`,
        [queueId]
      );
      await client.query(
        `INSERT INTO queue_snapshots (queue_id, waiting_count, serving_count)
         VALUES ($1, $2, (SELECT COUNT(*)::int FROM tokens WHERE queue_id = $1 AND status = 'SERVING'))`,
        [queueId, waitingCountRes.rows[0].cnt]
      );

      await client.query('COMMIT');
      client.release();

      return res.status(201).json({
        success: true,
        message: `Token ${tokenNumber} created successfully for ${person_name.trim()}.`,
        token: {
          ...newToken,
          estimated_waiting_minutes: calculateEstimatedWaitMinutes(nextPosition),
        },
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      client.release();
      next(err);
    }
  });
};

/**
 * Move a waiting token UP (swap with predecessor position - 1)
 * PUT /api/tokens/:id/move-up
 */
const moveTokenUp = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const tokenId = parseInt(req.params.id, 10);
    const managerId = req.manager.id;

    await client.query('BEGIN');

    // Fetch token with queue info
    const tokenRes = await client.query(
      `SELECT t.*, q.manager_id, q.name AS queue_name 
       FROM tokens t
       JOIN queues q ON t.queue_id = q.id
       WHERE t.id = $1`,
      [tokenId]
    );

    if (tokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Token not found.' });
    }

    const currentToken = tokenRes.rows[0];

    if (currentToken.manager_id !== managerId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Lock the queue row to serialize reordering operations
    await client.query('SELECT id FROM queues WHERE id = $1 FOR UPDATE', [currentToken.queue_id]);

    if (currentToken.status !== 'WAITING') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Only tokens with status WAITING can be moved.',
      });
    }

    if (currentToken.position <= 1) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'This token is already at the first position in the waiting queue.',
      });
    }

    const currentPos = currentToken.position;
    const targetPos = currentPos - 1;

    // Find previous waiting token
    const prevTokenRes = await client.query(
      `SELECT id, token_number, position 
       FROM tokens 
       WHERE queue_id = $1 AND status = 'WAITING' AND position = $2`,
      [currentToken.queue_id, targetPos]
    );

    if (prevTokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Preceding waiting token not found. Please refresh the queue.',
      });
    }

    const prevToken = prevTokenRes.rows[0];

    // Atomically swap positions
    await client.query('UPDATE tokens SET position = -999 WHERE id = $1', [currentToken.id]);
    await client.query('UPDATE tokens SET position = $1 WHERE id = $2', [currentPos, prevToken.id]);
    await client.query('UPDATE tokens SET position = $1 WHERE id = $2', [targetPos, currentToken.id]);

    // Log activity
    await client.query(
      `INSERT INTO queue_activity (queue_id, token_id, activity_type, details)
       VALUES ($1, $2, $3, $4)`,
      [
        currentToken.queue_id,
        currentToken.id,
        'TOKEN_MOVED_UP',
        `Token ${currentToken.token_number} moved up from position ${currentPos} to ${targetPos}`,
      ]
    );

    await client.query('COMMIT');
    client.release();

    return res.json({
      success: true,
      message: `Token ${currentToken.token_number} moved up to position ${targetPos}.`,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    client.release();
    next(err);
  }
};

/**
 * Move a waiting token DOWN (swap with successor position + 1)
 * PUT /api/tokens/:id/move-down
 */
const moveTokenDown = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const tokenId = parseInt(req.params.id, 10);
    const managerId = req.manager.id;

    await client.query('BEGIN');

    // Fetch token with queue info
    const tokenRes = await client.query(
      `SELECT t.*, q.manager_id 
       FROM tokens t
       JOIN queues q ON t.queue_id = q.id
       WHERE t.id = $1`,
      [tokenId]
    );

    if (tokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Token not found.' });
    }

    const currentToken = tokenRes.rows[0];

    if (currentToken.manager_id !== managerId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Lock the queue row to serialize reordering operations
    await client.query('SELECT id FROM queues WHERE id = $1 FOR UPDATE', [currentToken.queue_id]);

    if (currentToken.status !== 'WAITING') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Only tokens with status WAITING can be moved.',
      });
    }

    const currentPos = currentToken.position;

    // Find max position
    const maxRes = await client.query(
      `SELECT MAX(position) AS max_pos 
       FROM tokens 
       WHERE queue_id = $1 AND status = 'WAITING'`,
      [currentToken.queue_id]
    );

    const maxPos = parseInt(maxRes.rows[0].max_pos, 10);

    if (currentPos >= maxPos) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'This token is already at the last position in the waiting queue.',
      });
    }

    const targetPos = currentPos + 1;

    // Find next waiting token
    const nextTokenRes = await client.query(
      `SELECT id, token_number, position 
       FROM tokens 
       WHERE queue_id = $1 AND status = 'WAITING' AND position = $2`,
      [currentToken.queue_id, targetPos]
    );

    if (nextTokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Subsequent waiting token not found. Please refresh the queue.',
      });
    }

    const nextToken = nextTokenRes.rows[0];

    // Atomically swap positions
    await client.query('UPDATE tokens SET position = -999 WHERE id = $1', [currentToken.id]);
    await client.query('UPDATE tokens SET position = $1 WHERE id = $2', [currentPos, nextToken.id]);
    await client.query('UPDATE tokens SET position = $1 WHERE id = $2', [targetPos, currentToken.id]);

    // Log activity
    await client.query(
      `INSERT INTO queue_activity (queue_id, token_id, activity_type, details)
       VALUES ($1, $2, $3, $4)`,
      [
        currentToken.queue_id,
        currentToken.id,
        'TOKEN_MOVED_DOWN',
        `Token ${currentToken.token_number} moved down from position ${currentPos} to ${targetPos}`,
      ]
    );

    await client.query('COMMIT');
    client.release();

    return res.json({
      success: true,
      message: `Token ${currentToken.token_number} moved down to position ${targetPos}.`,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    client.release();
    next(err);
  }
};

/**
 * Call the next waiting token for service
 * Strictly allows only ONE token in SERVING state per queue
 * PUT /api/queues/:id/call-next
 */
const callNextToken = async (req, res, next) => {
  const queueId = parseInt(req.params.id, 10);
  return withQueueLock(queueId, async () => {
    const client = await db.getClient();
    try {
      const managerId = req.manager.id;

      // Verify ownership
      const { queue, error, status } = await verifyQueueOwnership(queueId, managerId);
      if (error) {
        client.release();
        return res.status(status).json({ success: false, message: error });
      }

      await client.query('BEGIN');

      // Row-level lock on the queue to strictly prevent concurrent calls
      await client.query('SELECT id FROM queues WHERE id = $1 FOR UPDATE', [queueId]);

      // 1. Check if there is already an active SERVING token in this queue
      const activeServing = await client.query(
        `SELECT id, token_number, person_name, service_started_at 
         FROM tokens 
         WHERE queue_id = $1 AND status = 'SERVING'`,
        [queueId]
      );

      if (activeServing.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        const current = activeServing.rows[0];
        return res.status(400).json({
          success: false,
          message: `Cannot call next token: Token ${current.token_number} (${current.person_name}) is currently being served. Complete or cancel this service first.`,
          currentServing: current,
        });
      }

      // 2. Select first waiting token by position
      const firstWaiting = await client.query(
        `SELECT * FROM tokens 
         WHERE queue_id = $1 AND status = 'WAITING' 
         ORDER BY position ASC 
         LIMIT 1`,
        [queueId]
      );

      if (firstWaiting.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          message: 'No waiting tokens available in this queue.',
        });
      }

      const tokenToServe = firstWaiting.rows[0];

      // 3. Mark token as SERVING
      const updateRes = await client.query(
        `UPDATE tokens 
         SET status = 'SERVING',
             called_at = CURRENT_TIMESTAMP,
             service_started_at = CURRENT_TIMESTAMP,
             position = NULL
         WHERE id = $1
         RETURNING *`,
        [tokenToServe.id]
      );

      const servingToken = updateRes.rows[0];

      // 4. Shift positions of all subsequent waiting tokens: position = position - 1
      await client.query(
        `UPDATE tokens 
         SET position = position - 1 
         WHERE queue_id = $1 AND status = 'WAITING'`,
        [queueId]
      );

      // 5. Log activity
      await client.query(
        `INSERT INTO queue_activity (queue_id, token_id, activity_type, details)
         VALUES ($1, $2, $3, $4)`,
        [
          queueId,
          servingToken.id,
          'TOKEN_CALLED',
          `Called Token ${servingToken.token_number} (${servingToken.person_name}) for service.`,
        ]
      );

      // 6. Record snapshot
      const waitingCountRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM tokens WHERE queue_id = $1 AND status = 'WAITING'`,
        [queueId]
      );
      await client.query(
        `INSERT INTO queue_snapshots (queue_id, waiting_count, serving_count)
         VALUES ($1, $2, 1)`,
        [queueId, waitingCountRes.rows[0].cnt]
      );

      await client.query('COMMIT');
      client.release();

      return res.json({
        success: true,
        message: `Now serving Token ${servingToken.token_number} - ${servingToken.person_name}.`,
        token: servingToken,
      });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      client.release();
      next(err);
    }
  });
};

/**
 * Complete service for the currently serving token
 * PUT /api/tokens/:id/complete
 */
const completeService = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const tokenId = parseInt(req.params.id, 10);
    const managerId = req.manager.id;

    await client.query('BEGIN');

    // Fetch token
    const tokenRes = await client.query(
      `SELECT t.*, q.manager_id, q.name AS queue_name 
       FROM tokens t
       JOIN queues q ON t.queue_id = q.id
       WHERE t.id = $1`,
      [tokenId]
    );

    if (tokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Token not found.' });
    }

    const token = tokenRes.rows[0];

    if (token.manager_id !== managerId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Lock the queue row
    await client.query('SELECT id FROM queues WHERE id = $1 FOR UPDATE', [token.queue_id]);

    if (token.status !== 'SERVING') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: `Token status is "${token.status}". Only SERVING tokens can be completed.`,
      });
    }

    // Mark as COMPLETED
    const completeRes = await client.query(
      `UPDATE tokens 
       SET status = 'COMPLETED',
           completed_at = CURRENT_TIMESTAMP,
           position = NULL
       WHERE id = $1
       RETURNING *`,
      [token.id]
    );

    const completedToken = completeRes.rows[0];

    // Calculate duration in seconds & minutes
    const startTime = new Date(completedToken.service_started_at || completedToken.called_at || completedToken.created_at);
    const endTime = new Date(completedToken.completed_at);
    const durationSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));
    const durationMinutes = Math.round(durationSeconds / 60);

    // Log activity
    await client.query(
      `INSERT INTO queue_activity (queue_id, token_id, activity_type, details)
       VALUES ($1, $2, $3, $4)`,
      [
        token.queue_id,
        token.id,
        'SERVICE_COMPLETED',
        `Completed service for Token ${token.token_number} (${token.person_name}). Duration: ${durationMinutes} min.`,
      ]
    );

    // Record snapshot
    const waitingCountRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM tokens WHERE queue_id = $1 AND status = 'WAITING'`,
      [token.queue_id]
    );
    await client.query(
      `INSERT INTO queue_snapshots (queue_id, waiting_count, serving_count)
       VALUES ($1, $2, 0)`,
      [token.queue_id, waitingCountRes.rows[0].cnt]
    );

    await client.query('COMMIT');
    client.release();

    return res.json({
      success: true,
      message: `Service completed for Token ${token.token_number}.`,
      token: {
        ...completedToken,
        durationSeconds,
        durationMinutes,
      },
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    client.release();
    next(err);
  }
};

/**
 * Cancel a waiting or serving token
 * PUT /api/tokens/:id/cancel
 */
const cancelToken = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const tokenId = parseInt(req.params.id, 10);
    const managerId = req.manager.id;

    await client.query('BEGIN');

    // Fetch token
    const tokenRes = await client.query(
      `SELECT t.*, q.manager_id, q.name AS queue_name 
       FROM tokens t
       JOIN queues q ON t.queue_id = q.id
       WHERE t.id = $1`,
      [tokenId]
    );

    if (tokenRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Token not found.' });
    }

    const token = tokenRes.rows[0];

    if (token.manager_id !== managerId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Lock the queue row to serialize cancellation and position re-indexing
    await client.query('SELECT id FROM queues WHERE id = $1 FOR UPDATE', [token.queue_id]);

    // Strictly enforce: Only WAITING tokens can be cancelled (cannot cancel SERVING or COMPLETED tokens)
    if (token.status !== 'WAITING') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: `Token status is "${token.status}". Only tokens in WAITING status can be cancelled.`,
      });
    }

    const previousPosition = token.position;

    // Mark as CANCELLED
    const updateRes = await client.query(
      `UPDATE tokens 
       SET status = 'CANCELLED',
           cancelled_at = CURRENT_TIMESTAMP,
           position = NULL
       WHERE id = $1
       RETURNING *`,
      [token.id]
    );

    const cancelledToken = updateRes.rows[0];

    // If it was WAITING, shift all tokens after this position down by 1
    if (token.status === 'WAITING' && previousPosition !== null) {
      await client.query(
        `UPDATE tokens 
         SET position = position - 1 
         WHERE queue_id = $1 AND status = 'WAITING' AND position > $2`,
        [token.queue_id, previousPosition]
      );
    }

    // Log activity
    await client.query(
      `INSERT INTO queue_activity (queue_id, token_id, activity_type, details)
       VALUES ($1, $2, $3, $4)`,
      [
        token.queue_id,
        token.id,
        'TOKEN_CANCELLED',
        `Token ${token.token_number} (${token.person_name}) was cancelled.`,
      ]
    );

    // Snapshot update
    const waitingCountRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM tokens WHERE queue_id = $1 AND status = 'WAITING'`,
      [token.queue_id]
    );
    const servingCountRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM tokens WHERE queue_id = $1 AND status = 'SERVING'`,
      [token.queue_id]
    );
    await client.query(
      `INSERT INTO queue_snapshots (queue_id, waiting_count, serving_count)
       VALUES ($1, $2, $3)`,
      [token.queue_id, waitingCountRes.rows[0].cnt, servingCountRes.rows[0].cnt]
    );

    await client.query('COMMIT');
    client.release();

    return res.json({
      success: true,
      message: `Token ${token.token_number} has been cancelled.`,
      token: cancelledToken,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    client.release();
    next(err);
  }
};

module.exports = {
  getQueueTokens,
  addToken,
  moveTokenUp,
  moveTokenDown,
  callNextToken,
  completeService,
  cancelToken,
};
