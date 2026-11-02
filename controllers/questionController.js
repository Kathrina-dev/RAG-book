'use strict';

const crypto = require('crypto');
const { embedQuestion, generateAnswer } = require('../lib/embeddings');
const prisma = require('../lib/prisma');

const MAX_QUESTION_LENGTH = 2000;

function getQuestion(req) {
  const question = typeof req.body?.question === 'string'
    ? req.body.question.trim()
    : '';

  if (!question) {
    return { error: 'Question is required.' };
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return { error: 'Question exceeds maximum allowed length.' };
  }

  return { question };
}

async function retrieveChunks(question, onProgress = () => {}) {
  const embedding = await embedQuestion(question);
  onProgress('embedding_completed');
  const vector = `[${embedding.join(',')}]`;

  onProgress('similarity_started');
  const chunks = await prisma.$queryRaw`
    SELECT content, 1 - (embedding <=> ${vector}::vector) AS similarity
    FROM document_chunks
    ORDER BY embedding <=> ${vector}::vector
    LIMIT 3
  `;

  onProgress('chunks_retrieved', {
    count: chunks.length,
    similarities: chunks.map((chunk) => Number(chunk.similarity)),
  });

  return { chunks, vector };
}

async function saveMessage(question, answer, vector, conversationId) {
  return prisma.$transaction(async (transaction) => {
    let conversation;

    if (conversationId) {
      conversation = await transaction.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });

      if (!conversation) {
        const error = new Error('Conversation not found.');
        error.statusCode = 404;
        throw error;
      }
    } else {
      conversation = await transaction.conversation.create({
        data: {},
        select: { id: true },
      });
    }

    const [{ nextSequence }] = await transaction.$queryRaw`
      SELECT COALESCE(MAX(sequence), -1) + 1 AS "nextSequence"
      FROM conversation_messages
      WHERE conversation_id = ${conversation.id}
    `;

    const sequence = Number(nextSequence);
    const messageId = crypto.randomUUID();

    await transaction.$executeRaw`
      INSERT INTO conversation_messages
        (id, conversation_id, sequence, question, answer, question_vector)
      VALUES
        (${messageId}, ${conversation.id}, ${sequence}, ${question}, ${answer}, ${vector}::vector)
    `;

    return { id: messageId, conversationId: conversation.id, sequence };
  });
}

async function answerQuestion(question, conversationId, onProgress = () => {}) {
  onProgress('embedding_started');
  const { chunks, vector } = await retrieveChunks(question, onProgress);

  const context = chunks.map((chunk) => chunk.content).join('\n\n');
  const prompt = `Answer this question based only on the following context: ${context}. Question:${question}`;

  onProgress('generation_started');
  const answer = await generateAnswer(prompt);
  onProgress('generation_completed');

  const savedMessage = await saveMessage(question, answer, vector, conversationId);
  onProgress('answer_saved', {
    conversationId: savedMessage.conversationId,
    messageId: savedMessage.id,
    sequence: savedMessage.sequence,
  });

  return { savedMessage, answer };
}

function sendEvent(res, type, data = {}) {
  if (res.writableEnded) return;
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function retrieveQuestionChunks(req, res) {
  const { question, error } = getQuestion(req);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const { chunks } = await retrieveChunks(question);
    return res.status(200).json({
      question,
      chunks: chunks.map((chunk, index) => ({
        rank: index + 1,
        content: chunk.content,
        similarity: Number(chunk.similarity),
      })),
    });
  } catch (err) {
    console.error('[question/retrieve] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve document chunks.' });
  }
}

async function askQuestion(req, res) {
  const questionResult = getQuestion(req);
  if (questionResult.error) {
    return res.status(400).json({ error: questionResult.error });
  }
  const { question } = questionResult;

  const conversationId = typeof req.body?.conversationId === 'string'
    ? req.body.conversationId.trim()
    : '';
  try {
    const { savedMessage, answer } = await answerQuestion(question, conversationId);

    return res.status(200).json({
      conversationId: savedMessage.conversationId,
      messageId: savedMessage.id,
      sequence: savedMessage.sequence,
      question,
      answer,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('[question/embed] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Failed to embed and save question.' });
  }
}

async function streamQuestion(req, res) {
  const questionResult = getQuestion(req);
  if (questionResult.error) {
    return res.status(400).json({ error: questionResult.error });
  }
  const { question } = questionResult;
  const conversationId = typeof req.body?.conversationId === 'string'
    ? req.body.conversationId.trim()
    : '';

  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  sendEvent(res, 'started');

  let stage = 'starting';
  try {
    const { savedMessage, answer } = await answerQuestion(
      question,
      conversationId,
      (type, data) => {
        stage = type;
        sendEvent(res, type, data);
      }
    );

    sendEvent(res, 'done', {
      question,
      answer,
      conversationId: savedMessage.conversationId,
      messageId: savedMessage.id,
      sequence: savedMessage.sequence,
    });
  } catch (err) {
    console.error('[question/stream] Unexpected error:', err.message);
    sendEvent(res, 'error', {
      status: err.statusCode || 500,
      stage,
      message: process.env.NODE_ENV === 'production' && !err.statusCode
        ? 'Failed to process question.'
        : err.message,
    });
  } finally {
    res.end();
  }
}

async function listConversations(req, res) {
  try {
    const conversations = await prisma.conversation.findMany({
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          select: { question: true },
          orderBy: { sequence: 'asc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ conversations });
  } catch (err) {
    console.error('[question/conversations] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Failed to list conversations.' });
  }
}

async function getConversationMessages(req, res) {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Conversation ID is required.' });
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        messages: {
          select: {
            id: true,
            sequence: true,
            question: true,
            answer: true,
            createdAt: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    return res.status(200).json({ conversation });
  } catch (err) {
    console.error('[question/conversation] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch conversation messages.' });
  }
}

module.exports = {
  askQuestion,
  retrieveQuestionChunks,
  streamQuestion,
  listConversations,
  getConversationMessages,
};