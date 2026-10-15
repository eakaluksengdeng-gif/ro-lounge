# Inventory and discovery journal

Two separate views over the existing server-owned data. No migrations, resets, client-side item grants, new sale/drop endpoints or changes to balances.

## Inventory: what you currently hold

- Positive physical stacks only: fish, insects, mushrooms, shells/pearls/treasure, crops and cooked meals. Zero/spent entries and undiscovered placeholders never appear. Furniture ownership is separate, in the home workshop.
- Backpack badge is the sum of these actual quantities, not the number of discoveries or activity achievements.
- Search, category filters and name/quantity sorting are read-only. Empty bags and empty search results have distinct guidance.
- Selecting a stack displays the real quantity and relevant unowned cosmetic recipes. Ingredient availability comes from current authoritative counts; exchange still requires visiting the market and the existing server checks.
- Water is a separately labelled personal resource. Owned outfits have their own expandable equipment section; locked outfits are not presented as owned. Equipping still goes through existing ownership validation.

## Journal: what you have ever discovered

- Persistent discoveries remain after a physical stack is spent. Found entries have a check mark; unseen entries have a silhouette. There are no misleading `× 0` stacks.
- Filters distinguish all/found/missing records. Item details distinguish historical discovery from current holding.
- Snow-rabbit encounters, animal friendship, cleanup, cafe, music, boat and camp records belong to the journal, not to physical backpack stacks. Existing activity counters/tokens are not deleted or changed, including those used by market recipes.
- Fish may now be consumed by orders, museum donations, fish soup and aquarium crafting. The server maintains additive `fishDiscoveries` history independently from actual fish stock, so using the last fish never erases journal discovery. No discovery is invented from browser storage.

Verification: `node test/inventory-journal.e2e.mjs` from the client directory checks spent-but-discovered items, positive physical counts, badge exclusion of activity records, real fish, search/filter/sort, recipe hints, owned-only gear, empty bags and 1200/768/390/320px layouts. Existing gathering/fishing/table/cafe regression is preserved. The black-box `test/cozy-collection.live.e2e.mjs` also checks the real empty bag versus journal, catches an actual roaming bug, confirms separate holdings/discovery views, and reconnects without losing the stack or changing chips.
