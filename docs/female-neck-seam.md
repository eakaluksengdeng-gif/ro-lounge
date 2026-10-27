# Female neck/collar seam

The previous opacity-only regression prevented transparent gaps, but did not catch the closed outline at the bottom of a generated head overlapping the body's independent neck/collar. Both layers were opaque, so the thick dark band passed that test.

Front-facing female avatars now seat the face three pixels nearer the shirt. The central baked-in lower neck is excluded from the head layer, while side locks remain. A short skin-coloured join opens the duplicated outline without replacing the white collar/tie below row 41. Skin uses the existing palette recolouring. Original source artwork, male avatars, side/back views and foot anchors are untouched.

The fix lives in the shared renderer used by creator previews, walking textures, wardrobe, cafe, seated Boardgame and fishing. Headwear uses its existing crown mask. No inventory, ownership, wallet or save changes.

`female-neck.e2e.mjs` checks the exact skin-colour connection across rows 39–41 in 972 hairstyle/skin/frame/pose/hat combinations (the old renderer fails this), instead of only checking alpha. Existing mobile neck/scale, hat and table regressions remain required. Inspect creator front/side/back and live female avatars before release.
