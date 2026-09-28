// GET /api/admin/registrations -> all teams with participants + stats. (admin only)
const { isAdmin } = require('../../lib/admin-auth');
const { sbSelect } = require('../../lib/supabase');

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const data = await sbSelect('registrations', '?select=*,participants(*)&order=created_at.desc');
    data.forEach((r) => { if (Array.isArray(r.participants)) r.participants.sort((a, b) => a.idx - b.idx); });
    const parts = data.reduce((acc, r) => acc.concat(r.participants || []), []);
    const stats = {
      teams: data.length,
      participants: parts.length,
      checkedIn: parts.filter((p) => p.status === 'checked_in').length,
      checkedOut: parts.filter((p) => p.status === 'checked_out').length,
      registered: parts.filter((p) => p.status === 'registered').length,
    };
    res.status(200).json({ ok: true, registrations: data, stats });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
