// Simple, reasonably secure admin auth: a shared secret (ADMIN_TOKEN) sent as a
// Bearer token over HTTPS, compared in constant time. Set ADMIN_TOKEN in env.
const crypto = require('crypto');

function timingSafeEq(a, b) {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function extractToken(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return (req.headers['x-admin-token'] || '').toString().trim();
}

function isAdmin(req) {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return false;
  return timingSafeEq(extractToken(req), expected);
}

module.exports = { isAdmin, timingSafeEq };
