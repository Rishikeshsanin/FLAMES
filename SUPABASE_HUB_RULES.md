# FLAMES — Supabase Project Hub Contract

- Project Hub ID: `nowlwprtcnieihelqjoa`. Shared with other independent apps.
- App slug **must** equal isolated schema name: `flames`.
- Read `hub.read_me_first`, verify `hub.apps` registry entry and `hub.assert_app_scope('flames','flames')` before database writes.
- Use `flames.*` fully qualified table names. No application tables in `public`.
- Every table must have RLS enabled and prevent browser anonymous direct access.
- Use app-prefixed edge functions such as `flames-research-api`.
- Never use the hub-admin service-role key in frontend or ordinary backend code.
- Never modify other app schemas, global Auth/OAuth, project settings, shared storage, roles, passwords or keys.
- Use explicit consent for names and a separate opt-in for anonymous analytics. Limit retention; support deletion.
- Record only own resources in `hub.app_resources`. Do not cross app schema boundaries.
- Run and inspect security advisors after database changes.
