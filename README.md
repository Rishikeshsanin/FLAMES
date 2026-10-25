# FLAMES 💗

A cinematic, cute, no-account FLAMES experience with one-by-one matched-letter strike animations, honest name variation explorer, and privacy-conscious optional feedback. Run locally with `npx serve .` or `python -m http.server 8000` and visit the root. See GitHub Actions for engine smoke tests.

> FLAMES is a nostalgic game, not a relationship prediction. The application does not have a public history page.

This project is separate from the private [FLAMES_testing](https://github.com/Rishikeshsanin/FLAMES_testing) QA suite.

## Central research API

The same-origin `/api/research` endpoint recalculates all results before calling only approved `flames.*` stored functions using the isolated PostgreSQL role `flames_public_submitter`. It never uses the shared Supabase Data API, a project-wide service-role key, or a browser-side database client.

**Required, not configured yet:** on the existing `flames-love-story` Vercel project, set **encrypted** `FLAMES_PUBLIC_DATABASE_URL` to the **actual** Supabase **transaction-pooler** URL from Project Hub → **Connect**. The custom-role username must be `flames_public_submitter.nowlwprtcnieihelqjoa`, and the application validates pooler port `6543`, database `postgres`, and TLS `sslmode=require`. Do **not** infer or guess the pooler hostname from the project's region or its direct database hostname.

The app uses a scoped login role `flames_public_submitter` with only the required read-free `EXECUTE` permissions for `flames.ingest_attempt` and `flames.record_feedback`. Public session deletion is disabled at the HTTP route and DB execution layer. Lawful removal requests must be handled privately by the FLAMES operator. Database credentials remain encrypted in Vercel; never paste them in source code or messages.

RLS denies direct table access. The start button follows a prominent, plain-language storage notice and explicitly submits both entered names and the calculation for testing; it does not silently record activity before the visitor starts the game. The privacy section describes private operator control and lawful removal requests rather than exposing a public delete button. Names expire after 30 days and other research records after 90 days. If the backend is unavailable, gameplay stays functional while the attempted submission is reported as unavailable. An appropriate privacy and legal review is required before unrestricted public promotion.

Use Node.js 22+. Run `npm run check`, `npm test`, and, with a local server on port 8765, `node test/browser-smoke.mjs`.
