# Reference-led Boardgame, fishing and café interfaces

User-selected three cropped UI references are the layout targets, not merely texture inspiration. Runtime changes are client-only; card privacy, authenticated casts, balances and cooking rewards stay server-authoritative. No database change or server restart.

## Implementation

- A single Boardgame stage, real seated avatars/chairs, dealer crown, personal animated hand on the table, and bottom wallet / ±10 stake / Draw / Stay / Bet dock. Extra controls/rules remain in an accessible disclosure.
- Sitting fishing poses for every water-facing direction, decorative temporary straw hat only when no equipped hat, mossy shoreline rocks/reeds and a raster dock without changing shore/collision rules. Fishing UI has a live avatar/rod/bobber on a cove scene, actual reward badge, server-timed central-red gauge and a Space / Tap button.
- Café member avatars behind the counter, task bubbles with actual step progress, colored on-counter station buttons, decorative steam tied to the cooking state, and the actual host-only Ready action. Only real members are shown; two players can still work all four stations, no new recipe/reward/role is invented.

Built-in ImageGen generated the following source assets. Originals are retained in `client/art-source/activity-v2`; conditioned PNGs/manifest in `client/public/art/activity-v2`. Reproduce using `cd client && npm run art:activities`. Source silhouettes are cropped/aligned with shared 48×64 character frames and nearest-neighbor filtering. The original reference-v1 asset set remains unchanged.

## Prompt set

### activity-poses

Use case: stylized-concept. Production transparent sprite atlas for the existing RO Lounge game, not a screenshot or mockup. Style references: attached boardgame/fishing/cafe pixel UI; identity reference: existing novice walking sprite sheet. Match the same big rounded heads, little dark eyes, brown tousled/bob hair, cyan collared shirts, navy pants or pleated skirt, brown boots, rich crisp 16-bit JRPG pixels. Strict regular THREE columns by FOUR rows, 12 isolated complete characters, large transparent gutters, no text or ground. Columns consistently FRONT-facing, RIGHT-facing, BACK-facing. Row1 male seated at a gaming table, bent knees, hands resting forward. Row2 SAME male seated fishing on a dock edge, bent legs and hands together holding an invisible rod. Row3 female seated at gaming table. Row4 SAME female seated fishing. Both have cute small visibly bent sitting legs, not standing. No furniture, NO fishing rods/lines in this atlas, no chairs, no hats, no props; these are live separate layers. Whole body visible, equal scales and foot anchors, sitting heads same scale as the existing sprites, keep base material colors clearly separated for runtime recoloring (cyan clothing, peach skin, brown hair, navy bottoms). True alpha zero outside sprites, no smoke or halo or baked shadow.

### fishing-cove

Use case: stylized-concept. Production cozy pixel fishing mini-scene backdrop for RO Lounge, style and layout reference is the attached FISHING panel. Render the EMPTY environment, not the UI screenshot. Landscape 4:3 composition. Sparkling turquoise pond/cove with rich pixel foam and 3 dark fish silhouettes swimming in the left water, mossy gray rocks and flowering grassy banks around the left and top, palm tree upper left, cute sandy upper right bank and tiny seashells. Wooden fishing dock protrudes from RIGHT toward the middle, with two strong wooden posts, blue bucket and small wooden barrel. Dock edge has clear EMPTY space centered at x68%, y48% where a separate live sitting character will be overlaid. One cute calico cat sitting further RIGHT on dock, one small gull on upper right post. No human character, NO rod/line/bobber, NO words, labels, numbers, controls, cards, borders or game UI. Crisp warm detailed 16-bit JRPG pixel clusters exactly as reference, no painted realism. Entire scene filled, no black margins, water mostly left/center.

### activity-props

Use case: stylized-concept. Transparent production environment prop atlas for RO Lounge matching the attached cozy rich 16-bit pixel references. Strict 4 columns by 2 rows, eight COMPLETE isolated props with large empty gutters, no text, characters or background. Row1 reading left to right: front-facing cozy brown wooden chair with backrest and cushion; a low wooden dock edge with three strong wooden posts and blue bucket; rounded mossy shoreline rock cluster with white daisies; a small tuft of reeds with pink water flowers. Row2: little calico cat sleeping curled up; a small golden dealer crown floating icon; warm wooden kitchen counter FRONT fascia with a cream plate stack and vegetable crate; small wooden game-inn side shelf with playing-card-pattern decoration. Camera same slightly top-down front JRPG viewpoint as the UI references, dark fine outlines, layered pixel shading, emerald green leaves warm timber gold brass, real transparent alpha outside each object, no smoke or shadows or text.

### cafe-poses

Use case: stylized-concept. Transparent production pose atlas for RO Lounge cute pixel cafe. Identity/style reference: existing novice sprites and the attached CAFE reference. Strict THREE columns by TWO rows, six complete isolated characters with generous alpha-zero gutters, no furniture or background or text. Row1 same brown-haired male novice in cyan collared shirt/navy trousers: front-facing hands raised chopping/preparing food; front-facing one arm making a stirring gesture holding a short spoon; front-facing both hands holding a plain serving plate. Row2 same bob-haired female novice in cyan blouse/navy pleated skirt doing the same three actions. Same big rounded cute heads and faces, same whole-body scale/foot anchors as novice sheet, crisp rich 16-bit JRPG pixel clusters. No hats, no apron, no counters, no food, no smoke; runtime layers provide cosmetics/counter/food. True transparent background, no dark vignette.

## Verification

Local verification passed: 56 server tests and TypeScript; client production build; reference assets and creator; six distinct body modes/18 new poses; four-member café tableau and exact Ready/work messages/progress/steam; eight-seat private-card/animation/showdown and 1280/1024/768/390/360/320px layout; 52 card faces and readable balances; real repeated-round casino bets/payout/reload/queued exit; wildlife/weather and real fishing gauge/rewards; all five maps, cooperative two-player cooking rewards, ownership, collection and persistence; quiet music/effects. Screenshots were inspected and refined (no bubbles covering faces or overlapping mobile seats).

Production verification is performed after publishing, using an isolated Guest and no wagers/kitchen joins/item collection. Its own cast is cancelled without awarding anything. The safe black-box smoke records screenshots/results locally, checks the activity-v2 art version, actual five-map navigation, read-only café scene, fishing preview/gauge, Boardgame spectator controls/mobile, no missing art/page errors, and unchanged balance/backend.

