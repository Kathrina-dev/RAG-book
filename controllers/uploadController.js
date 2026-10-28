'use strict';

const supabase = require('../lib/supabase');
const path = require('path');

async function uploadPdf(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Ensure it is strictly a PDF
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF documents are allowed.' });
    }

    // Generate a unique file name to prevent overwriting existing assets
    const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
    
    // Upload directly to the 'pdfs' bucket buffer channel
    const { data, error } = await supabase.storage
      .from('pdfs')
      .upload(`uploads/${uniqueFileName}`, req.file.buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Success response returning the target path inside the bucket
    return res.status(200).json({
      message: 'PDF uploaded successfully.',
      path: data.path, // Save this path in your Prisma database later!
    });

  } catch (err) {
    console.error('[storage/upload] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Failed to process file upload.' });
  }
}

module.exports = {
  uploadPdf
};
