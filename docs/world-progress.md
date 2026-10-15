# Cozy World expansion — implementation checklist

Cozy World was released through PR #15 on 2026-10-14 and finished through PR #16 on 2026-10-15. The user approved the one-time replacement of legacy memory Guests and Supabase Free, confirmed Render My Workspace, and entered both server environment variables privately. Production serves cozy-world-v1 with durableStorage:true. Explicit live restart/resume assertions passed and the non-secret result report is retained locally; interrupted output was not used as proof.

- [x] Durable Guest/wallet/fishing/progress snapshots; local, protocol and live Supabase saves verified.
- [x] Five maps, verified edge transitions, shared identity, map-local chat/wildlife.
- [x] Forest bugs/mushrooms/rare animals/campsite.
- [x] Farm crops/offline growth/watering permissions/greenhouse/feeding.
- [x] Beach fishing/shells/treasure/cleanup/boat rides.
- [x] Market cooperative cafe/cosmetic shop/music stage.
- [x] Inventory/collection/cosmetic rendering and unified pixel UI.
- [x] Weather/daylight/biome ambience; maintain original music controls.
- [x] Regressions: creator, poker, fishing, wallets, private cards and mobile.
- [x] New unit/transport/browser tests: permissions, replay, persistence, maps and co-op.
- [x] Live Supabase non-destructive migration, restricted privileges, atomic save/retry/stale-writer SQL verification (transaction rolled back; empty snapshot unchanged).
- [x] Deploy and verify live UI/API, two-player play, database saves and mobile.
- [x] Explicit live restart/resume assertions and retained result report.

## Verification evidence

- Full real browser test passed: actual walking among all five maps, 2 Guests, inventory, crops/help/greenhouse/feed, boat, 2-player visual cafe, cosmetic exchange/equip, music, collection 1280/768/390/320px, reduced motion, disabled storage join and reload identity/progress.
- Existing casino browser flow passed: private cards, repeated rounds, payouts, refresh and queued exit.
- Existing nature/fishing and sound browser flows passed.
- Table, creator and card visual/browser regressions passed.
- Server baseline and new world/transport tests passed; navigation and lost-save-response tests added for the final verification run.
- Latest server typecheck and all 55 tests passed, including real-socket cloud save-barrier checks for wallet:sync and auth:sync.
- Final terrain follow-up: visible forest stream and walkable bridge share server/client collision; server typecheck and all 56 tests passed. Black-box live QA now retains a non-secret result report when RO_QA_OUTPUT is set.
- Final production build and all eight browser suites passed after visual polish: world, creator, table, nature, sound, music-live, casino and cards. Production bundle contains no DEV scene hook.
- Additional production-compatible black-box browser preflight passed locally: only real UI clicks, five maps, actual catch/non-default wallet, crops, 2-player cafe, cosmetics, four viewport sizes and identity/progress after reload. No DEV hook or privileged test API.
- Live Supabase Data API with a valid public key rejects both private table reads and save RPC (42501); migration tests left the empty snapshot at revision 0.
- Cloud advisors: no performance issues; one informational RLS-without-policy notice is intentional deny-by-default. Browser roles have neither table nor RPC privileges; only service_role can read/update/execute and cannot delete. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.
- Production black-box browser play reached the restart checkpoint with five maps, a real catch/non-default wallet, watered crops, two-player cafe, earned chef outfit, inventory and four viewport sizes. Separate production WebSocket tests created an isolated poker table and verified two automatic rounds, private unique cards, zero-sum payouts, queued exit and resumed wallet.
- Live creator and quiet music tests passed again on 2026-10-15; no autoplay, single mixer, independent/global mute and 390/320px settings.
- Final live restart/resume passed on 2026-10-15 at 00:24:33 UTC after automatic Render deploy dep-db81poh42hec73bqn9j0 (runtime commit d1fbe710cdadbbd634e21d55cf56a78be4595436). The same Guest retained its actual 104-chip catch balance, earned chef hat, forest/beach inventory and watered carrot plot; zero page errors. Retained report: client/data/cozy-release-20261015/result.json (gitignored; no bearer credentials or API keys).
- Production /health returned 200, /version confirmed cozy-world-v1 and durableStorage:true, Vercel status was successful, and recent application error logs were empty. Actual local browser traversal also verified the final visible forest bridge and shared collision.
- New pixel art is code-native and consistent with the existing runtime, not the generated overview as a flat collision image.
