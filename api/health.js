// GET /api/health — reports which env vars are configured (names only, no secret
// values) and the effective storage mode. Safe to expose; helps verify deploys.
module.exports = async (req, res) => {
  const has = (k) => !!process.env[k];
  res.status(200).json({
    ok: true,
    env: {
      SUPABASE_URL: has('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY'),
      RESEND_API_KEY: has('RESEND_API_KEY'),
      RESEND_FROM: has('RESEND_FROM'),
      ADMIN_TOKEN: has('ADMIN_TOKEN'),
      PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || null,
    },
    storage: (has('SUPABASE_URL') && has('SUPABASE_SERVICE_ROLE_KEY')) ? 'supabase' : 'local',
    time: new Date().toISOString(),
  });
};
