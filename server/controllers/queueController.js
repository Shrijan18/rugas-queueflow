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

    // Fetch queues along with aggregated token metrics
    const query = `
      SELECT 
        q.id,
        q.name,
        q.prefix,
        q.created_at,
        q.updated_at,
        COUNT(t.id)::int AS total_tokens,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int AS waiting_count,
        COUNT(CASE WHEN t.status = 'SERVING' THEN 1 END)::int AS serving_count,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN t.status = 'CANCELLED' THEN 1 END)::int AS cancelled_count,
        (
          SELECT json_build_object(
            'id', st.id,
            'token_number', st.token_number,
            'person_name', st.person_name,
            'service_started_at', st.service_started_at
          )
          FROM tokens st
          WHERE st.queue_id = q.id AND st.status = 'SERVING'
          LIMIT 1
        ) AS current_serving
      FROM queues q
      LEFT JOIN tokens t ON q.id = t.queue_id
      WHERE q.manager_id = $1
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;

    const result = await db.query(query, [managerId]);

    return res.json({
      success: true,
      queues: result.rows,
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

    const query = `
      SELECT 
        q.id,
        q.manager_id,
        q.name,
        q.prefix,
        q.created_at,
        q.updated_at,
        COUNT(t.id)::int AS total_tokens,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int AS waiting_count,
        COUNT(CASE WHEN t.status = 'SERVING' THEN 1 END)::int AS serving_count,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN t.status = 'CANCELLED' THEN 1 END)::int AS cancelled_count
      FROM queues q
      LEFT JOIN tokens t ON q.id = t.queue_id
      WHERE q.id = $1
      GROUP BY q.id
    `;

    const result = await db.query(query, [queueId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Queue not found.' });
    }

    const queue = result.rows[0];

    // Ownership check
    if (queue.manager_id !== managerId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this queue.',
      });
    }

    // Fetch currently serving token if present
    const servingRes = await db.query(
      `SELECT * FROM tokens WHERE queue_id = $1 AND status = 'SERVING' LIMIT 1`,
      [queueId]
    );

    queue.current_serving = servingRes.rows[0] || null;

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
    const updated = await db.query(
      `UPDATE queues 
       SET name = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, manager_id, name, prefix, created_at, updated_at`,
      [name.trim(), queueId]
    );

    // Log activity
    await db.query(
      `INSERT INTO queue_activity (queue_id, activity_type, details)
       VALUES ($1, $2, $3)`,
      [queueId, 'QUEUE_RENAMED', `Queue renamed from "${oldName}" to "${name.trim()}".`]
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

