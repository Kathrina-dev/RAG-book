'use strict';

const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_MODEL = 'models/gemini-embedding-001';
const GENERATION_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const MODEL_CONFIG = Object.freeze({
  gemini: {
    provider: 'gemini',
    model: GENERATION_MODEL,
  },
  groq: {
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
  },
  cohere: {
    provider: 'cohere',
    model: 'command-a-plus-05-2026',
  },
  openrouter: {
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  },
});

function getModelConfig(model) {
  const selectedModel = typeof model === 'string' ? model.trim().toLowerCase() : '';
  return MODEL_CONFIG[selectedModel] || MODEL_CONFIG.gemini;
}

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

async function requestJson(url, options, provider) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = errorBody;
    try {
      const payload = JSON.parse(errorBody);
      errorMessage = payload.error?.message || payload.message || errorBody;
    } catch {
      // Keep the plain response body when the provider does not return JSON.
    }
    throw new Error(`${provider} answer request failed with status ${response.status}: ${errorMessage}`);
  }
  return response.json();
}

async function generateAnswer(prompt, model) {
  const config = getModelConfig(model);
  let answer;

  if (config.provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.');
    const payload = await requestJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
      'Gemini'
    );
    answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
  } else {
    const apiKey = process.env[`${config.provider.toUpperCase()}_API_KEY`];
    if (!apiKey) throw new Error(`${config.provider.toUpperCase()}_API_KEY is not configured.`);

    if (config.provider === 'cohere') {
      const payload = await requestJson('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }] }),
      }, 'Cohere');
      answer = payload.message?.content?.map((part) => part.text || '').join('');
    } else {
      const baseUrl = config.provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (config.provider === 'openrouter') {
        headers['HTTP-Referer'] = process.env.FRONTEND_ORIGIN || 'https://ragbook.kathrinaelangbam.xyz';
        headers['X-Title'] = 'RAGbook';
      }
      const payload = await requestJson(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }] }),
      }, config.provider === 'groq' ? 'Groq' : 'OpenRouter');
      answer = payload.choices?.[0]?.message?.content;
    }
  }

  if (!answer) {
    throw new Error('Answer generation response did not contain text.');
  }

  return answer.trim();
}

module.exports = {
  embedDocuments,
  embedQuestion,
  generateAnswer,
  getModelConfig,
};