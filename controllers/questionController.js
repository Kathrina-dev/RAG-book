'use strict';

const crypto = require('crypto');
const { embedQuestion } = require('../lib/embeddings');
const prisma = require('../lib/prisma');

const MAX_QUESTION_LENGTH = 2000;
const MAX_ANSWER_LENGTH = 10000;

async function askQuestion(req, res) {
  const question = typeof req.body?.question === 'string'
    ? req.body.question.trim()
    : '';

  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: 'Question exceeds maximum allowed length.' });
  }

  const conversationId = typeof req.body?.conversationId === 'string'
    ? req.body.conversationId.trim()
    : '';
  const suppliedAnswer = req.body?.answer ?? req.body?.reply ?? null;

  if (suppliedAnswer !== null && typeof suppliedAnswer !== 'string') {
    return res.status(400).json({ error: 'Answer must be a string.' });
  }

  const answer = typeof suppliedAnswer === 'string' ? suppliedAnswer.trim() : null;
  if (answer && answer.length > MAX_ANSWER_LENGTH) {
    return res.status(400).json({ error: 'Answer exceeds maximum allowed length.' });
  }

  try {
    const embedding = await embedQuestion(question);
    const vector = `[${embedding.join(',')}]`;

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
};