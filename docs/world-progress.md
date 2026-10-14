# Cozy World expansion — implementation checklist

This work is on codex/cozy-world-expansion. The user approved a one-time reset of legacy in-memory Guests to 100 chips and Supabase Free. Connected Supabase project ro-lounge is healthy on Free; Render My Workspace was explicitly confirmed and the existing ro-lounge service verified. User confirmed both server environment variables are saved in Render; the Secret key never entered chat or source. Cozy World production deployment remains to be verified.

- [x] Durable Guest/wallet/fishing/progress snapshots; recovery and failure tests (local file and mocked Supabase protocol, not live cloud yet).
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
- [ ] Deploy and verify live, only after the legacy data/storage choice is resolved.

## Verification evidence

- Full real browser test passed: actual walking among all five maps, 2 Guests, inventory, crops/help/greenhouse/feed, boat, 2-player visual cafe, cosmetic exchange/equip, music, collection 1280/768/390/320px, reduced motion, disabled storage join and reload identity/progress.
- Existing casino browser flow passed: private cards, repeated rounds, payouts, refresh and queued exit.
- Existing nature/fishing and sound browser flows passed.
- Table, creator and card visual/browser regressions passed.
- Server baseline and new world/transport tests passed; navigation and lost-save-response tests added for the final verification run.
- Latest server typecheck and all 55 tests passed, including real-socket cloud save-barrier checks for wallet:sync and auth:sync.
- Final production build and all eight browser suites passed after visual polish: world, creator, table, nature, sound, music-live, casino and cards. Production bundle contains no DEV scene hook.
- Additional production-compatible black-box browser preflight passed locally: only real UI clicks, five maps, actual catch/non-default wallet, crops, 2-player cafe, cosmetics, four viewport sizes and identity/progress after reload. No DEV hook or privileged test API.
- Live Supabase Data API with a valid public key rejects both private table reads and save RPC (42501); migration tests left the empty snapshot at revision 0.
- Cloud advisors: no performance issues; one informational RLS-without-policy notice is intentional deny-by-default. Browser roles have neither table nor RPC privileges; only service_role can read/update/execute and cannot delete. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.
- No main push or production restart. New pixel art is code-native and consistent with the existing runtime, not the generated overview as a flat collision image.
