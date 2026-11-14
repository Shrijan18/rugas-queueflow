const { validationResult } = require('express-validator');
const db = require('../config/db');

/**
 * Get all queues for the logged-in manager
 * Includes real-time counts of waiting, serving, completed, cancelled tokens
 * GET /api/queues
 */
const getQueues = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    // 1. Fetch queues owned by this manager
    const queuesRes = await db.query(
      `SELECT id, manager_id, name, prefix, created_at, updated_at
       FROM queues
       WHERE manager_id = $1
       ORDER BY created_at DESC`,
      [managerId]
    );

    // 2. Fetch all tokens across this manager's queues
    const tokensRes = await db.query(
      `SELECT t.id, t.queue_id, t.token_number, t.person_name, t.status, t.service_started_at
       FROM tokens t
       JOIN queues q ON t.queue_id = q.id
       WHERE q.manager_id = $1`,
      [managerId]
    );

    const queues = queuesRes.rows.map((q) => {
      const qTokens = tokensRes.rows.filter((t) => t.queue_id === q.id);
      const waiting = qTokens.filter((t) => t.status === 'WAITING').length;
      const serving = qTokens.find((t) => t.status === 'SERVING') || null;
      const completed = qTokens.filter((t) => t.status === 'COMPLETED').length;
      const cancelled = qTokens.filter((t) => t.status === 'CANCELLED').length;

      return {
        ...q,
        total_tokens: qTokens.length,
        waiting_count: waiting,
        serving_count: serving ? 1 : 0,
        completed_count: completed,
        cancelled_count: cancelled,
        current_serving: serving
          ? {
              id: serving.id,
              token_number: serving.token_number,
              person_name: serving.person_name,
              service_started_at: serving.service_started_at,
            }
          : null,
      };
    });

    return res.json({
      success: true,
      queues,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new queue
 * POST /api/queues
 */
const createQueue = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
      });
    }

    const managerId = req.manager.id;
    const { name, prefix } = req.body;
    const cleanName = name.trim();

    // Prevent duplicate queue names for the same manager (case-insensitive)
    const duplicateCheck = await db.query(
      'SELECT id FROM queues WHERE manager_id = $1 AND LOWER(name) = $2',
      [managerId, cleanName.toLowerCase()]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `You already have an active queue named "${cleanName}". Please use a different name.`,
      });
    }

    // Default prefix to first letter uppercase or 'Q'
    const queuePrefix = (prefix || cleanName.charAt(0) || 'Q').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'Q';

    const insertResult = await db.query(
      `INSERT INTO queues (manager_id, name, prefix)
       VALUES ($1, $2, $3)
       RETURNING id, manager_id, name, prefix, created_at, updated_at`,
      [managerId, cleanName, queuePrefix]
    );

    const newQueue = insertResult.rows[0];

    // Log activity
    await db.query(
      `INSERT INTO queue_activity (queue_id, activity_type, details)
       VALUES ($1, $2, $3)`,
      [newQueue.id, 'QUEUE_CREATED', `Queue "${cleanName}" was created.`]
    );

    // Initial snapshot
    await db.query(
      `INSERT INTO queue_snapshots (queue_id, waiting_count, serving_count)
       VALUES ($1, 0, 0)`,
      [newQueue.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Queue created successfully.',
      queue: {
        ...newQueue,
        total_tokens: 0,
        waiting_count: 0,
        serving_count: 0,
        completed_count: 0,
        cancelled_count: 0,
        current_serving: null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single queue details by ID
 * Validates ownership
 * GET /api/queues/:id
 */
const getQueueById = async (req, res, next) => {
  try {
    const queueId = parseInt(req.params.id, 10);
    const managerId = req.manager.id;

    if (isNaN(queueId)) {
      return res.status(400).json({ success: false, message: 'Invalid queue ID.' });
    }

    const queueRes = await db.query(
      `SELECT id, manager_id, name, prefix, created_at, updated_at
       FROM queues
       WHERE id = $1`,
      [queueId]
    );

    if (queueRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Queue not found.' });
    }

    const queue = queueRes.rows[0];

    // Ownership check
    if (queue.manager_id !== managerId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this queue.',
      });
    }

    // Fetch tokens for this queue
    const tokensRes = await db.query(
      `SELECT id, token_number, person_name, status, service_started_at
       FROM tokens
       WHERE queue_id = $1`,
      [queueId]
    );

    const qTokens = tokensRes.rows;
    const waiting = qTokens.filter((t) => t.status === 'WAITING').length;
    const serving = qTokens.find((t) => t.status === 'SERVING') || null;
    const completed = qTokens.filter((t) => t.status === 'COMPLETED').length;
    const cancelled = qTokens.filter((t) => t.status === 'CANCELLED').length;

    queue.total_tokens = qTokens.length;
    queue.waiting_count = waiting;
    queue.serving_count = serving ? 1 : 0;
    queue.completed_count = completed;
    queue.cancelled_count = cancelled;
    queue.current_serving = serving;

    return res.json({
      success: true,
      queue,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Rename a queue
 * PUT /api/queues/:id
 */
const updateQueue = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
      });
    }

    const queueId = parseInt(req.params.id, 10);
    const managerId = req.manager.id;
    const { name } = req.body;

    // Verify ownership
    const check = await db.query('SELECT manager_id, name FROM queues WHERE id = $1', [queueId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Queue not found.' });
    }
    if (check.rows[0].manager_id !== managerId) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not own this queue.' });
    }

    const oldName = check.rows[0].name;
    const cleanName = name.trim();

    // Prevent duplicate queue name for this manager (case-insensitive, excluding current queue)
    const duplicateCheck = await db.query(
      'SELECT id FROM queues WHERE manager_id = $1 AND LOWER(name) = $2 AND id != $3',
      [managerId, cleanName.toLowerCase(), queueId]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `You already have an active queue named "${cleanName}". Please choose a different name.`,
      });
    }

    const updated = await db.query(
      `UPDATE queues 
       SET name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, manager_id, name, prefix, created_at, updated_at`,
      [cleanName, queueId]
    );

    // Log activity
    await db.query(
      `INSERT INTO queue_activity (queue_id, activity_type, details)
       VALUES ($1, $2, $3)`,
      [queueId, 'QUEUE_RENAMED', `Queue renamed from "${oldName}" to "${cleanName}".`]
    );

    return res.json({
      success: true,
      message: 'Queue renamed successfully.',
      queue: updated.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a queue with all its tokens, activity, snapshots
 * DELETE /api/queues/:id
 */
const deleteQueue = async (req, res, next) => {
  try {
    const queueId = parseInt(req.params.id, 10);
    const managerId = req.manager.id;

    // Verify ownership
    const check = await db.query('SELECT manager_id, name FROM queues WHERE id = $1', [queueId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Queue not found.' });
    }
    if (check.rows[0].manager_id !== managerId) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not own this queue.' });
    }

    await db.query('DELETE FROM queues WHERE id = $1', [queueId]);

    return res.json({
      success: true,
      message: `Queue "${check.rows[0].name}" and all associated data have been deleted.`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getQueues,
  createQueue,
  getQueueById,
  updateQueue,
  deleteQueue,
};
