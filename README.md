# FLAMES 💗

A cinematic, cute, no-account FLAMES experience with one-by-one matched-letter strike animations, honest name variation explorer, and privacy-conscious optional feedback. Run locally with `npx serve .` or `python -m http.server 8000` and visit the root. See GitHub Actions for engine smoke tests.

> FLAMES is a nostalgic game, not a relationship prediction. The application does not have a public history page.

This project is separate from the private [FLAMES_testing](https://github.com/Rishikeshsanin/FLAMES_testing) QA suite.

## Central research API

The same-origin `/api/research` endpoint recalculates all results before calling only approved `flames.*` stored functions using the isolated PostgreSQL role `flames_public_submitter`. It never uses the shared Supabase Data API, a project-wide service-role key, or a browser-side database client.

**Required, not configured yet:** on the existing `flames-love-story` Vercel project, set **encrypted** `FLAMES_PUBLIC_DATABASE_URL` to the **actual** Supabase **transaction-pooler** URL from Project Hub → **Connect**. The custom-role username must be `flames_public_submitter.nowlwprtcnieihelqjoa`, and the application validates pooler port `6543`, database `postgres`, and TLS `sslmode=require`. Do **not** infer or guess the pooler hostname from the project's region or its direct database hostname.

The role is currently created as **NOLOGIN**, with only `EXECUTE` rights on `flames.ingest_attempt`, `flames.record_feedback` and `flames.delete_session_data`. After the legitimate pooler host is supplied, provision a unique role password privately and enable LOGIN through an approved **FLAMES-only** change, then configure the encrypted Vercel variable. Do not paste credentials into GitHub, messages, CLI output, browsers, or README examples.

RLS denies direct table access. The browser must affirmatively opt in for analytics, separately opt in to storing names, and can request deletion using its secret deletion token. Names expire after 30 days and other records after 90 days. Gameplay works locally without submitting anything; if a database URL is unavailable, optional sharing **fails closed**.

Use Node.js 22+. Run `npm run check`, `npm test`, and, with a local server on port 8765, `node test/browser-smoke.mjs`.
