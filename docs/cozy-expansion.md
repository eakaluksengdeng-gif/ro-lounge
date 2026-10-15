# Cozy village expansion

Adds to the existing durable snapshot, without resets, currency conversion, public database policies, new services or schema changes. The original five maps, Boardgame, cooperative cafe and fishing controls remain.

## Playable destinations

- Town (430,650): home studio, workshop and visits to online friends who opt to open their home. An 8×6 floor editor supports owned furniture only, four rotations, occupied-cell checks and storage/removal without destroying items. Visitors are read-only. There is one stool and one rug as starter home furnishings, not bag materials. This is an interior editor/gallery, not a separate walkable multiplayer map.
- Six real furniture designs: flower pot, shell lamp, stool, picnic rug, aquarium and weekly lantern. First five craft from actual gathered stock; last is a unique permanent festival reward. Limits: 20 owned per craftable type, 48 placements; nothing can be placed in another person's home. Fish used in aquariums retain discovery history.
- Market cafe: four solo recipes use real vegetables, mushrooms, wheat or carp. Preview and confirm before spending; each yields one actual meal and garden XP. Three-second server cook cooldown. Existing 2–4 person station minigame remains separate and does not mint free meals.
- Town (1030,650): shared projects, picnic and weekly festival. Three finite shared projects consume one ingredient at a time, max ten contributions per guest per project. Completion adds real decorative props to town/forest/beach without changing collision. No currency rewards.
- Picnic: 1–8 players bring one real meal each; join window 30 seconds, then claim explore XP (+5 solo, +15 with at least two people) and two festival stars. One reward per 24 hours. A 60-second result window separates sessions. Per-player pending session survives reconnect/restart and even newer group sessions; no expiry/lost rewards while offline. It is a hosted timed gathering, not chat auto-play.
- Weekly festival: cooking/crafting/contributing gives one star each; claiming a picnic gives two. Ten stars unlock the permanent lantern (never duplicate) plus 20 explore XP; each week's claim is once. UTC epoch week boundary: Thursday 07:00 Bangkok. Only weekly stars reset, never inventory, furniture, skills or chips. There is no attendance penalty or background notification automation.
- Direct gathering gives nature/explore +2 XP; harvest garden +3; a successfully caught fish fishing +3 via an internal authoritative reel hook. Existing order XP and museum rewards are retained.
- Bag adds meals and usage hints for recipes/furniture/picnics. Historical journal still retains consumed objects. Furniture ownership lives separately from consumable stacks.

## Safety and persistence

All new verbs use `world:action` with the existing UUID receipt and durable batch barrier. Server rechecks actor, map, real range, casino status, node, confirmation, whitelist, counts, limits and deadlines. Clients cannot supply trusted quantities, rewards, owners, XP or timestamps. Mixed fish/material recipes preflight all inputs. Replay IDs and saved cooldowns prevent duplicate consumption/rewards. Private-home records are not broadcast unless owner opts in (or to owner).

Added private keys: `townProjects`, `picnic`, `picnicSessions`; additive profile fields `cozy`, `cozyContributions`. Existing guest, economy, fishing, water and progress fields preserved. Supabase remains server-only using the existing JSONB snapshot/RPC. No secret is shipped to browsers.

## Art provenance

Built-in image generation, transparent sprite atlas. Original retained at `client/art-source/cozy-v4/furniture-atlas.png`; six production alpha sprites at `client/public/art/cozy-v4/`. Prepared with `client/scripts/prepare-cozy-expansion.mjs` (non-destructive extraction, alpha trim and nearest-neighbour fit). Existing `inn-interior.png` is reused as the room backdrop to match the game's established art.

Exact furniture generation prompt:

Use case: stylized-concept. Asset type: production pixel-art furniture sprite atlas for RO Lounge cozy top-down social village game. Create ONE square transparent PNG sprite atlas, 3 columns x 2 rows equal cells, six separate centered objects, generous transparent margin in every cell. Top row left to right: flowering terracotta flower pot with pink flowers and leafy sprouts; warm glowing shell-shaped table lamp on wood stand; rounded rustic wooden stool. Bottom row left to right: red gingham picnic rug with cute woven basket; small glass aquarium on wood cabinet with one orange fish and aquatic plant; warm gold and coral festival lantern on short rustic stand. Cute rounded premium detailed 16-bit pixel art, crisp pixel clusters, warm wooden brown, moss green, cream, coral, gold. Camera consistent slightly elevated front/top-down JRPG furniture angle, objects isolated, no environment. Constraints: exactly six objects in grid order, no overlap across cells, no characters, no letters, no labels, no grid lines, no checkerboard, genuinely transparent background. Match cozy illustrated pixel village artwork, not simplistic geometric placeholders.

Four additional real meal sprites are prepared from the retained `client/art-source/cozy-v4/meals-atlas.png`, using the same built-in generator and alpha-preserving preparation script. Production sprites use the `meal-` prefix in the same public directory. Exact meal prompt:

Use case: stylized-concept. Asset type: one production 2x2 atlas of four cozy pixel-art food inventory sprites, genuinely transparent background. Four isolated dishes with generous clear margins, no overlaps. Equal quadrant order: top-left a fresh carrot-and-tomato garden salad in a small wooden bowl; top-right creamy mushroom soup with visible sliced mushrooms and a carrot garnish in a rustic ceramic bowl; bottom-left fish soup with a clear small cooked fish fillet, vegetables and broth in a blue-rimmed bowl; bottom-right two golden crusty picnic bread rolls on a little gingham cloth, clearly bread not wheat. Match premium cute 16-bit cozy JRPG village art: warm cream, terracotta, moss green, soft chunky pixel clusters, slightly top-down view, rich textured highlights, crisp pixel edges. Four objects only, no characters, no labels, no lettering, no solid backdrop, no grid, no watermark.
