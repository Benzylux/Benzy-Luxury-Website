require('../../../loadEnv');

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function readBearerToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function resolveCartUser(req) {
  const token = readBearerToken(req);
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function attachOptionalCartUser(req, res, next) {
  req.cartUser = resolveCartUser(req);
  next();
}

function requireCartAuth(req, res, next) {
  const user = resolveCartUser(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication is required for this cart action.'
    });
  }

  req.cartUser = user;
  next();
}

module.exports = {
  attachOptionalCartUser,
  requireCartAuth
};
