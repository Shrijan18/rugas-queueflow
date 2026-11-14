const express = require('express');
const { body } = require('express-validator');
const {
  moveTokenUp,
  moveTokenDown,
  completeService,
  cancelToken,
} = require('../controllers/tokenController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Require auth for all token actions
router.use(requireAuth);

router.put('/:id/move-up', moveTokenUp);
router.put('/:id/move-down', moveTokenDown);
router.put('/:id/complete', completeService);
router.put('/:id/cancel', cancelToken);

module.exports = router;
