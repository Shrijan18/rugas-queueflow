const db = require('../config/db');

/**
 * Get high-level analytics overview & KPIs
 * GET /api/analytics/overview
 */
const getAnalyticsOverview = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    // 1. Overall Token Counts
    const countsRes = await db.query(
      `SELECT 
        COUNT(t.id)::int AS total_tokens,
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int AS current_waiting,
        COUNT(CASE WHEN t.status = 'SERVING' THEN 1 END)::int AS current_serving,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int AS total_completed,
        COUNT(CASE WHEN t.status = 'CANCELLED' THEN 1 END)::int AS total_cancelled
       FROM queues q
       LEFT JOIN tokens t ON q.id = t.queue_id
       WHERE q.manager_id = $1`,
      [managerId]
    );

    const counts = countsRes.rows[0] || {};

    // 2. Average Waiting Time: Service Start Time - Token Creation Time for COMPLETED service records
    const waitTokensRes = await db.query(
      `SELECT t.created_at, t.service_started_at, t.called_at
       FROM queues q
       JOIN tokens t ON q.id = t.queue_id
       WHERE q.manager_id = $1 
         AND t.status = 'COMPLETED'
         AND (t.service_started_at IS NOT NULL OR t.called_at IS NOT NULL)
         AND t.created_at IS NOT NULL`,
      [managerId]
    );

    let totalWaitMinutes = 0;
    let waitSampleCount = 0;
    for (const row of waitTokensRes.rows) {
      const start = new Date(row.created_at).getTime();
      const called = new Date(row.service_started_at || row.called_at).getTime();
      if (!isNaN(start) && !isNaN(called) && called >= start) {
        totalWaitMinutes += (called - start) / (1000 * 60);
        waitSampleCount++;
      }
    }
    const avgWaitingMinutes = waitSampleCount > 0 ? Math.round((totalWaitMinutes / waitSampleCount) * 10) / 10 : 0;

    // 3. Average Service Duration: Completion Time - Service Start Time for COMPLETED service records
    const completedTokensRes = await db.query(
      `SELECT t.service_started_at, t.called_at, t.completed_at
       FROM queues q
       JOIN tokens t ON q.id = t.queue_id
       WHERE q.manager_id = $1 
         AND t.status = 'COMPLETED'
         AND t.completed_at IS NOT NULL
         AND (t.service_started_at IS NOT NULL OR t.called_at IS NOT NULL)`,
      [managerId]
    );

    let totalServiceMinutes = 0;
    let serviceSampleCount = 0;
    for (const row of completedTokensRes.rows) {
      const start = new Date(row.service_started_at || row.called_at).getTime();
      const end = new Date(row.completed_at).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        totalServiceMinutes += (end - start) / (1000 * 60);
        serviceSampleCount++;
      }
    }
    const avgServiceMinutes = serviceSampleCount > 0 ? Math.round((totalServiceMinutes / serviceSampleCount) * 10) / 10 : 0;

    // 4. Additional Insights:
    // a. Queue with highest waiting count
    const highestWaitQueueRes = await db.query(
      `SELECT q.id, q.name, COUNT(t.id)::int AS waiting_count
       FROM queues q
       LEFT JOIN tokens t ON q.id = t.queue_id AND t.status = 'WAITING'
       WHERE q.manager_id = $1
       GROUP BY q.id, q.name
       ORDER BY waiting_count DESC
       LIMIT 1`,
      [managerId]
    );
    const busiestQueue = highestWaitQueueRes.rows[0] || null;

    // b. Longest current waiting token
    const waitingListRes = await db.query(
      `SELECT 
        t.token_number,
        t.person_name,
        t.created_at,
        q.name AS queue_name
       FROM queues q
       JOIN tokens t ON q.id = t.queue_id
       WHERE q.manager_id = $1 AND t.status = 'WAITING'
       ORDER BY t.created_at ASC
       LIMIT 1`,
      [managerId]
    );
    
    let longestWaitingToken = null;
    if (waitingListRes.rows.length > 0) {
      const row = waitingListRes.rows[0];
      const waitMins = Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60)));
      longestWaitingToken = {
        token_number: row.token_number,
        person_name: row.person_name,
        queue_name: row.queue_name,
        waiting_minutes: waitMins,
      };
    }

    // c. Total services completed today
    const completedAllRes = await db.query(
      `SELECT t.completed_at
       FROM queues q
       JOIN tokens t ON q.id = t.queue_id
       WHERE q.manager_id = $1 
         AND t.status = 'COMPLETED'
         AND t.completed_at IS NOT NULL`,
      [managerId]
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const completedToday = completedAllRes.rows.filter((r) => {
      const d = new Date(r.completed_at).toISOString().slice(0, 10);
      return d === todayStr;
    }).length;

    return res.json({
      success: true,
      kpis: {
        totalTokens: counts.total_tokens || 0,
        currentWaiting: counts.current_waiting || 0,
        currentServing: counts.current_serving || 0,
        totalCompleted: counts.total_completed || 0,
        totalCancelled: counts.total_cancelled || 0,
        avgWaitingMinutes,
        avgServiceMinutes,
      },
      insights: {
        busiestQueue,
        longestWaitingToken,
        completedToday,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Queue Length Trend over time
 * Genuine historical queue snapshots recorded on operational events
 * GET /api/analytics/queue-trends
 */
const getQueueTrends = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    const snapshotsRes = await db.query(
      `SELECT 
        qs.id,
        qs.queue_id,
        q.name AS queue_name,
        qs.waiting_count,
        qs.serving_count,
        qs.recorded_at
       FROM queue_snapshots qs
       JOIN queues q ON qs.queue_id = q.id
       WHERE q.manager_id = $1
       ORDER BY qs.recorded_at ASC
       LIMIT 50`,
      [managerId]
    );

    const points = snapshotsRes.rows;

    if (points.length === 0) {
      return res.json({
        success: true,
        trend: {
          labels: [],
          data: [],
          raw: [],
        },
      });
    }

    // Format timestamps cleanly with seconds to guarantee distinct chronological labels
    const labels = points.map((p) => {
      const d = new Date(p.recorded_at);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });

    const data = points.map((p) => p.waiting_count);

    return res.json({
      success: true,
      trend: {
        labels,
        data,
        raw: points,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Average Waiting Time by Queue
 * Calculated strictly from completed service records (service_started_at - created_at)
 * GET /api/analytics/waiting-times
 */
const getWaitingTimesByQueue = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    // Fetch all queues for this manager
    const queuesRes = await db.query(
      'SELECT id, name FROM queues WHERE manager_id = $1 ORDER BY name ASC',
      [managerId]
    );

    if (queuesRes.rows.length === 0) {
      return res.json({
        success: true,
        chart: {
          labels: [],
          data: [],
        },
        rows: [],
      });
    }

    // Fetch COMPLETED tokens for historical accuracy
    const tokensRes = await db.query(
      `SELECT t.queue_id, t.created_at, t.called_at, t.service_started_at
       FROM queues q
       JOIN tokens t ON q.id = t.queue_id
       WHERE q.manager_id = $1 
         AND t.status = 'COMPLETED'
         AND (t.called_at IS NOT NULL OR t.service_started_at IS NOT NULL)
         AND t.created_at IS NOT NULL`,
      [managerId]
    );

    const rows = queuesRes.rows.map((q) => {
      const queueTokens = tokensRes.rows.filter((t) => t.queue_id === q.id);
      let totalWait = 0;
      let count = 0;
      for (const t of queueTokens) {
        const start = new Date(t.created_at).getTime();
        const called = new Date(t.service_started_at || t.called_at).getTime();
        if (!isNaN(start) && !isNaN(called) && called >= start) {
          totalWait += (called - start) / (1000 * 60);
          count++;
        }
      }
      const avgWait = count > 0 ? Math.round((totalWait / count) * 10) / 10 : 0;
      return {
        id: q.id,
        queue_name: q.name,
        avg_wait_minutes: avgWait,
      };
    });

    const labels = rows.map((r) => r.queue_name);
    const data = rows.map((r) => r.avg_wait_minutes);

    return res.json({
      success: true,
      chart: {
        labels,
        data,
      },
      rows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Token Status Distribution (Doughnut Chart)
 * GET /api/analytics/token-distribution
 */
const getTokenDistribution = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    const query = `
      SELECT 
        COUNT(CASE WHEN t.status = 'WAITING' THEN 1 END)::int AS waiting,
        COUNT(CASE WHEN t.status = 'SERVING' THEN 1 END)::int AS serving,
        COUNT(CASE WHEN t.status = 'COMPLETED' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN t.status = 'CANCELLED' THEN 1 END)::int AS cancelled
      FROM queues q
      JOIN tokens t ON q.id = t.queue_id
      WHERE q.manager_id = $1
    `;

    const result = await db.query(query, [managerId]);
    const row = result.rows[0] || { waiting: 0, serving: 0, completed: 0, cancelled: 0 };

    return res.json({
      success: true,
      distribution: {
        labels: ['Waiting', 'Serving', 'Completed', 'Cancelled'],
        data: [row.waiting, row.serving, row.completed, row.cancelled],
        colors: ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'],
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Daily Token Generation over recent days
 * GET /api/analytics/daily-tokens
 */
const getDailyTokens = async (req, res, next) => {
  try {
    const managerId = req.manager.id;

    const tokensRes = await db.query(
      `SELECT t.created_at
       FROM queues q
       JOIN tokens t ON q.id = t.queue_id
       WHERE q.manager_id = $1
       ORDER BY t.created_at ASC`,
      [managerId]
    );

    const dayCounts = {};
    for (const t of tokensRes.rows) {
      if (t.created_at) {
        const d = new Date(t.created_at);
        const key = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        dayCounts[key] = (dayCounts[key] || 0) + 1;
      }
    }

    const labels = Object.keys(dayCounts);
    const data = Object.values(dayCounts);

    return res.json({
      success: true,
      chart: {
        labels,
        data,
      },
      rows: labels.map((l, i) => ({ label: l, count: data[i] })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAnalyticsOverview,
  getQueueTrends,
  getWaitingTimesByQueue,
  getTokenDistribution,
  getDailyTokens,
};
