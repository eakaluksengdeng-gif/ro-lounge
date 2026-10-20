# Avatar hat fitting

The side head is not narrower than the front head. Fitting a 38px inventory hat over a full-width head exposed upper hair around its crown. Hats now use a 44px side / 46px front fit (chef 42/44), alpha-trimmed from the existing original art. The chef crown remains within the canvas instead of being cropped 9px above it.

`renderCharacterCanvas` accepts an optional headwear ID. Only pixels above row 17 outside the fitted hat silhouette are tucked away. All face, side hair, neck and body pixels at rows 17–63 remain identical. Removing the hat uses the original untouched head texture. Original bitmap assets are not edited or replaced.

Live character texture keys include the headwear ID, so changing or removing a hat cannot reuse a stale capped/bare head. The separate equipment overlay still uses the same canvas/foot anchor. Wardrobe, fishing, seated Boardgame, cafe/home avatars and shop previews pass the same headwear to the shared base renderer.

Verification: `hat-fit.e2e.mjs` checks all five hats, two genders, three hairstyles, three directions, and supported standing/seated/fishing/cafe poses (360 combinations), unchanged lower pixels, and 450 distinct cached textures. Mobile neck/scale, wardrobe layout and private-card Boardgame regressions are also checked. Server ownership, save data, item stock and wallet logic are unchanged.
