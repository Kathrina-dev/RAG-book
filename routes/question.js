'use strict';

const express = require('express');
const questionController = require('../controllers/questionController');

const router = express.Router();

router.post('/retrieve', questionController.retrieveQuestionChunks);
router.post('/stream', questionController.streamQuestion);
router.post('/', questionController.askQuestion);

module.exports = router;