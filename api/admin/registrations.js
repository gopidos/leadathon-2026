// GET /api/admin/registrations -> all teams with participants + stats. (admin only)
const { isAdmin } = require('../../lib/admin-auth');
const { query } = require('../../lib/db');

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  try {
    const regs = await query('SELECT * FROM registrations ORDER BY created_at DESC');
    const parts = await query('SELECT * FROM participants ORDER BY idx ASC');
    const byReg = new Map();
    for (const p of parts) {
      if (!byReg.has(p.registration_id)) byReg.set(p.registration_id, []);
      byReg.get(p.registration_id).push(p);
    }
    const data = regs.map((r) => ({ ...r, participants: byReg.get(r.id) || [] }));
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
