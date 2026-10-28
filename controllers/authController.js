'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;
const SALT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// JWT Secret Resolution
// ---------------------------------------------------------------------------
let cachedSecret = null;

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (cachedSecret) {
    return cachedSecret;
  }
  const secretFile = path.join(__dirname, '..', 'jwt_secret.txt');
  if (fs.existsSync(secretFile)) {
    cachedSecret = fs.readFileSync(secretFile, 'utf-8').trim();
    return cachedSecret;
  }

  console.warn(
    '[SECURITY WARNING] JWT_SECRET not set. ' +
    'Generating an ephemeral per-process secret. ' +
    'This instance is isolated — tokens will be invalidated on restart. ' +
    'Set JWT_SECRET in your environment for production deployments.'
  );
  cachedSecret = crypto.randomBytes(32).toString('hex');
  return cachedSecret;
}

// ---------------------------------------------------------------------------
// Internal Core Operations
// ---------------------------------------------------------------------------
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

function validateSignupInput(body) {
  const validation = validateLoginInput(body);
  if (!validation.valid) {
    return validation;
  }
  if (validation.password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }

  return validation;
}

async function findUserByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  return user ?? null;
}

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

// ---------------------------------------------------------------------------
// Exported Controller Functions
// ---------------------------------------------------------------------------
async function signup(req, res) {
  const validation = validateSignupInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const { email, password } = validation;

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });

    return res.status(201).json({ user });
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    console.error('[auth/signup] Unexpected error:', err.message);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}

async function login(req, res) {
  const validation = validateLoginInput(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const { email, password } = validation;

  try {
    const user = await findUserByEmail(email);

    const DUMMY_HASH = '$2b$12$invalidusernameXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const secret = getJwtSecret();

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: 'rag-book-api',
        audience: 'rag-book-client',
      }
    );

    return res.status(200).json({
      token,
      expiresIn: 3600,
    });
  } catch (err) {
    console.error('[auth/login] Unexpected error:', err.message);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}

module.exports = {
  signup,
  login,
  hashPassword,
};
