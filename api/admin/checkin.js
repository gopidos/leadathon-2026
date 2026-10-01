// POST /api/admin/checkin { participantId? , token? , action: 'in'|'out'|'reset' } (admin only)
const { isAdmin } = require('../../lib/admin-auth');
const { query } = require('../../lib/db');

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

  let whereCol, whereVal;
  if (participantId) { whereCol = 'id'; whereVal = participantId; }
  else if (token) { whereCol = 'qr_token'; whereVal = token; }
  else return res.status(400).json({ ok: false, error: 'participantId or token required' });

  const now = new Date();
  let setSql, setParams;
  if (action === 'in') { setSql = 'status = ?, checked_in_at = ?'; setParams = ['checked_in', now]; }
  else if (action === 'out') { setSql = 'status = ?, checked_out_at = ?'; setParams = ['checked_out', now]; }
  else { setSql = 'status = ?, checked_in_at = NULL, checked_out_at = NULL'; setParams = ['registered']; }

  try {
    const result = await query(`UPDATE participants SET ${setSql} WHERE ${whereCol} = ?`, [...setParams, whereVal]);
    if (!result.affectedRows) return res.status(404).json({ ok: false, error: 'Participant not found' });
    const rows = await query(`SELECT * FROM participants WHERE ${whereCol} = ?`, [whereVal]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Participant not found' });
    res.status(200).json({ ok: true, participant: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
