'use strict';

const path = require('path');
const crypto = require('crypto');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const supabase = require('../lib/supabase');
const prisma = require('../lib/prisma');
const { embedDocuments } = require('../lib/embeddings');

const MAX_CHUNK_LENGTH = 1200;
const CHUNK_OVERLAP = 200;
const SUPPORTED_TYPES = new Map([
  ['application/pdf', '.pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
]);

function getUploadedFile(req) {
  return Object.values(req.files ?? {}).flat()[0] ?? null;
}

async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  const result = await mammoth.extractRawText({ buffer: file.buffer });
  return result.value;
}

function chunkText(text) {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const chunks = [];

  for (let start = 0; start < normalizedText.length; start += MAX_CHUNK_LENGTH - CHUNK_OVERLAP) {
    const chunk = normalizedText.slice(start, start + MAX_CHUNK_LENGTH).trim();
    if (chunk) chunks.push(chunk);
    if (start + MAX_CHUNK_LENGTH >= normalizedText.length) break;
  }

  return chunks;
}

async function uploadDocument(req, res) {
  const file = getUploadedFile(req);
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  if (!SUPPORTED_TYPES.has(file.mimetype)) {
    return res.status(400).json({ error: 'Only PDF and DOCX documents are allowed.' });
  }

  try {
    const text = await extractText(file);
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return res.status(400).json({ error: 'The document contains no extractable text.' });
    }

    const embeddings = await embedDocuments(chunks);

    const extension = SUPPORTED_TYPES.get(file.mimetype) || path.extname(file.originalname).toLowerCase();
    const uniqueFileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const { data: storageData, error: storageError } = await supabase.storage
      .from('pdfs')
      .upload(`uploads/${uniqueFileName}`, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) throw storageError;

    const document = await prisma.$transaction(async (transaction) => {
      const createdDocument = await transaction.document.create({
        data: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          storagePath: storageData.path,
        },
      });

      for (let index = 0; index < chunks.length; index += 1) {
        const vector = `[${embeddings[index].join(',')}]`;
        await transaction.$executeRaw`
          INSERT INTO document_chunks (id, document_id, chunk_index, content, embedding)
          VALUES (${crypto.randomUUID()}, ${createdDocument.id}, ${index}, ${chunks[index]}, ${vector}::vector)
        `;
      }

      return createdDocument;
    });

    return res.status(201).json({
      message: 'Document processed successfully.',
      documentId: document.id,
      chunks: chunks.length,
      path: storageData.path,
    });
  } catch (err) {
    console.error('[storage/upload] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Failed to process document.' });
  }
}

module.exports = {
  uploadDocument,
};
