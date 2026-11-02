'use strict';

const crypto = require('crypto');
const { embedQuestion, generateAnswer } = require('../lib/embeddings');
const prisma = require('../lib/prisma');

const MAX_QUESTION_LENGTH = 2000;
const MAX_ANSWER_LENGTH = 10000;

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

async function retrieveChunks(question) {
  const embedding = await embedQuestion(question);
  const vector = `[${embedding.join(',')}]`;

  const chunks = await prisma.$queryRaw`
    SELECT content, 1 - (embedding <=> ${vector}::vector) AS similarity
    FROM document_chunks
    ORDER BY embedding <=> ${vector}::vector
    LIMIT 3
  `;

  return { chunks, vector };
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
    const { chunks, vector } = await retrieveChunks(question);
    const context = chunks.map((chunk) => chunk.content).join('\n\n');
    const prompt = `Answer this question based only on the following context: ${context}. Question:${question}`;
    const answer = (await generateAnswer(prompt)).slice(0, MAX_ANSWER_LENGTH);

    const savedMessage = await prisma.$transaction(async (transaction) => {
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

module.exports = {
  askQuestion,
  retrieveQuestionChunks,
};