'use strict';

const express = require('express');
const questionController = require('../controllers/questionController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/stream', questionController.streamQuestion);
router.post('/', questionController.askQuestion);
router.get('/conversations', questionController.listConversations);
router.get('/conversation/:id', questionController.getConversationMessages);

module.exports = router;