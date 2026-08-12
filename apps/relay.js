/*
 * COLDWAKE relay proxy
 * -------------------------------------------------------------------------
 * Place at:  api/relay.js   (alongside index.html at the repo root)
 *
 * Why this exists: the browser must never hold an Upstash token. Anything in
 * index.html is public, and a leaked read/write token lets anyone wipe or read
 * every room. This function keeps the credential server-side and only forwards
 * a small allow-list of commands.
 *
 * Vercel environment variables to set (Project → Settings → Environment
 * Variables). If you added the Upstash integration from the Vercel
 * marketplace, the first two already exist:
 *
 *   KV_REST_API_URL     https://<your-db>.upstash.io
 *   KV_REST_API_TOKEN   <the read/write token>
 *
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are also accepted.
 */

const URL_ENV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN_ENV = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

/* Only these commands are forwarded. Without this an attacker could send
   FLUSHALL through the proxy and take out every room on the database. */
const ALLOWED = new Set(['RPUSH', 'LRANGE', 'EXPIRE', 'LLEN', 'DEL']);

/* Keys must look exactly like a COLDWAKE room list and nothing else, so the
   proxy cannot be used to read unrelated data in the same database. */
const KEY_RE = /^cw:[A-Z0-9]{4,8}:[hc]$/;

const MAX_COMMANDS = 24;
const MAX_VALUE_BYTES = 4096;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!URL_ENV || !TOKEN_ENV) {
    return res.status(500).json({
      error: 'relay not configured',
      hint: 'set KV_REST_API_URL and KV_REST_API_TOKEN in the Vercel project'
    });
  }

  let cmds = req.body;
  if (typeof cmds === 'string') {
    try { cmds = JSON.parse(cmds); } catch (e) { return res.status(400).json({ error: 'bad json' }); }
  }
  if (!Array.isArray(cmds) || !cmds.length) return res.status(400).json({ error: 'expected a command array' });
  if (cmds.length > MAX_COMMANDS) return res.status(400).json({ error: 'too many commands' });

  for (const c of cmds) {
    if (!Array.isArray(c) || c.length < 2) return res.status(400).json({ error: 'malformed command' });
    const op = String(c[0]).toUpperCase();
    if (!ALLOWED.has(op)) return res.status(403).json({ error: 'command not allowed: ' + op });
    if (!KEY_RE.test(String(c[1]))) return res.status(403).json({ error: 'key not allowed' });
    for (let i = 2; i < c.length; i++) {
      if (typeof c[i] !== 'string') return res.status(400).json({ error: 'arguments must be strings' });
      if (c[i].length > MAX_VALUE_BYTES) return res.status(413).json({ error: 'value too large' });
    }
    c[0] = op;
  }

  try {
    const upstream = await fetch(URL_ENV.replace(/\/$/, '') + '/pipeline', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN_ENV,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cmds)
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ error: 'upstream failed', detail: String(err && err.message) });
  }
};
