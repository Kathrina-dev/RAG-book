'use strict';

const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_MODEL = 'models/gemini-embedding-001';
const GENERATION_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

async function embedTexts(texts, taskType) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: EMBEDDING_MODEL,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== texts.length) {
    throw new Error('Embedding response did not match the input count.');
  }

  return payload.embeddings.map((item) => item.values);
}

async function embedDocuments(texts) {
  return embedTexts(texts, 'RETRIEVAL_DOCUMENT');
}

async function embedQuestion(question) {
  const [embedding] = await embedTexts([question], 'RETRIEVAL_QUERY');
  return embedding;
}

async function generateAnswer(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GENERATION_MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = errorBody;
    try {
      errorMessage = JSON.parse(errorBody).error?.message || errorBody;
    } catch {
      // Keep the plain response body when Gemini does not return JSON.
    }
    throw new Error(`Answer generation request failed with status ${response.status}: ${errorMessage}`);
  }

  const payload = await response.json();
  const answer = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!answer) {
    throw new Error('Answer generation response did not contain text.');
  }

  return answer;
}

module.exports = {
  embedDocuments,
  embedQuestion,
  generateAnswer,
};