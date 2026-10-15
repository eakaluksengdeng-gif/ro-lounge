# Cozy season update

Additive content update: no resets, wallet changes, schema migration or free material grants.

- Seven free seeds at existing inline plots. New: eggplant 105s, strawberry 75s, corn 110s, pumpkin 150s. Original durations unchanged. All seven crops have their own four botanical visual stages using server time; ripe requires watering. Carrot has feathery tops, tomato yellow flowers, wheat green ears turning gold.
- Four permanent torso outfits exchanged at the existing market shop using real harvested ingredients. Server price/ownership/proximity/confirmation checks; saved receipt prevents repeat spending. Existing quest equipment unchanged.
- Hat alpha padding removed before head anchoring. Direction-dependent fit shared by live avatars, wardrobe, cards, fishing and cafe portraits. Hair remains visible around brim; no full hair removal.
- Six pixel emotes replace platform emoji in the tray and overhead. Existing server whitelist and map-scoped routing unchanged.
- Authoritative farm watering transition triggers a pixel can and droplets. Reduced-motion setting uses a static short can indicator.
- Cats choose sit/groom/stretch/sleep pauses on the server, then resume bounded walking. Sleep lasts longer and does not meow. Decorative farm cat cycles the same poses. No catch/currency changes.

## Art provenance

Generated using built-in imagegen, original cozy pixel art inspired by user style references, not copied from watermarked clothing. Originals preserved under Codex generated_images. Workspace originals: `client/art-source/season-v1/{crops-atlas,classic-crops-atlas,cozy-atlas}.png`. Prepared alpha assets: `client/public/art/season-v1/` (44 PNGs + manifest). Rebuild with `node client/scripts/prepare-season-art.mjs`. Crops/clothes/cats retain largest connected alpha component to remove adjacent atlas fragments. Emotes and water keep disconnected details.

Original crop output: `exec-a81ad039-ccbf-40fd-8598-e684d17430ab.png`.
Original cozy output: `exec-08b06c30-a11e-438b-bebd-fec4c8b20028.png`.

### Exact generation prompts

```
Use case: stylized-concept. Asset type: transparent pixel-art game sprite atlas for a cozy top-down village RPG. Original artwork, no copied artwork, no text, no watermark. Exactly 4 columns and 4 rows, equally spaced square cells on a transparent 1024x1024 canvas. Each cell has generous transparent padding; no overlapping cells. All sprites bottom centered at same baseline. Each row is one crop in four distinct growth stages left to right: tiny sprout in dark soil, young leafy plant, flowering/immature plant, fully ripe plant. Row 1 purple eggplant growing beside wooden stake; row 2 red strawberry bush; row 3 golden corn stalk; row 4 orange pumpkin vine. Clear chunky pixel clusters, dark warm outlines, 16-bit hand-painted pixel art, lush green leaves, warm cute aesthetic. No pots or UI. Species visually distinguishable. Full grown stage more abundant, not merely scaled. Consistent front/top-down three-quarter camera. Transparent background.
```

```
Use case: stylized-concept. Asset type: transparent pixel game atlas for original cozy village RPG. Exactly 4 columns x4 rows in 1024x1024, equal square cells, generous transparent margins, no overlap, no labels, no text, no watermark. Row1 four separate wearable torso clothing icons without bodies or heads: cream cable-knit sweater, moss green hoodie with small leaf embroidery, warm orange raincoat, berry red winter cardigan. Front-facing symmetrical, sleeves visible, designed to dress a chibi character. Row2 four pixel emote icons: happy smiling yellow face, sad teary yellow face, bright pink heart, friendly waving hand. Row3 four pixel icons: angry red face, sleepy blue face with closed eyes, blue watering can tilted pouring droplets, blue water droplet. Row4 the SAME original cute orange tabby cat with blue collar in four different poses left to right: sitting upright front view, grooming paw with closed eyes, stretching forelegs low with tail up side view, curled sleeping with closed eyes side view. Each cat entire body visible, matching colors and size. All assets crisp chunky 16-bit pixel-art with dark warm outlines and cozy highlights, not vector, no blur, actual alpha transparent background.
```

## Verification

Botanical follow-up source: `exec-665745bf-4de9-4e0e-8364-956fcbfc672f.png`, built-in imagegen. Exact prompt:

```
Use case: stylized-concept. Asset type: original transparent pixel-art crop-growth game sprite atlas for cozy top-down village RPG. Exactly 4 equal columns and 3 equal rows on landscape canvas. No text, labels, watermark or UI. Generous empty transparent margins between every sprite, no overlap, each subject fully inside its cell. Left to right four stages: tiny sprout, young leaves, developing crop, fully harvestable crop. Row1 CARROT: two tiny seed leaves, feathery young carrot tops, larger feathery tops, ripe orange carrot shoulders peeking out of soil with lush tops. Row2 TOMATO: seedling, young tomato leaves, yellow star-shaped flowers on leafy tomato stem beside stake, ripe red tomatoes on same plant. Row3 WHEAT: tiny grass sprout, grass-like wheat leaves, green immature wheat ears, ripe golden wheat ears. All plants growing naturally in small dark earth patch, not pots. Same bottom baseline each row; stage1 smallest, stage4 fullest, consistent hand-painted crisp chunky 16-bit pixel art dark warm outlines, green foliage, cozy sunlight, botanical shapes correct. Real alpha background.
```

`server/test/season.test.ts`: all species/stages/water/real stock/reconstruction; server-priced unique tailoring, replay/range/confirmation/forgery rejection, wallet invariant; bounded cat pauses/resume.
`client/test/season.e2e.mjs`: unique stage pixels, hat/outfit angle sheet, pixel emotes/poses, shop prices/disabled states, exchange/equip API, mobile widths.
Existing direct farm test updated to seven seeds and non-emoji watering label. Existing equipment/toolbar/collection/card/fishing tests remain regression gates.
