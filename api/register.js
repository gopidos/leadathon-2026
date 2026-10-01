// Vercel serverless function — POST /api/register
// Reads MySQL credentials from environment variables: DB_HOST, DB_PORT, DB_NAME,
// DB_USER, DB_PASSWORD (or a single DATABASE_URL).

const { handleRegistration } = require('../lib/register-core');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Vercel usually parses JSON bodies; guard for the raw case just in case.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const { status, body: out } = await handleRegistration(body || {});
  return res.status(status).json(out);
};
