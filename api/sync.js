// Синхронизация 60D: хранит одно состояние на код синхронизации в Upstash Redis.
const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return res.status(503).json({ error: 'store-not-connected' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const k = String((req.method === 'GET' ? req.query.k : body.k) || '');
  if (!/^[a-z0-9]{16,64}$/.test(k)) return res.status(400).json({ error: 'bad-key' });
  const rk = 'c60:' + crypto.createHash('sha256').update(k).digest('hex');
  const call = (cmd) => fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  }).then((r) => r.json());

  try {
    if (req.method === 'GET') {
      const j = await call(['GET', rk]);
      if (!j.result) return res.status(200).json({ t: 0 });
      return res.status(200).send(j.result);
    }
    if (req.method === 'POST') {
      const t = Number(body.t) || Date.now();
      if (!body.data || typeof body.data !== 'object') return res.status(400).json({ error: 'no-data' });
      const j = await call(['SET', rk, JSON.stringify({ t, data: body.data })]);
      if (j.error) return res.status(500).json({ error: j.error });
      return res.status(200).json({ ok: true, t });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
