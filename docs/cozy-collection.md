# Cozy collection, roaming insects and town garden

## Player controls

- Click the pixel backpack at the lower right or press **B** to inspect inventory. The badge counts actual held items and fish, not historical discoveries. Category tabs, quantity slots and a click/keyboard detail inspector use live server inventory. Unseen entries remain silhouettes; progress uses the real catalogue size.
- Every roaming butterfly, bee and ladybug can be captured by approaching within 100 world pixels, clicking it, or using the nearby **E / tap** action. Cats and rabbits are not captured. Existing forest insects remain collectable at their normal time/weather conditions.
- Captured insects disappear for the collector until their 45-second cooldown expires. Other players keep their own inventories/cooldowns. The request contains only the wildlife ID; server-room entities determine species and current position. Client coordinates, item names, owner IDs and reward quantities are ignored. Duplicate requests, reconnects and cooldowns cannot award twice.
- The fountain has a generated round mossy-stone/flower garden sprite. Rounded plaza corners, low flower islands, reeds, soil beds and waterfall boulders soften terrain without changing movement collisions, fishing shores, doors or exits.

## Persistence and verification

Existing private server-owned Supabase snapshot persistence is reused unchanged. No public key/table grants, schema changes or chip resets. Tests cover all seven roaming insects, real WebSocket species/proximity/forgery/replay/reconnect, inventory reload, native map clicks, backpack/B controls, responsive slots, and unchanged casino/fishing/farm behaviour.

## Image asset provenance

Generated with the **built-in ImageGen tool**, not CLI/API fallback. The source is `client/art-source/cozy-v3/fountain-garden.png`; the game asset is `client/public/art/cozy-v3/fountain-garden.png`, prepared with `node client/scripts/prepare-cozy-art.mjs`. The retained original alpha is trimmed and downsampled with nearest-neighbour preparation. No existing source asset was overwritten.

The same pipeline retains `client/art-source/cozy-v3/water-ripples.png` and produces `client/public/art/cozy-v3/water-ripples.png` (128×128 repeating texture). It replaces the polygon-cell appearance of town/forest pond and beach water without changing shore collisions. Both generated originals remain in the repository.

Final prompt:

> Use case: stylized-concept. Asset type: ONE production game sprite for a cozy 2D top-down pixel village, transparent PNG. A charming small circular stone fountain with bright turquoise water and one delicate upward white water jet, round pale weathered stone basin, surrounded by a compact scalloped island of lush short grass, tiny white daisies and pink flowers, smooth rounded mossy rocks. Three-quarter overhead top-down RPG view, symmetric frontal orientation, consistent 16-bit / high-quality hand-drawn pixel art, crisp pixel clusters and warm soft shaded volumes, gentle forest-green foliage, creamy stone, sunlit storybook mood. Fountain centered with the blue water basin center at image center; only a narrow grass-and-flowers ring outside it. Whole object fits within square image with generous transparent margin; footprint wider than tall, NO scene background, NO ground square, NO people, no animals, NO UI, NO letters, no text. Important small village prop, NOT a giant elaborate fountain. Outer silhouette softly irregular and rounded, not a square, not a hexagon. Real transparent alpha outside isolated sprite. Designed to render at 160x160 game pixels. Match premium cute cozy pixel-game village aesthetic, avoid flat vector, avoid photorealism, avoid jagged large block geometry.

Final water prompt (built-in ImageGen):

> Use case: stylized-concept. Asset type: a SINGLE seamless repeatable TOP-DOWN WATER TEXTURE TILE for a premium cute cozy 2D pixel-art village game. Fill the entire square with clear warm turquoise shallow pond water, gentle tiny horizontal pixel ripple strokes in pale aqua and a few white short glints, subtle soft overlapping curved currents, small variations from teal to luminous cyan. Crisp 16-bit hand-painted pixel art with tiny controlled pixel clusters, calm welcoming sunlit mood, matches lush round leafy trees and cream mossy stone fountain. Entire image is flat surface water only, viewed vertically down. Perfectly tileable all four edges, no directional perspective. Absolutely NO shore, no rocks, no plants, no fish, no objects, no text, no frames. Avoid polygon cells, avoid cracked-ice shapes, avoid stone-like outlines, avoid large geometric tessellation, avoid photorealistic water, avoid vector gradients, avoid dark deep blue, avoid big white foamy areas. Delicate natural ripples, mostly clear blue-green water, visually quiet enough for game background.
