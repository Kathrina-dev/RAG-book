/**
 * api.js — RAGbook API client
 *
 * All requests go through /api (proxied by Vite dev server to http://localhost:5000).
 * Auth tokens are stored in memory only (never localStorage) to prevent XSS theft.
 * TODO(security): Consider migrating to HttpOnly cookie-based auth if the backend is updated.
 */

const BASE = 'https://ragbook-backend.kathrinaelangbam.xyz/api' || '/api';

// In-memory token store — NOT in localStorage (XSS protection)
let _token = null;

export function setToken(token) {
  _token = token;
}

export function getToken() {
  return _token;
}

export function clearToken() {
  _token = null;
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  return headers;
}

async function handleResponse(res) {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.error || msg;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }
  return res.json();
}

// ---- Auth ----

export async function apiSignup(email, password) {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function apiLogin(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

// ---- Documents ----

export async function apiListDocuments() {
  const res = await fetch(`${BASE}/upload/documents`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiUploadDocument(file, onProgress) {
  const formData = new FormData();
  // Use 'file' field name matching the multer config
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/upload/document`);
    if (_token) xhr.setRequestHeader('Authorization', `Bearer ${_token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({});
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body?.error || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was aborted.')));
    xhr.send(formData);
  });
}

export async function apiDeleteDocument(id) {
  const res = await fetch(`${BASE}/upload/document/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ---- Conversations ----

export async function apiListConversations() {
  const res = await fetch(`${BASE}/question/conversations`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiGetConversation(id) {
  const res = await fetch(`${BASE}/question/conversation/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ---- Streaming question ----
// Returns a function to cancel the stream.
export function apiStreamQuestion(question, conversationId, callbacks) {
  const { onEvent, onError, onDone } = callbacks;

  const controller = new AbortController();

  fetch(`${BASE}/question/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ question, conversationId: conversationId || undefined }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const b = await res.json(); msg = b?.error || msg; } catch {}
        onError(new Error(msg));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep incomplete last chunk

        for (const part of parts) {
          if (!part.trim()) continue;
          let eventType = 'message';
          let dataLine = '';

          for (const line of part.split('\n')) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            if (line.startsWith('data:')) dataLine = line.slice(5).trim();
          }

          let data = {};
          try { data = JSON.parse(dataLine); } catch {}

          if (eventType === 'done') {
            onDone(data);
          } else if (eventType === 'error') {
            onError(new Error(data?.message || 'Stream error'));
          } else {
            onEvent(eventType, data);
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError(err);
    });

  return () => controller.abort();
}
