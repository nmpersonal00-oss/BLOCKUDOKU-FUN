# Blockudoku — Cozy Glow Edition

Updated mobile-first endless 9×9 puzzle, preserving the supplied candlelit purple room background and minimal game layout.

## Improvements
- 166 unique fixed-orientation shapes: all 91 fixed polyominoes from 1 to 5 blocks plus larger advanced pieces. Mirrored silhouettes and rotations are included.
- Three-piece trays aim for different silhouette families, with progressive difficulty at higher levels.
- Responsive placement: previews update only changed grid cells, not all 81 on every pointer move. Drag ghost moves via compositor transform and tracks without board stretching.
- More square tile corners (6% instead of 15–17%).
- Endless scoring, rows/columns/3×3 clears, streaks, combos, best-score saves remain unchanged. Previous saved pieces retain their IDs.

## Deploy
Keep `index.html`, `style.css`, `engine.js`, `game.js`, and `background.png` at GitHub Pages repository root. No dependencies or build step. Use `node --test tests/game.test.cjs` to run engine checks.
