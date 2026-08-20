# Emberfall

Hosted Three.js migration of the original Emberfall idle RPG.

The current integration keeps the first-person mobile prototype intact while
restoring the original four metal tiers, mining/smelting/training loops,
skills and upgrades, 24 forge recipes, equipment, market, town restoration,
offline progress, full card-combat rules, and compatible saves. Tap the 3D ground to walk, drag to
look, and use the bottom dock or in-world Greyfen service labels for the
migrated town systems.

## Local checks

```sh
node --test
node --check game.js
node --check game-ui.js
```

See `MIGRATION_PLAN.md` for the audited system mapping and remaining 3D world,
encounter, and card-combat stages.
