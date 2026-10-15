# Reference art overhaul

The user explicitly selected the original detailed RO Lounge world/UI concepts as the actual game art target, including characters and terrain. This is a full raster asset replacement, not another basic-color reskin.

## Scope

- Generated chibi character animation and hairstyle assets, shared by creator, live avatars, cosmetic previews and player portraits.
- Generated terrain materials, trees, foliage, buildings, furniture, water/shore details, wildlife and collection/food icons across all five maps.
- Warm wood/cream/gold UI assets for creator, HUD, Boardgame, fishing, collection and cooperative cafe.
- Maintain authoritative movement, collision, private cards, wallets, inventory and persistent sessions; no reset or schema change.
- Verify actual gameplay rendering and mobile before publishing. A spritesheet preview alone is not completion.

## Generation

Built-in imagegen is used. Original concept images are available under the earlier design artifact folder. Generated sources are retained under client/art-source/reference-v1; runtime assets go under client/public/art/reference-v1.

### Character animation prompt

```
Use case: stylized-concept.
Asset type: production transparent character-animation spritesheet for the existing RO Lounge 2D top-down multiplayer game.
Input images: the three recent user images are STYLE REFERENCES ONLY: RO Lounge cozy world and six UI panels. Match the cute chibi people in their CHARACTER, TOWN and CAFE panels closely. Create an original spritesheet, not another mockup or screenshot.
Primary request: a perfectly regular 3-column by 6-row sheet of 18 individual full-body pixel-art animation sprites. Every equal-sized cell contains precisely one character, centered horizontally, feet at the same baseline. Generous transparent spacing separates all cells; no dividers, no labels, no text.
Rows, in exact order:
1 male novice facing camera: idle, left step, right step.
2 the SAME male facing right: idle, left step, right step.
3 the SAME male facing away: idle, left step, right step.
4 female novice facing camera: idle, left step, right step.
5 the SAME female facing right: idle, left step, right step.
6 the SAME female facing away: idle, left step, right step.
Character style: the reference's big rounded brown hair, large expressive dark eyes, tiny smile, softly pink cheeks, small cute body, detailed collared novice jacket with cuffs and a small golden button, brown boots. Male short tousled hair and trousers; female neat bob hair, blouse bow and a pleated skirt. Both use LIGHT CYAN clothing (#78d9ec), fair peach skin (#ffdcc0), dark chestnut hair (#3b2a20), navy bottoms (#3d4a7a), allowing later palette swaps in the game. Keep those four materials clearly separated. Two-heads-tall chibi proportions, true detailed crisp 16-bit JRPG pixel art, outlined clusters, 3–4 shades per material. Match the reference, not simple block stick figures, not flat vector, not painted realism or 3D.
Composition: tall rectangular sheet, equal-cell grid 3 columns x 6 rows, orthographic top-down RPG character camera showing faces/front and actual backs, identical scale and anchor throughout. All hands, hair and boots inside their own cell. Alpha-transparent empty background. NO ground, NO shadow under feet, NO scenery, NO UI, NO watermarks. Animation changes only arms and legs; preserve facial identity, clothing details, silhouette and head positions. Assets will be sliced and used in Phaser with nearest-neighbor sampling.
```

### Alpha preparation prompt

```
Use case: background-extraction. Edit target: the generated 18-sprite RO Lounge character sheet. Keep ALL 18 characters at their exact current positions, scales, shapes, clothes, facial identities and walking poses. Preserve the exact 3-column / 6-row arrangement and the full canvas dimensions. Remove ONLY the smoky brown/gray glow, vignette, shadows and every background pixel surrounding the sprites. The spaces between sprites must be truly alpha 0, and each character's colored pixels must be fully opaque alpha 255, with crisp pixel-art boundaries, not semi-transparent. Do not redraw or rearrange characters. No labels, no ground, no shadows, no halo. This is a production sprite sheet to place over grass and stone in a game, not a presentation image.
```

## Status

- [x] Inspect rendering architecture and selected references.
- [x] Generate matching male/female animation source and retain project copy.
- [x] Prepare and validate frame alignment and transparency.
- [x] Generate remaining character/environment/UI asset families.
- [x] Replace all game surfaces and integrate rendering.
- [ ] Regression tests, live publication and visual verification.

## Implemented

140 sliced production PNG assets, plus a shared-asset creator courtyard and two generated inn/kitchen interiors. All generated originals are retained, with reproducible conditioning via `cd client && npm run art:prepare`. Prompts are in `docs/reference-art-prompts.md`; asset inventory is `client/public/art/reference-v1/manifest.json`.

- 18 walking frames and 18 modular directional heads. Male/female appearance options keep their saved indices; palettes really change sprite pixels.
- Shared 48×64 renderer for creator, world avatars, shop, Boardgame portraits and café members; original 54×72 world footprint/feet anchor retained.
- Existing five map layouts composed from detailed raster grass, forest, paving, soil, water, beach and wood, with matching cottages, greenhouse, fountain, foliage, furniture and market stalls. Navigation/trigger/collision coordinates unchanged.
- Animated raster cats, rabbits, butterflies, bees and ladybugs, preserving server behavior and weather.
- Generated collection/fish/food/gear icons, wood/leaf/parchment UI, actual 8-seat oval table and private animated hands, team café interior with actual member avatars, category tabs and a raster-ground minimap.
- Explicit conversion of server RGB shirt color versus creator palette index, covered by a regression test. No schema, persistence, chip grant or server changes; no backend restart needed.

## Verification

Server: 56 tests and TypeScript passed. Client: build/typecheck, reference asset tests, character creator, 52 card faces/readable amounts, table/private-hand animation and responsive layout, casino repeated rounds/payout/exit, wildlife/weather/fishing reward/gauge, quiet music/effects, and five-map ownership/café/collection/persistence browser tests were exercised. Final browser rerun and live release check are tracked below.

The reference asset test verifies all 140 raster assets decode without missing requests, every appearance option changes pixels, creator and wire colors produce identical sprites, alpha transparency and unchanged world footprint. Browser screenshots are inspected, including 320/390px layouts. Final visual fixes prevent atlas roof pixels leaking into water and preserve cottage aspect ratios.

