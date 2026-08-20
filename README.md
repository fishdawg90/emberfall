# Emberfall

Hosted Three.js migration of the original Emberfall idle RPG.

The current integration keeps the first-person mobile prototype intact while
restoring the original four metal tiers, mining/smelting/training loops,
skills and upgrades, 24 forge recipes, equipment, market, town restoration,
offline progress, full card-combat rules, and compatible saves. The adventure
visual pass adds a denser Greyfen, distinct Frostmere/Sunspire/Tidewatch town
clusters, horizon mountains and coast, a detailed world map, first-person 3D
mining/smelting/training/forging scenes, and four animated combat enemies. Tap
the 3D ground to walk, drag to look, and use the bottom dock or in-world
Greyfen service labels for the migrated town systems.

## Local checks

```sh
node --test
node --check game.js
node --check game-ui.js
node --check world-visuals.js
node --check activity-visuals.js
node --check combat-visuals.js
```

See `MIGRATION_PLAN.md` for the audited system mapping and remaining migration
stages.
