'use strict';

const express = require('express');
const multer = require('multer');
const documentController = require('../controllers/uploadController');

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const uploadDocument = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'pdf', maxCount: 1 },
]);

router.post('/document', uploadDocument, documentController.uploadDocument);
router.post('/pdf', uploadDocument, documentController.uploadDocument);

module.exports = router;
