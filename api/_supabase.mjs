import {rpc} from './_postgres.mjs';
export {rpc};

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export function allowedOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // Non-browser callers are validated by method/body checks.
  const allowed = new Set([
    'https://flames-love-story.vercel.app',
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:8765', 'http://127.0.0.1:8765'
  ]);
  if (allowed.has(origin)) return true;

  // Vercel deployment previews use distinct hostnames. Only accept our own
  // project's recognized preview hosts AND when Origin equals request Host.
  // Never broadly allow arbitrary *.vercel.app / caller-supplied Origin.
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.origin !== origin) return false;
  const hostname = parsed.hostname.toLowerCase();
  const trustedPreview =
    /^flames-love-story-[a-z0-9-]+-rishikeshsanin-1193s-projects\.vercel\.app$/.test(hostname) ||
    /^flames-love-story-git-[a-z0-9-]+-rishikeshsanin-1193s-projects\.vercel\.app$/.test(hostname);
  const requestHost = String(req.headers?.host ?? '').trim().toLowerCase();
  return trustedPreview && parsed.host === requestHost;
}

export function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return null; }
}
