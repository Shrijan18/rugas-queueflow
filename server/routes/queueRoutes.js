const express = require('express');
const { body } = require('express-validator');
const {
  getQueues,
  createQueue,
  getQueueById,
  updateQueue,
  deleteQueue,
} = require('../controllers/queueController');
const {
  getQueueTokens,
  addToken,
  callNextToken,
} = require('../controllers/tokenController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth);

const queueValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Queue name is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Queue name must be between 2 and 150 characters'),
];

const tokenValidation = [
  body('person_name')
    .trim()
    .notEmpty()
    .withMessage('Person name is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Person name must be between 2 and 150 characters'),
  body('phone_number')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 7, max: 20 })
    .withMessage('Phone number must be between 7 and 20 digits'),
];

// Queue CRUD
router.get('/', getQueues);
router.post('/', queueValidation, createQueue);
router.get('/:id', getQueueById);
router.put('/:id', queueValidation, updateQueue);
router.delete('/:id', deleteQueue);

// Tokens nested under Queue
router.get('/:id/tokens', getQueueTokens);
router.post('/:id/tokens', tokenValidation, addToken);
router.put('/:id/call-next', callNextToken);

module.exports = router;
