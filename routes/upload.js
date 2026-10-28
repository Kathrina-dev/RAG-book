'use strict';

const express = require('express');
const multer = require('multer');
const documentController = require('../controllers/uploadController');

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /documents/upload
router.post('/pdf', upload.single('pdf'), documentController.uploadPdf);

module.exports = router;
