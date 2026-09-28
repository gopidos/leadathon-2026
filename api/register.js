// Vercel serverless function — POST /api/register
// Deploys automatically on Vercel (free tier). Reads Supabase credentials from
// Vercel Environment Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

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
