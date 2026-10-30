'use strict';

const express = require('express');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const questionRoutes = require('./routes/question');

const masterRouter = express.Router();

masterRouter.use('/auth', authRoutes);
masterRouter.use('/upload', uploadRoutes);
masterRouter.use('/question', questionRoutes);

module.exports = masterRouter;
