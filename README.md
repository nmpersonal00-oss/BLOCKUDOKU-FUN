# Infinite Glow — Blockudoku

A complete, mobile-friendly, no-build **Blockudoku-inspired** puzzle game. Every file in this ZIP is yours to upload to GitHub Pages. The game has original visual styling and does not contain third-party logos, branded assets, external scripts, fonts, advertisements, or dependencies.

## How to publish on GitHub Pages

1. **Unzip the archive first.** GitHub Pages does not automatically extract a ZIP uploaded to a repository.
2. Create a new GitHub repository (or upload into an existing site subfolder). On the GitHub website select **Add file → Upload files** and upload `index.html`, `style.css`, `engine.js`, and `game.js` together. Keep these four files in the same folder.
3. Open the repository's **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. Your site will publish at the URL shown there.
4. `README.md` and the `tests/` folder are optional for the published game.

For GitHub Pages deployment to a subfolder, keep the four site files together in that folder, and select your appropriate Pages source. No build step, API keys, network access, or configuration is needed.

## Rules

- 9×9 board with nine 3×3 boxes.
- Three fixed-orientation pieces are provided at a time. Use all three to refill the tray.
- Tap a piece and tap the **top-left** destination cell, or drag a piece to place it.
- Complete a row, column, or 3×3 box to clear all blocks in it. All completed areas are detected and removed simultaneously.
- The run ends if none of the currently available pieces fits the board.
- **Unlimited levels:** level 1 needs 250 score to advance; subsequent level thresholds increase by 125 per level. The board never resets on leveling up. More complex shapes appear at higher levels.

## Scoring (exact for this implementation)

- **Placement:** +1 point for each square in the piece placed.
- **Clear:** +2 points for each *distinct* cell cleared, multiplied by the consecutive-clearing-move streak; multiplier capped at ×5.
- **Combo:** +12 points for each additional row, column, or 3×3 box completed *on the same move*, beyond the first.
- **Streak:** consecutive moves that clear at least one area increase the multiplier. A move that clears nothing resets it.
- **Progress:** levels and high scores are based on this deterministic integer score. Overlapping rows, columns, and boxes do **not** double-count cells.

This transparent scoring system is original: Easybrain's publicly documented core gameplay does not expose every coefficient of its proprietary score calculation. It is not presented as an exact copy of Easybrain's hidden internal algorithm.

## Persistence and privacy

The current run, personal best, maximum level, and sound preference are stored in localStorage on the current browser/device. No login or network requests. Browsing in private mode or clearing site data may remove saves. Levels can continue without a predefined maximum; available shapes get progressively more challenging.

## Testing

Run `node --test tests/game.test.cjs` to validate the pure scoring/placement engine. Manually test desktop, touchscreen, restart, resume, and sound in a real browser before public release.
