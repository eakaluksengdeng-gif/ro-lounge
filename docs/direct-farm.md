# Direct map farming

Farming no longer opens a modal. Walk within 100px of an actual crop anchor to see a compact anchored tool strip. Empty plots offer three illustrated seed buttons; unwatered plants offer one water action; watered plants show the remaining server-time growth duration and become harvestable at maturity. E focuses seeds or performs the available water/harvest action. Walking away, changing maps, entering Boardgame or opening another panel hides the strip without freezing movement.

The strip includes private water stock and an owner selector for permitted helper watering. Only owners can plant/harvest or change help permission; helpers use their own water. Selecting another owner changes the actual crop sprites to match that garden. All six plot anchors (including greenhouse) are shared between renderer, controls and server. Server accepts validated real plot proximity in addition to the existing central farm interaction radius for compatible clients. No crop data, inventory, chip balance, saved growth time or water amount is reset.

Non-game canvas clicks (including illustrated seed buttons) are excluded from map navigation. The old full-screen farm menu implementation was removed. Countdown text updates without rebuilding the open owner dropdown each second.

Checks: client `direct-farm.e2e.mjs` tests seed/water/harvest/E, nonmodal movement, friend owner selection, water0, greenhouse and 320–1200px; server `direct-farm.test.ts` checks actual plot0 outside legacy central radius, private water, owner-only harvest, distant spoof and replay. The full cozy live browser loop now uses real inline planting/watering/harvest before cooking and picnic.
