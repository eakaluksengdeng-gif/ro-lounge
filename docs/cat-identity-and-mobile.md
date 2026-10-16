# Unified cats and mobile sprite scale

All live cat walking/rest textures now originate in ONE model sheet: orange tabby stripes, cream muzzle/chest/paws, blue collar and gold bell. The original calico walk frames and unrelated rest set are no longer used for live cats. Three coat variants share all six canonical poses. A single fur palette is applied per individual; non-fur pixels remain unchanged. Cat feet share the same baseline, with one preparation scale for all poses (sleep does not inflate to square height). Farm aliases and Boardgame decoration use this model. Fishing uses a small generated dock-cat edit; all pixels outside the 72×76 edit rectangle are preserved from the original cove.

Character composition also aligns short heads by their chin rather than image top and joins the neck behind head/shirt. Mobile preview uses integer 2× pixel scale, desktop 3×, instead of fractional enlargement. No server, wallet, inventory or save changes.

On phones up to 540px, the bag button is part of the upper navigation panel rather than a floating button over the last emotes/chat. `mobile-hud-layout.e2e.mjs` verifies no intersection, no horizontal overflow, and working five-slot inventory at 320/360/390/430/540 plus landscape.

## Generated assets and reproducibility

Mode: built-in imagegen, not CLI/API fallback. Identity reference: `client/public/art/season-v1/cat-sit.png`. Fishing edit target: `client/public/art/activity-v2/activity-cove.png`.

- Workspace source atlas: `client/art-source/cats-v2/cat-identity-atlas.png`.
- Workspace fishing edit: `client/art-source/cats-v2/dock-cat-edit.png`.
- Prepared assets: `client/public/art/cats-v2/` (six alpha sprites, one cove image, manifest).
- Preparation: `node client/scripts/prepare-cat-art.mjs`.
- Original built-in outputs retained: `exec-8b473667-6cc2-4d2c-80a5-9685edc2eec0.png`, `exec-7383916b-6ca0-4095-95c2-53d702ebcae6.png` under `/Users/eakaluksengdeng/.codex/generated_images/01a11e8a-82c6-72c0-b731-340190a50a40/`.

### Exact atlas prompt

```
Use case: identity-preserve. Asset type: production transparent pixel-art animation atlas. Reference image is the identity reference for ONE orange tabby cat, not a backdrop. Create exactly SIX complete sprites of the SAME cat, precisely 3 columns and 2 rows, generous transparent padding between sprites, no overlap, no text, no labels or watermark. Top row left to right: walking side view right with left legs forward; walking side view right with right legs forward; sitting facing front. Bottom row left to right: sitting grooming a front paw; stretching with front legs low and tail up side view right; curled sleeping side view. LOCK IDENTITY across ALL SIX sprites: orange tabby coat, three dark brown forehead stripes, dark orange back/tail stripes, cream muzzle and chest and paws, pink inner ears and nose, blue collar with tiny gold bell, same chibi head-to-body ratio, same round face. NO black/calico patches, NO white body replacing orange. No accessories changing or disappearing. Walking and resting must unmistakably be one individual cat. Crisp chunky 16-bit pixel art matching reference, dark warm pixel outlines, warm shading. Equal perceived head size in all poses, whole bodies within cells, sprites centered on a common foot baseline for each row. Real alpha transparent canvas, no ground shadows. Single coherent model sheet, not six different cat designs.
```

### Exact fishing edit prompt

```
Use case: precise-object-edit. Image 1 is the EDIT TARGET fishing cove pixel-art scene. Image 2 is an IDENTITY REFERENCE for the cat only. Change ONLY the small cat sitting on the wooden dock at approximately x620,y255 in the 720x540 scene. Replace that calico/white cat with the SAME orange tabby as image2: warm orange coat and dark orange tabby stripes, cream muzzle/chest/paws, blue collar with small gold bell, pink nose and inner ears. Keep the cat seated at the exact same dock location and same approximate 56x65 pixel footprint; face front. Preserve EVERYTHING else exactly: camera, framing, wooden dock planks and pillars, bucket, ropes, seagull, water, shores, flowers, rocks, colors and pixel textures. Do NOT add any characters or props. Do NOT change dock geometry or move the bucket. Keep the pixel-art style and 4:3 layout. No text.
```

## Verification

- `cat-identity.e2e.mjs`: canonical walking/rest mapping, all 6 poses × 3 coats, fur-only palette changes, fixed foot baseline, unique animation frames, zero modified fishing pixels outside cat rectangle. Visual model sheet screenshot inspected.
- `mobile-sprite-scale.e2e.mjs`: no neck gap across 486 combinations; aspect ratio/integer pixel scale/no horizontal overflow at 320/360/390/430 and 844×390 landscape; pigtail preview inspected.
- Existing cat-coat, character creator, wardrobe, table and activity layout browser tests and production build.
