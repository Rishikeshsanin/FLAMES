import {rpc} from './_postgres.mjs';
export {rpc};

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
