'use strict';

const express = require('express');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');

const masterRouter = express.Router();

masterRouter.use('/auth', authRoutes);
masterRouter.use('/upload', uploadRoutes);

module.exports = masterRouter;
