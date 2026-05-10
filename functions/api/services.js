// Cloudflare Pages Function: /api/services
// Methods:
//   GET    /api/services?from=YYYY-MM-DD&to=YYYY-MM-DD     → list services in range, grouped by date
//   PUT    /api/services   body: { date, rows: [...] }     → replace all rows for a given date
//   DELETE /api/services?month=YYYY-MM                     → delete all services in a month

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
    if (request.method === 'GET')    return await getServices(url, env);
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

async function getServices(url, env) {
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');
  if (!isISODate(from) || !isISODate(to)) {
    return json({ error: 'missing or invalid from/to' }, 400);
  }
  const result = await env.DB
    .prepare('SELECT date, position, hora, hotel, habitacion, taxista FROM services WHERE date BETWEEN ? AND ? ORDER BY date, position')
    .bind(from, to)
    .all();

  const days = {};
  for (const r of result.results) {
    if (!days[r.date]) days[r.date] = [];
    while (days[r.date].length <= r.position) {
      days[r.date].push({ hora: '', hotel: '', habitacion: '', taxista: '' });
    }
    days[r.date][r.position] = {
      hora: r.hora || '',
      hotel: r.hotel || '',
      habitacion: r.habitacion || '',
      taxista: r.taxista || ''
    };
  }
  return json({ days });
}

async function putDay(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const { date, rows } = body || {};
  if (!isISODate(date)) return json({ error: 'invalid date' }, 400);
  if (!Array.isArray(rows)) return json({ error: 'rows must be array' }, 400);

  const now = Date.now();
  const stmts = [];
  stmts.push(env.DB.prepare('DELETE FROM services WHERE date = ?').bind(date));

  rows.forEach((r, i) => {
    const hora       = clip(r && r.hora, 10);
    const hotel      = clip(r && r.hotel, 100);
    const habitacion = clip(r && r.habitacion, 50);
    const taxista    = clip(r && r.taxista, 100);
    if (!hora && !hotel && !habitacion && !taxista) return;
    stmts.push(env.DB.prepare(
      'INSERT INTO services (date, position, hora, hotel, habitacion, taxista, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(date, i, hora, hotel, habitacion, taxista, now));
  });

  await env.DB.batch(stmts);
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
    .prepare('DELETE FROM services WHERE date >= ? AND date < ?')
    .bind(from, next)
    .run();
  return json({ ok: true, month });
}

function isISODate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function clip(v, n)  { return String(v == null ? '' : v).slice(0, n); }
