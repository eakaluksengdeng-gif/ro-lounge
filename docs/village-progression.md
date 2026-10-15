# Village progression — first playable release

The first phase connects existing activities to useful destinations without new currencies or resets. No new artwork or unrelated map replacement: the town uses its existing pixel timber signs, ingredient icons, warm cards and owned outfit sprites.

- Order board: town (550,460), left of the fountain. Six permanent recipes for mushrooms, bugs, vegetables, fish and shells. Preview quantities and explicitly confirm actual consumption. Each recipe rests for 24 hours after delivery; there is no expiring accepted quest, attendance streak or penalty for absence.
- Rewards: nature/garden/fishing/exploration XP. Levels use `1 + floor(sqrt(xp/25))`. First completion of selected orders unlocks existing camp/straw/chef/fisher outfits without automatically equipping them. Already-owned outfits are not duplicated. Repeat orders give XP, not another outfit or chips.
- Nature collection desk: town (900,650). Personal permanent exhibit records for seven fish and five insects. Donate one specimen per species once; gain 5 relevant XP. Five species unlock the existing cat hat. This is a desk/gallery UI, not a new explorable museum building or shared public exhibit.
- Existing fishing chip rewards remain untouched. Deliveries and donations never award chips, preventing resale/double chip rewards.
- Inventory contains only actual remaining stock. Fish historical discoveries now have a separate additive `fishDiscoveries` snapshot key, defaulted from legacy positive fish stock. Consuming the last fish preserves its journal record across reconnection/restart. Existing snapshots and balances are retained.
- Server validates identity, real position, node, confirmation, recipe/species whitelist, all ingredients before spending, cooldown and receipts. World and fish writes use the existing serialized durable snapshot batch. No new public SQL grants, secrets or schema changes.

Verification: village unit/real WebSocket tests, mixed-ingredient atomic preflight, replay/reconnect, specimen uniqueness, first-only rewards, historical fish, responsive UI and explicit cancel/confirmation. `client/test/village.live.e2e.mjs` walks the real forest/town loop with an isolated guest, gathers two mushrooms, completes an order, checks stock/reward/journal and reconnects with chips unchanged.

## Subsequent expansion

The originally planned follow-up systems now ship in `cozy-expansion.md`: direct skill XP, personal room editor/visits, actual furniture, shared scenery projects, real meal recipes, group picnic and a weekly festival. The details below document the original first-phase boundary, not current missing features.

### Original roadmap

1. Skill rewards from direct actions and more authored recipes, retaining the same server-owned progression contract.
2. Personal home scenes and real furniture placement: introduce a furniture catalogue and ownership/placement validation before awarding furniture. Do not grant unusable placeholder furniture now.
3. Cooperative town projects: explicit contributions and a shared capped ledger, then visible unlocked scenery and fair participation rewards.
4. Scheduled seasonal events and hosted group activities, with opt-in notifications and no attendance penalties.

No fake housing, festival, meal inventory or public museum world is claimed by this first release. Existing cooperative cafe, farm, fishing, bugs, wallet and Boardgame continue to work independently.
