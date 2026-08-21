# Emberfall

Hosted Three.js migration of the original Emberfall idle RPG.

The current integration keeps the first-person mobile prototype intact while
restoring the original four metal tiers, mining/smelting/training loops,
skills and upgrades, 24 forge recipes, equipment, market, town restoration,
offline progress, full card-combat rules, and compatible saves. The adventure
visual pass adds a denser Greyfen, distinct Frostmere/Sunspire/Tidewatch town
clusters, horizon mountains and coast, a detailed world map, first-person 3D
mining/smelting/training/forging scenes, and animated combat enemies. The
cohesion pass adds a one-screen introduction, a persistent journey objective,
one-time town contracts, region patrol routing, and named mine-gate battles so
the four metal tiers, exploration, combat, trade, and restoration form one
guided loop. The Lower Ways is now a generated, resumable first-person cave
maze with fog-of-war mapping, frontier route hints, random card battles,
guaranteed healing and coin discoveries, temporary post-battle card drafts,
a far-chamber guardian, and a dedicated Deepsteel unlock reward. Iron armour
now supplies visible per-hit mitigation and stronger Block, while passive
material stockpiles develop diminishing returns that forging and trade relieve.
A tunable expedition reward table now raises battle, cache, and skipped-draft
coin income. The cave map offers immediate evacuation back to the saved Lower
Ways entrance, while Iron, Deepsteel, Star Silver, and Aetherite mining use
distinct first-person environments instead of palette swaps. A persistent
health HUD, collapsible live map, brighter
player-following cave light, smoothed routes, and post-look camera return keep
the phone exploration view readable. Tap the 3D ground to walk, drag to look,
and use the bottom dock or in-world Greyfen service labels for the migrated
town systems.

## Local checks

```sh
node --test
node --check game.js
node --check game-ui.js
node --check world-visuals.js
node --check activity-visuals.js
node --check combat-visuals.js
node --check cave-data.js
node --check cave-services.js
node --check cave-visuals.js
node --check navigation-utils.js
node --check journey-services.js
```

See `MIGRATION_PLAN.md` for the audited system mapping and remaining migration
stages.
