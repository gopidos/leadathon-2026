// LEADATHON 2026 — LOCAL DEV server (mirrors Vercel).
// Serves static files (with clean URLs) and dispatches /api/** to the same
// handler files Vercel runs, using a small (req,res) shim.
const http = require('http');
const fs = require('fs');
const path = require('path');
try { require('./lib/load-env')(); } catch (_) {}

const PORT = process.env.PORT || 5173;
const ROOT_DIR = path.join(__dirname, 'public'); // static files live in public/
const API_DIR = path.join(__dirname, 'api');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { resolve(raw); } });
  });
}

// Build an Express/Vercel-like res shim over the Node response.
function makeRes(nodeRes) {
  const res = {
    statusCode: 200,
    setHeader: (k, v) => nodeRes.setHeader(k, v),
    status(code) { this.statusCode = code; return this; },
    json(obj) { nodeRes.writeHead(this.statusCode, { 'Content-Type': 'application/json' }); nodeRes.end(JSON.stringify(obj)); },
    send(str) { nodeRes.writeHead(this.statusCode); nodeRes.end(str); },
    end(str) { nodeRes.writeHead(this.statusCode); nodeRes.end(str || ''); },
  };
  return res;
}

async function handleApi(req, nodeRes, urlPath, search) {
  // /api/admin/login -> api/admin/login.js
  const rel = urlPath.replace(/^\/api\//, '');
  const file = path.join(API_DIR, rel + '.js');
  if (!file.startsWith(API_DIR) || !fs.existsSync(file)) {
    nodeRes.writeHead(404, { 'Content-Type': 'application/json' });
    return nodeRes.end(JSON.stringify({ ok: false, error: 'Not found' }));
  }
  const handler = require(file);
  const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
  const query = Object.fromEntries(new URLSearchParams(search || ''));
  const shimReq = { method: req.method, headers: req.headers, url: req.url, query, body };
  try {
    await handler(shimReq, makeRes(nodeRes));
  } catch (e) {
    console.error('API error:', e.message);
    if (!nodeRes.headersSent) { nodeRes.writeHead(500, { 'Content-Type': 'application/json' }); nodeRes.end(JSON.stringify({ ok: false, error: 'Server error' })); }
  }
}

const server = http.createServer(async (req, res) => {
  const [rawPath, search] = req.url.split('?');
  let urlPath = decodeURIComponent(rawPath);

  if (urlPath.startsWith('/api/')) return handleApi(req, res, urlPath, search);

  if (urlPath === '/') urlPath = '/index.html';
  if (urlPath.includes('/.')) { res.writeHead(403); return res.end('Forbidden'); }
  if (!path.extname(urlPath) && fs.existsSync(path.join(ROOT_DIR, urlPath + '.html'))) urlPath += '.html';

  const filePath = path.join(ROOT_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT_DIR)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404 — Not Found</h1>'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const mode = process.env.SUPABASE_URL ? 'Supabase' : 'local file (registrations.json)';
  console.log(`\n  ⚡ LEADATHON 2026\n     Site:  http://localhost:${PORT}\n     Admin: http://localhost:${PORT}/admin\n     Storage: ${mode}\n`);
});
