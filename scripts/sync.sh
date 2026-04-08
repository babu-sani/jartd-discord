#!/bin/bash
# Sync engine files, pack data, fonts, and thumbnails from parent project

PROJ_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLIENT="$(cd "$(dirname "$0")/../client" && pwd)"

echo "Syncing engine files..."
cp "$PROJ_ROOT/src/engine/GameEngine.ts" "$PROJ_ROOT/src/engine/placeholders.ts" "$PROJ_ROOT/src/engine/types.ts" "$CLIENT/src/engine/"

echo "Syncing pack data..."
cp "$PROJ_ROOT/data/jartd_base_game.json" "$PROJ_ROOT/data/globe_trotters.json" "$PROJ_ROOT/data/unhinged.json" "$PROJ_ROOT/data/packs_manifest.json" "$CLIENT/public/data/"

echo "Syncing fonts..."
cp "$PROJ_ROOT/assets/fonts/SourGummy-Regular.ttf" "$PROJ_ROOT/assets/fonts/SourGummy-SemiBold.ttf" "$PROJ_ROOT/assets/fonts/Outfit-SemiBold.ttf" "$PROJ_ROOT/assets/fonts/Outfit-Bold.ttf" "$PROJ_ROOT/assets/fonts/Outfit-ExtraBold.ttf" "$PROJ_ROOT/assets/fonts/DMSans-Regular.ttf" "$PROJ_ROOT/assets/fonts/DMSans-Medium.ttf" "$PROJ_ROOT/assets/fonts/DMSans-Bold.ttf" "$CLIENT/public/fonts/"

echo "Syncing pack thumbnails..."
cp "$PROJ_ROOT/assets/packs/pack_thumb_"*.png "$CLIENT/public/packs/"

echo "Done!"
