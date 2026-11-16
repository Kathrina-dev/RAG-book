'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

let cachedSecret = null;

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;

  const secretFile = path.join(__dirname, '..', 'jwt_secret.txt');
  if (fs.existsSync(secretFile)) {
    cachedSecret = fs.readFileSync(secretFile, 'utf-8').trim();
    return cachedSecret;
  }

  console.warn(
    '[SECURITY WARNING] JWT_SECRET not set. Generating an ephemeral per-process secret.'
  );
  cachedSecret = crypto.randomBytes(32).toString('hex');
  return cachedSecret;
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: 'rag-book-api',
    audience: 'rag-book-client',
  });
}

module.exports = { getJwtSecret, verifyAccessToken };