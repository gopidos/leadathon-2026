// POST /api/admin/login { token } -> validates the admin token.
const { timingSafeEq } = require('../../lib/admin-auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
  const token = (b && b.token) || '';
  const expected = process.env.ADMIN_TOKEN || '';
  if (expected && timingSafeEq(token, expected)) return res.status(200).json({ ok: true });
  return res.status(401).json({ ok: false, error: 'Invalid admin token' });
};
