// Minimal Supabase REST helper (uses the secret key, server-side only).
const BASE = () => process.env.SUPABASE_URL;
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra) {
  const k = KEY();
  return Object.assign({
    'Content-Type': 'application/json',
    apikey: k,
    Authorization: `Bearer ${k}`,
  }, extra || {});
}

async function sbInsert(table, rows, { returning = true } = {}) {
  const res = await fetch(`${BASE()}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(returning ? { Prefer: 'return=representation' } : {}),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase insert ${table} failed (${res.status}): ${await res.text()}`);
  return returning ? res.json() : null;
}

async function sbSelect(table, query = '') {
  const res = await fetch(`${BASE()}/rest/v1/${table}${query}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase select ${table} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function sbUpdate(table, query, patch) {
  const res = await fetch(`${BASE()}/rest/v1/${table}${query}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Supabase update ${table} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

const configured = () => !!(BASE() && KEY());

module.exports = { sbInsert, sbSelect, sbUpdate, configured };
