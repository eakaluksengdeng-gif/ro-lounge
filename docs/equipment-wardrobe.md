# Equipment wardrobe

The bag now has an owned-equipment closet, rotatable real character preview, five loadout slots and a focused equip/unequip inspector. Existing material search/filter/sort, physical quantities and separate historical collection journal remain below. Only owned items appear in the closet; empty slot silhouettes indicate slot types, never ownership. All gear is cosmetic, without chip payouts or gameplay stat bonuses.

## Slots and sources

| Slot | Items / source |
|---|---|
| Head | Existing camp/straw/chef/fisher/cat hats; existing ownership retained |
| Body | Existing cafe apron and new linen apron from harvest order |
| Held | Butterfly net from insect survey; wooden rod from fish soup order |
| Hands | Gardening gloves from carrot order |
| Feet | Woodland boots from forest provision order; beach sandals from shell order |

New order completions grant the matching new unique gear automatically, alongside original XP/first hat. Historical completed orders show a one-time **receive additional equipment** button on the board, independent of their 24h delivery cooldown. No materials are charged again and no XP/chips granted for this historical claim. Repeated deliveries never duplicate unique gear or falsely announce another item award.

## Persistence and authority

Additive `progress.equipment` record uses head/body/held/hands/feet keys; existing `unlocks` remains unique ownership. Missing loadout derives from an owned legacy `equipped` hat/apron; explicit empty loadout stays empty. Existing inventory, wallet, water, quests and cooldowns remain. No database schema, RLS, grants or secrets changed. All writes retain the existing serialized durable snapshot barrier and receipts.

- `equip-slot`: server validates slot whitelist, catalogue slot, actual owned ID; `itemId: none` removes only that slot. Owner IDs and claimed owned flags from client are ignored.
- `quest-gear-claim`: actual board proximity, valid order, historical completion and not-yet-owned reward required. Saved receipts and ownership guard replays.
- Old `equip`/shop entry points remain compatible; the legacy cosmetic string never contains new unknown IDs.
- New public `Player.equipment` schema field sends only the sanitized equipped IDs, never private inventory/unlocks or authentication sessions. Room state is refreshed on action, tick and rejoin.

Rendering composes the same generated layers for wardrobe, map avatars, Boardgame seats, cafe workers and fishing vignette, with pose anchors. Fishing keeps its existing rod pose rather than drawing two held rods. Names/actual appearance use the wire RGB adapter; no random placeholder avatar is substituted for a connected player.

## Art provenance

Built-in image generation, one transparent six-icon equipment atlas. Retained source: `client/art-source/equipment-v1/equipment-atlas.png`. Production: `client/public/art/equipment-v1/equipment-*.png` plus manifest. Preparation: `client/scripts/prepare-equipment-art.mjs`, non-destructive alpha-preserving extraction/trim and 96px nearest fit. The wardrobe reuses the existing generated courtyard backdrop and cream/moss UI palette.

Exact generation prompt:

Use case: stylized-concept. Asset type: ONE production equipment inventory sprite atlas, 3 columns by 2 rows, six equal cells on genuinely transparent background. Exactly six isolated cute cozy 16-bit pixel RPG equipment icons, generous transparent padding each cell, no overlaps. Top-left: a pair of moss-green leather woodland ankle boots with brown soles. Top-middle: a small butterfly-catching net with wooden handle and mint net hoop. Top-right: a pair of sage green gardening gloves with cream cuffs. Bottom-left: a cream linen cooking apron with terracotta neck strap and small green leaf pocket, full garment only no person. Bottom-middle: a little wooden fishing rod with golden reel and curved line, diagonal icon. Bottom-right: a pair of tan woven beach sandals with blue straps. Warm detailed pixel clusters, chunky readable silhouettes, polished cozy village art matching cream/wood/moss-green inventory UI. Slight elevated frontal icon view, boots/gloves/sandals must be paired with left and right pieces visually separable. Constraints: transparent background, no checkerboard, no text, no letters, no labels, no bodies or characters, no scenery, no grid lines. Clean alpha edges, six distinct objects in stated order.

## Verification

Unit and real WebSocket tests cover legacy migration, owned slots, forged flags/owners, invalid slots, old-quest claim/replay and saved multi-slot reconnection. Browser tests cover actual sprite changes, five slots, owned-only closet, equip/unequip, rotation, retroactive quest UI, material/journal regression and 320/390/768/1200px layouts.
