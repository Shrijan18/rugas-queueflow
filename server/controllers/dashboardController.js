const db = require('../config/db');

/**
 * Get dashboard overview KPI statistics for the logged-in manager
 * GET /api/dashboard/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    // Aggregate statistics scoped strictly to this manager's queues
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT q.id)::int AS total_queues,
        COUNT(t.id)::int AS total_tokens,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int AS total_waiting,
        COUNT(CASE WHEN t.status = 'SERVING' THEN 1 END)::int AS total_serving,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int AS total_completed,
        COUNT(CASE WHEN t.status = 'CANCELLED' THEN 1 END)::int AS total_cancelled
      FROM queues q
      LEFT JOIN tokens t ON q.id = t.queue_id
      WHERE q.manager_id = $1
    `;

    const statsRes = await db.query(statsQuery, [managerId]);
    const stats = statsRes.rows[0] || {
      total_queues: 0,
      total_tokens: 0,
      total_waiting: 0,
      total_serving: 0,
      total_completed: 0,
      total_cancelled: 0,
    };

    // Queues overview with per-queue stats
    const queuesQuery = `
      SELECT 
        q.id,
        q.name,
        q.prefix,
        q.created_at,
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

    const queuesRes = await db.query(queuesQuery, [managerId]);

    return res.json({
      success: true,
      stats,
      queues: queuesRes.rows,
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

