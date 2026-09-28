// POST /api/admin/checkin { participantId? , token? , action: 'in'|'out'|'reset' } (admin only)
const { isAdmin } = require('../../lib/admin-auth');
const { sbUpdate } = require('../../lib/supabase');

// Accept a raw token or a full verify URL containing ?t=<token>
function normalizeToken(t) {
  if (!t) return '';
  const s = String(t).trim();
  const m = s.match(/[?&]t=([^&\s]+)/);
  return m ? decodeURIComponent(m[1]) : s;
}

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = {}; } }
  const { participantId, action } = b || {};
  const token = normalizeToken(b && b.token);
  if (!['in', 'out', 'reset'].includes(action)) return res.status(400).json({ ok: false, error: 'Invalid action' });

  let query;
  if (participantId) query = `?id=eq.${encodeURIComponent(participantId)}`;
  else if (token) query = `?qr_token=eq.${encodeURIComponent(token)}`;
  else return res.status(400).json({ ok: false, error: 'participantId or token required' });

  const now = new Date().toISOString();
  const patch = action === 'in' ? { status: 'checked_in', checked_in_at: now }
    : action === 'out' ? { status: 'checked_out', checked_out_at: now }
    : { status: 'registered', checked_in_at: null, checked_out_at: null };

  try {
    const rows = await sbUpdate('participants', query + '&select=*,registrations(team_name)', patch);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Participant not found' });
    res.status(200).json({ ok: true, participant: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
