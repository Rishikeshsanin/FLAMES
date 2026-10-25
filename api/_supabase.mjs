const BASE_URL = process.env.SUPABASE_URL;
const API_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

export async function rpc(name, body) {
  if (!BASE_URL || !API_KEY) throw new Error('Research service is not configured');
  const response = await fetch(`${BASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: API_KEY,
      authorization: `Bearer ${API_KEY}`,
      'content-type': 'application/json',
      'content-profile': 'flames',
      'accept-profile': 'flames'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Database request failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const allowed = new Set([
    'https://flames-love-story.vercel.app',
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:8765', 'http://127.0.0.1:8765'
  ]);
  return allowed.has(origin);
}

export function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return null; }
}
