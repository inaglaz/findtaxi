// Cloudflare Pages Function: /api/services
// Methods:
//   GET    /api/services?from=YYYY-MM-DD&to=YYYY-MM-DD     → list days in range with raw_text
//   PUT    /api/services   body: { date, raw }             → upsert raw_text for a given date
//   DELETE /api/services?month=YYYY-MM                     → delete all days in a month

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const token = request.headers.get('X-API-Token');
  if (!env.API_TOKEN || token !== env.API_TOKEN) {
    return json({ error: 'unauthorized' }, 401);
  }

  if (!env.DB) return json({ error: 'D1 binding missing' }, 500);

  try {
    if (request.method === 'GET')    return await getDays(url, env);
    if (request.method === 'PUT')    return await putDay(request, env);
    if (request.method === 'DELETE') return await deleteMonth(url, env);
    return json({ error: 'method not allowed' }, 405);
  } catch (err) {
    return json({ error: String(err && err.message || err) }, 500);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Token',
    'Access-Control-Max-Age': '86400'
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

async function getDays(url, env) {
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');
  if (!isISODate(from) || !isISODate(to)) {
    return json({ error: 'missing or invalid from/to' }, 400);
  }
  const result = await env.DB
    .prepare('SELECT date, raw_text FROM service_days WHERE date BETWEEN ? AND ? ORDER BY date')
    .bind(from, to)
    .all();

  const days = {};
  for (const r of result.results) {
    days[r.date] = { raw: r.raw_text || '' };
  }
  return json({ days });
}

async function putDay(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const { date, raw } = body || {};
  if (!isISODate(date)) return json({ error: 'invalid date' }, 400);
  if (typeof raw !== 'string') return json({ error: 'raw must be string' }, 400);

  const safe = raw.slice(0, 50000);
  const now = Date.now();

  if (safe.trim() === '') {
    await env.DB
      .prepare('DELETE FROM service_days WHERE date = ?')
      .bind(date)
      .run();
    return json({ ok: true, date, deleted: true });
  }

  await env.DB
    .prepare(`INSERT INTO service_days (date, raw_text, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(date) DO UPDATE SET
                raw_text = excluded.raw_text,
                updated_at = excluded.updated_at`)
    .bind(date, safe, now)
    .run();
  return json({ ok: true, date });
}

async function deleteMonth(url, env) {
  const month = url.searchParams.get('month');
  if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'invalid month' }, 400);
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const next = m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  await env.DB
    .prepare('DELETE FROM service_days WHERE date >= ? AND date < ?')
    .bind(from, next)
    .run();
  return json({ ok: true, month });
}

function isISODate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
