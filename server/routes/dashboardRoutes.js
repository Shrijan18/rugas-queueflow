const express = require('express');
const { getDashboardStats, getRecentActivity } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

router.get('/stats', getDashboardStats);
router.get('/recent-activity', getRecentActivity);

module.exports = router;

