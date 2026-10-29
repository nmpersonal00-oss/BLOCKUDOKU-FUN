# Blockudoku — Cozy Room Edition

A static GitHub Pages game matched to the supplied room and interface references.

- Full supplied `background.png`, no additional panels below the tray.
- Three stats: score, best score, and unlimited level.
- Fixed 9×9 grid with rows, columns, and 3×3-square clearing.
- Three-piece tray, tap-to-place, mouse drag and touchscreen drag.
- Scoring: +1 per placed square, +2 per **unique** cleared square multiplied by consecutive-clear streak (up to ×5), plus +12 per extra completed area on the same move.
- Local browser save and personal best, audio toggle, settings/new game.

## Install

Upload `index.html`, `style.css`, `engine.js`, `game.js`, `background.png`, and optionally `README.md` / `tests` to the **root** of `BLOCKUDOKU-FUN` on `main`. GitHub Pages source must be `main / (root)`.

## Tests

Run `node --test tests/game.test.cjs` to verify the engine. `index.html` uses versioned script/style URLs to force a fresh deployment cache.
