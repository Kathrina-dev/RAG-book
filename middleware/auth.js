'use strict';

const { verifyAccessToken } = require('../lib/auth');

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = verifyAccessToken(token);
    if (typeof payload.sub !== 'string' || !payload.sub) {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

module.exports = { requireAuth };