# FLAMES 💗

A cinematic, cute, no-account FLAMES experience with one-by-one matched-letter strike animations, honest name variation explorer, and privacy-conscious optional feedback. Run locally with `npx serve .` or `python -m http.server 8000` and visit the root. See GitHub Actions for engine smoke tests.

> FLAMES is a nostalgic game, not a relationship prediction. The application does not have a public history page.

This project is separate from the private [FLAMES_testing](https://github.com/Rishikeshsanin/FLAMES_testing) QA suite.

## Central research API

The same-origin `/api/research` function recalculates every result before invoking isolated `flames` database functions. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` only on the existing Vercel project. The migration enables RLS on every table, grants no direct table access, rate-limits sessions, deduplicates attempt UUIDs, retains names for 30 days and other research records for 90 days, and supports deletion by a browser-held random token.

The shared Project Hub currently does not expose the `flames` schema through its Data API. Repository rules forbid changing that global setting or introducing a broad database/service-role credential. Until a Hub administrator provides an approved app-scoped route, gameplay remains available and sharing fails closed with a non-blocking message.

Use Node.js 22+. Run `npm run check`, `npm test`, and, with a local server on port 8765, `node test/browser-smoke.mjs`.
