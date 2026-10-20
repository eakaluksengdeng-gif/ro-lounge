# Clover Nook launch

Public name: Clover Nook. Primary origin: `https://clover-nook.vercel.app`. Existing origin `https://ro-lounge.vercel.app` remains live without redirects, so old browser credentials remain usable. Both are production domains on the existing Vercel project `prj_LXpUjMcfusc6uKythZNJtQLAwAb8`. No paid domain, new project, database, wallet reset or server change.

## Brand and wayfinding

- Title, creator header, map menu, metadata, canonical URL, favicon and town welcome sign use Clover Nook.
- The town keeps one 44×27 wooden community work-board marker, instead of four repeated activity plaques. Its decorative feet avoid blocked terrain; gameplay coordinates/collision remain unchanged.
- Repeated floor captions on other maps and fishing instruction captions are removed. Buildings and exit signs retain useful wayfinding.
- Nearby activities menu lists the current map's real activities, shows explicit navigation or interaction based on the same 100px range, and never teleports, rewards, plants or spends resources merely for opening/navigating. Server checks remain authoritative.
- The main village menu groups inventory, collection, orders, home/furniture, community, museum, nearby activities, map and audio settings. Mobile shows only Bag + Menu in the upper toolbar; desktop retains navigation shortcuts. Minimum 44px action targets retained.
- Orders and furniture catalogues are read-only from anywhere: current ingredient counts and real recipe/reward data come from shared definitions and the authenticated world profile. They never spend resources or claim rewards. Same-map selection walks to the original node; other-map selection opens the map. Actual operations remain at the real node with unchanged server authorization.
- Menu supports M/Escape, keyboard focus containment and return to the opener. Audio settings use the existing sound engine and stored preferences, not a second music loop.

## Character transfer across origins

Browser storage is origin-scoped. Server save persistence alone does NOT move a guest credential to another domain. Legacy technical storage keys are intentionally kept unchanged.

- From the old login page, the user-clicked move button opens the new origin; a nonce/source/origin-checked postMessage handshake transfers a whitelist of guest session, display name, appearance and audio preferences.
- From a direct visit to the new origin, the recovery button opens the old origin's dedicated top-level `move-player.html`. The user must explicitly confirm there. This avoids relying on third-party iframe storage, which can be partitioned/blocked on phones.
- Credentials never enter URLs, redirects, analytics, logs, DOM text or query parameters. No wildcard postMessage target is used in application code.
- Different existing new-domain credentials require confirmation and a recoverable local backup before replacement. Cancellation keeps them unchanged. Source credentials are never deleted. Invalid snapshots/blocked storage display an error rather than resetting a player.
- Provider requires the exact new origin, exact opener, UUID nonce and a top-level window. Main receiver checks exact legacy origin, expected peer and nonce. Unknown keys are never copied.
- Transfer HTML gets no-store/referrer policy, frame denial and self-only script CSP. No network/backend actions occur in the provider.

## Verification

- `clover-village.e2e.mjs`: new brand; four real nearby town activities; distant selection only navigates; nearby selection opens the correct activity; compact landmark sizes without floor text; 1200/768/430/390/320 layouts.
- `player-transfer.e2e.mjs`: production bundles under two isolated HTTPS origins mapped to local preview; old→new preserves identity/appearance/preferences and source; direct recovery; decline/accept with backup; origin/nonce rejection; whitelist; credentials absent from every request URL. No real credentials used.
- Existing creator, toolbar readiness, mobile HUD, direct farm and table regressions; production build outputs both entry pages.
- `village-menu.e2e.mjs`: nine destinations, six viewport sizes, only two mobile toolbar buttons, read-only previews/no world actions, near/far/cross-map routes, persisted audio, M/Escape and focus restoration.

Production acceptance must check both domains and actual resume (same wallet/inventory), provider response headers, new branding and nearby navigation before announcing completion.
