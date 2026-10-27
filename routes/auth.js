'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const router = express.Router();

// ---------------------------------------------------------------------------
// JWT Secret Resolution
// ---------------------------------------------------------------------------
function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  const secretFile = path.join(__dirname, '..', 'jwt_secret.txt');
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf-8').trim();
  }
  // Ephemeral fallback — tokens won't survive restarts. Log a severe warning.
  console.warn(
    '[SECURITY WARNING] JWT_SECRET not set. ' +
    'Generating an ephemeral per-process secret. ' +
    'This instance is isolated — tokens will be invalidated on restart. ' +
    'Set JWT_SECRET in your environment for production deployments.'
  );
  const ephemeral = crypto.randomBytes(32).toString('hex');
  // Cache on the module so the secret stays stable within one process lifetime.
  getJwtSecret._cached = ephemeral;
  getJwtSecret = () => ephemeral; // replace self with constant accessor
  return ephemeral;
}

// ---------------------------------------------------------------------------
// POST /auth/login
// Body: { "email": "...", "password": "..." }
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128; // prevent DoS via huge bcrypt inputs
const SALT_ROUNDS = 12;          // bcrypt work factor

/**
 * Validates and sanitises login input.
 * Returns { valid: true, email, password } or { valid: false, message }.
 */
function validateLoginInput(body) {
  const { email, password } = body ?? {};

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return { valid: false, message: 'Invalid email address.' };
  }
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, message: 'Password is required.' };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, message: 'Password exceeds maximum allowed length.' };
  }

  return { valid: true, email: email.trim().toLowerCase(), password };
}

/**
 * Looks up a user by email via Prisma.
 * Returns { id, email, passwordHash } or null when not found.
 * Only the fields needed for auth are selected — no over-fetching.
 */
async function findUserByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  return user ?? null;
}

// POST /auth/login
router.post('/login', async (req, res) => {
  const validation = validateLoginInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const { email, password } = validation;

  try {
    const user = await findUserByEmail(email);

    // Perform a constant-time bcrypt comparison even when the user doesn't
    // exist to prevent user-enumeration via timing side-channels.
    const DUMMY_HASH =
      '$2b$12$invalidusernameXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const secret = getJwtSecret();

    // Sign JWT — algorithm hardcoded to HS256, 'none' is never accepted
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '1h',        // TODO(security): tune to your session policy
        issuer: 'rag-book-api',
        audience: 'rag-book-client',
      }
    );

    // TODO(security): If switching to cookie-based sessions, set the token in
    // an HttpOnly, Secure, SameSite=Lax cookie instead of returning it in the
    // JSON body, and implement CSRF protection on all state-changing endpoints.
    return res.status(200).json({
      token,
      expiresIn: 3600,
    });
  } catch (err) {
    // Log diagnostic details server-side; never expose to the client
    console.error('[auth/login] Unexpected error:', err.message);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Utility: hashPassword
// Use this during user registration to produce the value stored in your DB.
//
//   const hash = await hashPassword(plaintextPassword);
//   // store `hash` in the DB, never the plaintext
// ---------------------------------------------------------------------------
async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

module.exports = { router, hashPassword };
