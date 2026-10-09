# Character-creator courtyard

Current background: [cute low-resolution pixel courtyard](character-courtyard-pixel.md).
The source and prompt below describe the previous detailed illustration, retained for recovery.

Generated using the built-in image generation tool; an original pixel-art fantasy village,
not a copied Ragnarok game asset.

- Source: `character-courtyard-source.png`
- Web asset: `client/public/art/character-courtyard.jpg` (768px JPEG for fast first-page loading)
- Hair/clothing thumbnails and the rotating live character use the game's shared pixel renderer
  in `client/src/art.ts`, not illustrative AI avatars.

Final generation prompt:

Use case: stylized-concept. Asset type: background illustration for a browser pixel-art multiplayer game's character creation preview. Primary request: an original nostalgic Korean fantasy MMORPG-inspired tranquil village courtyard, crisp pixel art, no copied game assets. Scene: warm cream stone courtyard with a small round fountain in the middle distance, a few cozy timber houses, green trees, pale blue sky and distant mountains. Composition: landscape 3:2, main center/lower third an EMPTY circular cream-stone plinth for a character sprite to be overlaid in code, leave that plinth unobstructed, village and fountain behind it. Soft inviting morning light, restrained pastel greens/teal and muted brown, readable low-detail center, finely crafted pixel-art scene. Constraints: no characters, no people, no text, no lettering, no logo, no UI, no frames, no watermark. Intended to sit behind a very small pixel character at 5x nearest-neighbor scaling.
