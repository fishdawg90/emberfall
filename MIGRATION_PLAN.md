# Emberfall gameplay migration plan

## Audit snapshot

### Original game: `emberfall_v20_6_third_person_towns.html`

The original is a single-file application. It owns the gameplay state, rules,
UI, a WebGL canvas renderer, procedural 3D-style scene helpers, input, and
save handling in one script. The important state is held in `S` and includes:

- `coins`, `inv`, `gear`, `eq`, and `gid` for the economy, materials, forged
  equipment, and equipment slots.
- `skills` and `up` for Mining, Smelting, Combat Training, Forging, and their
  upgrade trees.
- `open`, `depth`, and `smelt` for mine progression and active metal layer.
- `hero` for the separate exploration level and XP track.
- `town` for Greyfen's Smithy, Smelter, Market, and Wayfarer Inn restoration.
- `explore` for overworld/town/region position, runs, encounters, room
  progression, region wins/claims, event choices, haul, HP, buffs, and active
  card combat.
- `selectedRecipe`, `forgeAnim`, and `battle` for transient workshop and gate
  combat state.

The attached version currently writes `emberfall_depths_v20_5`. The migration
adapter also reads and preserves the requested `emberfall_depths_v4` key, plus
the nearby `v20_6` alias, so a later runtime can choose the newest compatible
save without discarding older data.

### Hosted repo: `fishdawg90/emberfall`

The hosted repo is intentionally small:

- `index.html` provides the mobile canvas shell, tap/drag instructions, style
  toggle, town-plan overlay, loading state, and the built-in debug report UI.
- `game.js` creates the Three.js renderer, lighting, fog, terrain, terrain-aware
  roads, asset loader, town lots, prop decoration, tap-to-walk navigation, and
  non-inverted camera look.
- Building and prop visuals are loaded as complete GLTF assets. The current
  terrain texture paints the generated road network into the terrain surface;
  it is not a collection of rigid road tiles.

## System-to-architecture mapping

| Original system | Current source of truth | New repo boundary | Migration status |
|---|---|---|---|
| Save/load and compatibility | `KEY`, `fresh`, `merge`, `load`, `save` | `game-state.js` adapter; canonical writes will remain compatible with `emberfall_depths_v4` | Foundation added |
| Materials and metal gates | `metals` | Gameplay catalog module, then world gate/ore nodes | Four-tier catalog migrated; 3D nodes planned |
| Mining/smelting work loops | `acts`, `doWork`, `simulate`, `opportunity` | Headless economy service driven by UI actions/idle timestamps | Service and mobile production UI integrated |
| Skills and upgrade trees | `skills`, `up`, `need`, `addXp`, `cost`, `can` | Progression service with no renderer dependency | Formulas, purchases, and UI integrated |
| Forging and quality | `recipes`, `beginForge`, `finishForge` | Forge service plus a mobile workshop panel | All 24 recipes, quality rolls, and animated first-person anvil view integrated |
| Equipment and stats | `gear`, `eq`, `EQUIP_SLOTS`, `equipSlot` | Equipment model plus 3D avatar/loadout presentation | Six-slot model and mobile loadout integrated; avatar planned |
| Market | `sellMat`, `sellGearStack`, `marketMul` | Economy service plus town market UI | Material/gear sales and multipliers integrated |
| Town restoration | `TOWN_PROJECTS`, `restoreTown`, `townLevel` | Persistent town entities mapped to premade buildings and services | UI plus four premade 3D service buildings integrated |
| Overworld and regions | `WORLD_LANDMARKS`, `TOWN_LAYOUTS`, `worldBiome`, movement functions | Three.js world anchors, regions, towns, gates, and fast travel | Six landmarks, painted routes, distinct premade town clusters, horizon scenery, detailed map, and gated fast travel integrated |
| Tap-to-walk | `setExploreWalkTarget`, `gridPath`, `updateExploreMotion` | Existing Three.js raycast/navigation path; retain as primary mobile input | Already present; preserve |
| Camera look | `orbit` handlers in original; pointer look in `game.js` | Existing yaw/pitch look with positive drag-to-look semantics on both axes | Already present; preserve |
| Random encounters | `maybeRandomEncounter`, `startExploreCombat` | Exploration encounter service triggered by 3D travel distance | Integrated with first-person travel distance and safe-town suppression |
| Card combat | `EXPLORE_CARDS`, combat state, draw/discard/energy/break rules | UI overlay over the 3D scene; combat state remains renderer-independent | Full state machine, four visible enemies, first-person weapon, and mobile animations integrated |
| XP and region progression | `gainHeroXp`, `winExploreCombat`, `regionWins`, `claimed` | Shared progression service used by world, work, and combat | Hero XP, rewards, boss claims, and Deepsteel unlock integrated |
| Debug report | `EmberDebug` in hosted `index.html` | Keep the existing button/report and add state/world diagnostics | Preserved; extend |
| Onboarding and gameplay cohesion | Original mode descriptions and progression prompts | One-screen intro plus renderer-independent journey objectives shared by HUD, world travel, work, combat, and town systems | Integrated |

## Incremental implementation sequence

1. **Foundation state bridge (this checkpoint).** Add a pure compatibility
   adapter. It normalizes fresh state and existing saves without importing the
   old renderer or mutating the current Three.js scene.
2. **Runtime read-only integration.** Load the bridge from the hosted runtime,
   publish a summary for the HUD/debug report, and verify that the prototype
   still boots with no save and with a synthetic legacy save.
3. **Gameplay services (complete for migrated systems).** Metals, recipes, work, skill XP,
   upgrades, forging, equipment, selling, and town restoration now live in
   renderer-independent modules with regression coverage. The original card
   deck, energy, Break, block, intent, rewards, defeat, boss, and region state
   transitions are also migrated and renderer-independent.
4. **3D world entities (initial integration complete).** Greyfen now reserves persistent
   Smithy, Smelter, Market, and Inn lots using complete premade GLB buildings.
   Their restoration levels change the buildings and add premade props; tapping
   a service label walks to it before opening its system. Frostmere, Sunspire,
   Tidewatch, Whisperwood, and the Lower Ways now exist as persistent premade
   asset clusters connected by terrain-painted routes in one continuous world.
5. **Town and workshop surfaces (initial integration complete).** Mobile
   panels now expose restoration, mining, smelting, training, forging,
   equipment, upgrades, and market actions through the shared services. These
   use the persistent dock and are also attached to physical premade town
   buildings, so both access paths call the same rules and save adapter.
6. **Exploration encounters (integrated).** Distance-based encounters and
   region progression now run from first-person travel. Walking remains
   tap-to-move; combat pauses travel without replacing the 3D scene. Three
   region wins reveal the guardian, boss claims unlock the original rewards,
   and defeat returns the player to Greyfen.
7. **Card combat overlay (integrated).** The mobile overlay uses the original
   energy, draw/discard, Break, intent, block, enemy turn, XP, loot, equipment
   cards, and boss rules. It resumes compatible saved battles and leaves the
   3D scene underneath and is now triggered by travel or a revealed guardian.
   Four distinct enemy silhouettes animate for idle, hit, Break, attack,
   victory, and defeat states without changing the renderer-independent rules.
8. **Performance and compatibility pass (initial integration complete).** The
   coarse-pointer profile caps pixel ratio, reduces terrain, shadow, and grass
   budgets, keeps local shadows following the player, preserves the debug
   reporter, and checkpoints versioned 3D positions without misreading legacy
   2D coordinates. Device testing and profiling remain ongoing.
9. **Adventure visual pass (integrated).** Greyfen and the three destination
   towns now use denser clusters of complete premade GLB buildings with
   regional palettes and props. Distant mountains, a Tidewatch coast,
   Whisperwood density, Lower Ways rock gate, topographic map detail, and
   first-person Three.js work scenes strengthen visual progression while the
   activity renderer runs only when its panel is visible.
10. **Journey cohesion pass (integrated).** A quick first-launch intro explains
    gather → refine → forge → venture → restore. A persistent objective
    ribbon advances from the first iron weapon through town contracts, patrols,
    guardians, deeper mine gates, and restoration. Workstations now include
    environmental structure, props, light and particles; combat arenas include
    regional scenery, impact feedback, and visible Tunnel Mauler, Glass Warden,
    and Abyss Sentinel models. This also restores reachable named gates for the
    higher metal tiers while retaining card combat and save compatibility.
11. **Living-world guidance pass (integrated).** Greyfen now teaches its mine,
    smelter, smithy, market, and first trade through a saved task board and
    walk-to markers before revealing Frostmere. Later towns and regions are
    discovered in sequence; their local mines gate Starsilver and Aetherite,
    while regional foundries improve matching smelting yields. A live minimap,
    explicit safe-town boundaries, compact town layouts, roaming townsfolk,
    a sun and moving clouds make travel state readable in first person. Route
    actions resume after victorious road encounters, and combat cards now use
    distinct lightweight illustrations without adding an image-download cost.
12. **Mission and town feedback pass (integrated).** The large objective ribbon
    is replaced by a persistent journal of current, completed, optional, and
    still-locked missions. One discovered mission can be pinned, with its
    contextual Route/Open control kept beneath the live minimap. Townsfolk now
    speak automatically in projected bubbles when the player walks near them.
    Restoring a building closes the menu, walks the player to the structure,
    and reveals its new level with added props, a rise/pulse, and a construction
    ring. A two-step journal action can clear all compatible save aliases and
    restart from a clean v4-compatible state.
13. **Progressive interface pass (integrated).** The duplicated panel tabs and
    five-step loop ribbon are removed in favour of one compact dock that remains
    available inside menus. Fresh heroes see only Work, Town, and Journal;
    discovering the smithy reveals Forge, and the first forged item reveals
    Gear. Mining, smelting, training, market access, metal recipes, and town
    projects now follow their world discoveries. Dense explanations, locked
    recipes, completed missions, undiscovered missions, display controls, and
    save management sit behind focused expandable sections. Market access moves
    into Greyfen, and its default list shows only goods the player can sell.
14. **Phone readability and visible locks (integrated).** Locked systems no
    longer disappear from the dock or activity selector. Mines, smelting metals,
    forge metals, recipes, trade, and restoration projects remain visible as
    muted cards with their exact discovery, guardian, or skill requirement;
    tapping one repeats that requirement without leaving the screen. Mine and
    metal progression is now a two-column phone grid, while larger type, 42–52px
    touch targets, a readable mission tracker, and a left-aligned scrolling
    combat hand replace the previous 5–8px labels and easily clipped card row.
    Smelting and forging services also reject unopened metal tiers at the rules
    layer so UI locks cannot be bypassed by stale state.

## Current working checkpoint

- The world map routes map taps into the same primary tap-to-walk navigation.
- Instant travel is limited to Greyfen and regions already secured by a boss
  claim, matching the original progression gate.
- Hosted 3D positions carry an explicit `hosted3d-v1` marker. Unmarked legacy
  coordinates start safely at Greyfen; marked positions round-trip through the
  v4/v20.x save bridge.
- Automated coverage currently exercises save normalization, economy,
  progression, card combat, world gates, shell wiring, mobile budgets, region
  visual integration, first-person station scenes, and animated enemy models.

## Guardrails

- Do not replace the original gameplay with a demo state or a second simplified
  combat system.
- Do not delete the current hosted scene while gameplay services are being
  migrated. Each step must leave a bootable prototype.
- Keep `emberfall_depths_v4` readable and writable where practical. Unknown
  save fields are retained during normalization so future migration steps can
  round-trip data they do not yet understand.
- Keep tap/click-to-walk as the primary phone control. Dragging is camera look;
  neither yaw nor pitch is inverted.
- Use complete premade building/prop assets. New town restoration should toggle
  or decorate asset-backed entities, not assemble houses from primitive boxes.
- Keep roads aligned to the terrain and prefer painted terrain paths over rigid
  tile placement.
- Keep the built-in Debug button/report active in every checkpoint.
- Avoid loading every prop or shadow at maximum quality on mobile; make visual
  fidelity a budgeted, measurable setting rather than a reason to remove
  gameplay.

## First checkpoint acceptance criteria

- The hosted repo still boots its current 3D town unchanged when no save exists.
- A state bridge can read `emberfall_depths_v4` and the attached file's
  `emberfall_depths_v20_5` shape without throwing.
- Core inventory, equipment, skill, town, hero, exploration, and combat fields
  survive a normalize/serialize round trip.
- The debug reporter remains available for the next runtime integration.
