const express = require('express');
const {
  getAnalyticsOverview,
  getQueueTrends,
  getWaitingTimesByQueue,
  getTokenDistribution,
  getDailyTokens,
} = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/overview', getAnalyticsOverview);
router.get('/queue-trends', getQueueTrends);
router.get('/waiting-times', getWaitingTimesByQueue);
router.get('/token-distribution', getTokenDistribution);
router.get('/daily-tokens', getDailyTokens);

module.exports = router;

