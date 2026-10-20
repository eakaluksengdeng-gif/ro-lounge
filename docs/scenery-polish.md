# Cohesive scenery pass

Scope: all five maps and existing activity interfaces audited against the village's warm wood, mossy stone, cyan water and crisp raster palette. Existing character, cat, card-table, fishing and cafe art is retained. This is a visual pass, not a new gameplay system or a save reset.

Changes:
- Farm's flat cyan ellipse is replaced by a low moss-stone water well, wooden bucket and ripple detail at the same `farm-water` interaction. The prompt shows current personal water; the existing server-confirmed refill gets a small water sprite cue (static/fading safely with reduced motion).
- Forest's rectangular waterfall/capsule river is replaced by textured natural banks and an original rocky waterfall sprite. Existing water collision, bridge and interaction coordinates remain unchanged.
- Farm soil is centered on all six actual `FARM_PLOTS`, including the greenhouse's front plots, not independent decorative guesses.
- Farm gets its own cottage instead of reusing the Boardgame building. Market outfit exchange uses an existing matching stall.
- Fishing signs use the village's existing wooden plank artwork instead of flat cream rectangles.
- Beach has a small textured scalloped wet-sand/foam edge, without moving the original walk/fishing boundary.
- Personal water in inventory uses the existing pixel tool-water artwork instead of a platform emoji. Other existing raster UI remains intact.

## Image generation and assets

Built-in imagegen was used, with actual alpha output. Original outputs are copied without deleting the generated originals into `client/art-source/scenery-v1/`. `client/scripts/prepare-scenery-art.mjs` alpha-cleans faint halos, trims transparent margins, and nearest-neighbor exports the final three sprites to `client/public/art/scenery-v1/`. Original assets are not overwritten. Runtime manifest is predecoded with the existing asset pipeline.

Final files: `scenery-well.png`, `scenery-waterfall.png`, `scenery-farmhouse.png` and `manifest.json` in that public directory.

### Final prompts

Well:

> Use case: stylized-concept. Asset type: single transparent-background game scenery sprite for Clover Nook cozy pixel-art top-down village RPG. Draw one charming small LOW OPEN STONE WATER WELL / water collecting basin, with irregular rounded beige mossy stone blocks, jewel turquoise rippling water, a small warm wooden bucket resting on rim, tiny rope coil, two tiny white daisies and grass at base. No roof, no tall beam, no characters. 3/4 top-down orthographic view matching 16-bit richly shaded village pixel sprites, crisp pixel clusters not smooth vector or photoreal, dark warm outlines, soft moss greens beige stone warm brown wood. Object footprint wider than tall, all visible, centered, ample empty transparent margin. Water opening must clearly read as usable water collection point. Isolated one object only, no ground tile, no scenery background, no labels/text, no UI, no watermark. Genuine alpha transparency.

Waterfall:

> Use case: stylized-concept. Asset type: single transparent-background game scenery sprite for Clover Nook cozy pixel-art top-down village RPG. Draw one charming narrow natural WATERFALL with a short rounded mossy boulder ledge at its top and bright turquoise flowing water falling downward, delicate white foam streaks and small shallow foamy splash at bottom. Compact vertically elongated sprite height about 2.2 times width. 3/4 top-down orthographic view matching richly shaded 16-bit cozy village pixel art, crisp readable pixel clusters, dark warm outlines on rocks, grey-green rounded mossy boulders with 2 tiny daisies, luminous cyan water. Entire isolated waterfall visible centered, empty transparent margin. No wide river, no island, no landscape backdrop, no text, no UI, no characters, no watermark. Genuine alpha transparency. Shape organically uneven not a rectangular slab or blue capsule.

Farmhouse:

> Use case: stylized-concept. Asset type: single isolated transparent game scenery sprite for Clover Nook cozy pixel art village. One adorable SMALL FARM COTTAGE viewed from 3/4 overhead orthographic angle, burgundy plum tiled sloping roof, warm beige stucco and timber walls, teal-blue arched front door, two small glowing amber windows, short wooden doorstep, small flower planters and ivy and pumpkin basket at base. No signboard, NO TEXT, no boardgame imagery, no people, no cat. Richly shaded 16-bit pixel-art clusters with clean warm brown outlines matching lush cozy village RPG scenery, crisp pixels not smooth vector, square-ish building footprint. Entire cottage fully visible centered on genuine transparent alpha background with generous clear margin. No landscape backdrop, no ground tile, no UI, no watermark.

## Verification

`scenery-polish.e2e.mjs` checks hard alpha/transparent margins, all non-town maps in actual Phaser, the unchanged water-node anchor, reduced-motion refill cue and missing assets. Direct-farm, menu and hat regression tests protect existing interaction and avatar behavior. Production acceptance uses fresh isolated QA Guests only; no real player's items, balance or saves are touched.
