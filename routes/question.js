'use strict';

const express = require('express');
const questionController = require('../controllers/questionController');

const router = express.Router();

router.post('/', questionController.askQuestion);

module.exports = router;