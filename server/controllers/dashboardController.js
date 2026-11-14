const db = require('../config/db');

/**
 * Get dashboard overview KPI statistics for the logged-in manager
 * GET /api/dashboard/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    // 1. Fetch queues owned by this manager
    const queuesRes = await db.query(
      `SELECT id, name, prefix, created_at, updated_at
       FROM queues
       WHERE manager_id = $1
       ORDER BY created_at DESC`,
      [managerId]
    );

    // 2. Fetch all tokens for this manager's queues
    const tokensRes = await db.query(
      `SELECT t.id, t.queue_id, t.token_number, t.person_name, t.status, t.service_started_at
       FROM tokens t
       JOIN queues q ON t.queue_id = q.id
       WHERE q.manager_id = $1`,
      [managerId]
    );

    const allTokens = tokensRes.rows;

    const stats = {
      total_queues: queuesRes.rows.length,
      total_tokens: allTokens.length,
      total_waiting: allTokens.filter((t) => t.status === 'WAITING').length,
      total_serving: allTokens.filter((t) => t.status === 'SERVING').length,
      total_completed: allTokens.filter((t) => t.status === 'COMPLETED').length,
      total_cancelled: allTokens.filter((t) => t.status === 'CANCELLED').length,
    };

    // Queues overview with per-queue stats
    const queues = queuesRes.rows.map((q) => {
      const qTokens = allTokens.filter((t) => t.queue_id === q.id);
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
      stats,
      queues,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get recent activity feed across manager's queues
 * GET /api/dashboard/recent-activity
 */
const getRecentActivity = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    const query = `
      SELECT 
        qa.id,
        qa.queue_id,
        q.name AS queue_name,
        qa.token_id,
        t.token_number,
        qa.activity_type,
        qa.details,
        qa.created_at
      FROM queue_activity qa
      JOIN queues q ON qa.queue_id = q.id
      LEFT JOIN tokens t ON qa.token_id = t.id
      WHERE q.manager_id = $1
      ORDER BY qa.created_at DESC
      LIMIT 15
    `;

    const result = await db.query(query, [managerId]);

    return res.json({
      success: true,
      activities: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  getRecentActivity,
};
