# Reference art production prompts

Generated with the built-in ImageGen tool. Original sources retained in client/art-source/reference-v1; runtime exports in client/public/art/reference-v1. Character and UI art are live components, not screenshots used as fake game screens.


## Walking characters
Use case: stylized-concept.
Asset type: production transparent character-animation spritesheet for the existing RO Lounge 2D top-down multiplayer game.
Input images: the three recent user images are STYLE REFERENCES ONLY: RO Lounge cozy world and six UI panels. Match the cute chibi people in their CHARACTER, TOWN and CAFE panels closely. Create an original spritesheet, not another mockup or screenshot.
Primary request: a perfectly regular 3-column by 6-row sheet of 18 individual full-body pixel-art animation sprites. Every equal-sized cell contains precisely one character, centered horizontally, feet at the same baseline. Generous transparent spacing separates all cells; no dividers, no labels, no text.
Rows, in exact order:
1 male novice facing camera: idle, left step, right step.
2 the SAME male facing right: idle, left step, right step.
3 the SAME male facing away: idle, left step, right step.
4 female novice facing camera: idle, left step, right step.
5 the SAME female facing right: idle, left step, right step.
6 the SAME female facing away: idle, left step, right step.
Character style: the reference's big rounded brown hair, large expressive dark eyes, tiny smile, softly pink cheeks, small cute body, detailed collared novice jacket with cuffs and a small golden button, brown boots. Male short tousled hair and trousers; female neat bob hair, blouse bow and a pleated skirt. Both use LIGHT CYAN clothing (#78d9ec), fair peach skin (#ffdcc0), dark chestnut hair (#3b2a20), navy bottoms (#3d4a7a), allowing later palette swaps in the game. Keep those four materials clearly separated. Two-heads-tall chibi proportions, true detailed crisp 16-bit JRPG pixel art, outlined clusters, 3–4 shades per material. Match the reference, not simple block stick figures, not flat vector, not painted realism or 3D.
Composition: tall rectangular sheet, equal-cell grid 3 columns x 6 rows, orthographic top-down RPG character camera showing faces/front and actual backs, identical scale and anchor throughout. All hands, hair and boots inside their own cell. Alpha-transparent empty background. NO ground, NO shadow under feet, NO scenery, NO UI, NO watermarks. Animation changes only arms and legs; preserve facial identity, clothing details, silhouette and head positions. Assets will be sliced and used in Phaser with nearest-neighbor sampling.

## Character transparency conditioning
Use case: background-extraction. Edit target: the generated 18-sprite RO Lounge character sheet. Keep ALL 18 characters at their exact current positions, scales, shapes, clothes, facial identities and walking poses. Preserve the exact 3-column / 6-row arrangement and the full canvas dimensions. Remove ONLY the smoky brown/gray glow, vignette, shadows and every background pixel surrounding the sprites. The spaces between sprites must be truly alpha 0, and each character's colored pixels must be fully opaque alpha 255, with crisp pixel-art boundaries, not semi-transparent. Do not redraw or rearrange characters. No labels, no ground, no shadows, no halo. This is a production sprite sheet to place over grass and stone in a game, not a presentation image.

## character-heads
Use case: stylized-concept. Asset type: transparent modular hairstyle-and-face spritesheet for the RO Lounge game.
Input 1 and 2 are the exact world/UI style references; input 3 is our matching character animation identity reference.
Create a regular 3-column x 6-row atlas with 18 HEAD-ONLY pixel-art sprites, no torso or arms or clothing. Each row is one hairstyle; columns are facing front, facing RIGHT, facing away. Rows: male tousled brown hair (same face as animation), male neat side-part hair, male spiky hair, female brown bob (same face as animation), female long straight hair, female twin ponytails with tiny pink ribbons. Keep identical cute big eyes, peach skin, tiny mouth, dark pixel outlines, rounded head proportions and true detailed 16-bit JRPG pixel clusters, matching the references. Heads include ears and a short neck, all with identical head center and neck anchor so they can be layered on animated bodies. Hair is chestnut brown (#3b2a20) with clearly defined highlights; skin fair peach (#ffdcc0), allowing palette swaps. Every head isolated with ample transparent gutters, equal-sized cells. No bodies, no hats, no extra faces, no labels, no numbers, no shadows, no background glow. Empty pixels alpha-transparent; foreground fully opaque. This is a usable asset sheet, not concept art or a poster.

## environment-props
Use case: stylized-concept. Asset type: transparent environment-prop atlas for RO Lounge.
The two input images are STYLE REFERENCES. Match their lush detailed 16-bit pixel artwork, warm wooden materials, chunky foliage clusters, cream stones, burgundy roofs, flowers, and golden lamps. Create one 4-column x 4-row atlas of 16 isolated top-down RPG props, exactly one object centered in each equal cell, large clear transparent gutters and NO text or labels. Fixed view: top-down JRPG with a little front facade visible, NOT isometric, NOT vector, NOT painted realism.
Exact row order left-to-right:
Row1 lush leafy oak tree, second rounded oak tree, tall evergreen tree, coconut palm tree.
Row2 white-and-yellow flowering bush, pink-and-red flowering bush, mossy gray rock cluster, wooden picket fence with three posts.
Row3 wooden bench, tall golden lantern lamppost, cream canvas camping tent, blue-water cream-stone tiered fountain with little flowers.
Row4 burgundy-roof wooden Boardgame cottage with BLANK signboard and entrance, glass greenhouse, cozy burgundy-roof wooden cafe with BLANK signboard, striped red/cream market stall with fruit baskets.
No characters or animals, no ground patches under objects, no casting shadows outside objects, no scenery connections between cells, no watermarks, no lettering. Each object complete and unclipped with crisp pixel edges and rich reference-level surface details. Alpha-transparent background, opaque object pixels. Designed for slicing into independent Phaser sprites.

## terrain-materials
Use case: stylized-concept. Asset type: production seamless terrain/material texture atlas for RO Lounge.
The two input images are exact STYLE REFERENCES. Create a perfectly regular 4-column x 4-row square atlas of sixteen square, individually tileable 16-bit pixel-art materials. Each swatch fills its entire equal cell; no gaps, frames, text, grid lines or labels. Rich tiny pixel clusters and restrained hand-dithered texture, matching the reference world, NOT realistic PBR, NOT flat solid shapes.
Exact material order:
Row1 lush warm green meadow grass with tiny blades; darker forest floor grass; warm tilled farm soil with parallel furrows; pale golden beach sand with tiny grains.
Row2 cream village stone paving with irregular slabs and subtle moss; variant cream village paving; golden dirt walking path; purple-gray night-market cobblestone.
Row3 clear bright turquoise pond water with soft wave clusters; second pond ripple variant; deeper vivid turquoise sea water with layered wave clusters; sea ripple/foam variant.
Row4 burgundy overlapping roof tiles; warm amber wooden floor planks; mossy gray rocky cliff-face material; meadow grass with sparse tiny white/pink wildflowers.
Orthographic texture view for laying flat in a top-down game. All edges within each cell tile seamlessly. Consistent reference palette, crisp pixels, gentle light from upper left, no scene objects or characters. Opaque background.

## wildlife
Create a production pixel-game sprite atlas matching these RO Lounge concept references: rich crisp 16-bit cozy JRPG, detailed cute chibi creatures, warm outlines, no realism. Transparent background. Strict regular 4 columns x 5 rows, 20 isolated equal sized cells with generous empty gutters, no background, text or shadows. Each ROW shows the SAME creature in four animation views: facing right idle, facing right walking or flapping pose, front idle, back idle. Rows from top: cute orange-white calico cat; white bunny with pink ears; blue butterfly; honeybee; red spotted ladybug. Real frame changes in walking legs/wing angle, preserve size and identity. Camera slightly top-down same as concept characters. Only one isolated creature per cell.

## inventory
Production cozy pixel-game icon atlas, visually match the supplied RO Lounge references exactly, rich crisp 16-bit JRPG, bright turquoise, leafy greens, warm gold and coral, crisp pixels and dark fine outlines. Transparent background, no text, no UI or scenery. Strict 4 columns x 6 rows, 24 isolated icons with clear gutters. Reading left to right: row1 silver carp, goldfish, red-white koi, bluegill; row2 silver mackerel, orange-white clownfish, golden seahorse, blue butterfly; row3 gold beetle, glowing firefly, red-white mushroom, snow-white bunny; row4 calico cat, leafy carrot, ripe tomato, golden wheat; row5 pink seashell, iridescent pearl, small gold treasure chest, green recycling leaf; row6 chef medal, music note, sailboat, campfire. Same visual size per cell. Fine sprite details, not broad flat symbols.

## ui-kit
Production texture atlas for cozy pixel game interface matching RO Lounge UI references: warm carved timber, cream parchment, lush little leaf accents and brass edges, crisp rich 16-bit pixels. Transparent background outside each separate item. Strict 4 columns x 3 rows 12 items, generous equal gutters. ALL panels empty inside, NO words, letters, digits, people, cards, hands or icons. Row1: rectangular cream parchment wood-bordered panel; rectangular dark green wood-bordered panel; wide low blank wooden title plaque with small leaf corners; wide low raised golden button. Row2: wide low sky-blue button; wide low leafy-green button; wide low burgundy-red button; wide low dark-green currency box with brass edges. Row3: square cream inventory item slot in wooden frame; rectangular wooden minimap frame with plain green center; square wood-and-parchment portrait frame; oval emerald green felt gaming table with detailed thick round wooden rim viewed slightly from above, entire oval visible, empty inside. All designs separable clean transparent cells, consistent lighting upper left, no glows.

## food-gear
Production cozy rich 16-bit pixel game transparent icon atlas, same RO Lounge reference visual style, 4 columns x4 rows, isolated items clear gutters no text/no background/no people. Row1: colorful garden salad bowl; carrot soup bowl; kitchen order parchment; chopping board with carrot and knife. Row2: cooking pot; serving plate; green ranger camp hat; golden straw hat. Row3: blue fishing hat; white puffy chef hat; cute cat-ear hat; cream cafe apron. Row4: shiny gold coin; musical eighth-note icon; small speaker icon; single blue patterned playing card BACK. Hats are front-facing ready to overlay chibi sprites, brim facing camera, no face/head attached. Apron ready to overlay chest, no body. Every isolated item complete, avoid shadows beneath, crisp outlines and rich pixel shading.

## cafe-interior
Production background scene for RO Lounge cozy pixel game, EXACT visual style of supplied reference UI concept café: rich crisp 16-bit top-down/front-cutaway JRPG, warm timber golden lanterns leafy plants red burgundy accents. Landscape 3:2. Empty café kitchen with four distinct workstations across middle foreground: order desk at left, vegetable chopping counter second, cooking stove and copper pot third, serving counter plates at right. Behind them shelves jars bowls coffee cups and oven, small hanging lamps. Leave clear open floor in FRONT of each station where the actual live player's chibi sprite will be drawn. NO people or creatures, NO text labels or menus, NO UI buttons, NO floating icons, no baked game interface. Lower quarter beautiful wood plank floor. Not photoreal or isometric; identical pixel detail to supplied café panel. Keep fine outlined pixel clusters.

## inn-interior
Production background scene for RO Lounge Boardgame pixel game, EXACT cozy rich crisp 16-bit JRPG visual style of supplied Boardgame UI reference. Landscape 3:2 cutaway front/top-down wooden game inn interior, golden hanging lanterns along sides, lush potted plants, burgundy wood walls and shelves at back, cozy ambient warm lighting. VERY LARGE EMPTY OPEN CENTER and lower floor for the actual live green oval table and eight player's avatars overlay; NO table in center, NO chairs in center, NO characters, NO playing cards or coins, NO text, NO interface/buttons. Detailed wood floor planks, rich warm timber shading, clearly pixel clusters not painted smooth. Outer decorative objects at far edges only, central 80% unobstructed.
