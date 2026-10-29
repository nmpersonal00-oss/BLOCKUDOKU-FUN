(() => {
  'use strict';

  const SAVE_KEY = 'blockudoku-exact-save-v1';
  const BEST_KEY = 'blockudoku-exact-best-v1';
  const SOUND_KEY = 'blockudoku-exact-sound-v1';
  const BOARD_SIZE = 9;
  const COLORS = ['purple', 'pink', 'blue'];

  const SHAPES = [
    [[0,0]],
    [[0,0],[1,0]],
    [[0,0],[1,0],[2,0]],
    [[0,0],[0,1]],
    [[0,0],[0,1],[0,2]],
    [[0,0],[1,0],[0,1]],
    [[0,0],[1,0],[2,0],[0,1]],
    [[0,0],[1,0],[2,0],[1,1]],
    [[0,0],[1,0],[0,1],[1,1]],
    [[1,0],[0,1],[1,1]],
    [[0,0],[0,1],[0,2],[1,2]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0],[4,0]],
    [[0,0],[0,1],[0,2],[0,3],[0,4]],
    [[0,0],[1,0],[2,0],[0,1],[0,2]],
    [[0,0],[1,0],[2,0],[1,1],[1,2]],
    [[0,0],[1,0],[0,1],[1,1],[0,2]],
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]]
  ].map(normalizeShape);

  const els = {
    board: document.getElementById('board'),
    tray: document.getElementById('tray'),
    score: document.getElementById('scoreValue'),
    best: document.getElementById('bestValue'),
    level: document.getElementById('levelValue'),
    soundButton: document.getElementById('soundButton'),
    settingsButton: document.getElementById('settingsButton'),
    homeButton: document.getElementById('homeButton'),
    modal: document.getElementById('settingsModal'),
    toggleSoundModal: document.getElementById('toggleSoundModal'),
    restartGameButton: document.getElementById('restartGameButton'),
    closeSettingsButton: document.getElementById('closeSettingsButton'),
    dragLayer: document.getElementById('dragLayer')
  };

  let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
  let bestScore = Math.max(0, Number(localStorage.getItem(BEST_KEY) || 0));
  let game = loadGame() || newGameState();
  let selectedPieceId = null;
  let preview = null;
  let dragState = null;
  let audioCtx = null;

  render();
  bindEvents();

  function normalizeShape(cells) {
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([,y]) => y));
    const normalized = cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const width = Math.max(...normalized.map(([x]) => x)) + 1;
    const height = Math.max(...normalized.map(([,y]) => y)) + 1;
    return { cells: normalized, width, height, size: normalized.length };
  }

  function newGameState() {
    return {
      board: Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null),
      tray: createTray(),
      score: 0,
      level: 1,
      streak: 0,
      moves: 0,
      over: false
    };
  }

  function createPiece(shapeIndex) {
    return {
      id: cryptoRandomId(),
      shapeIndex,
      shape: SHAPES[shapeIndex],
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  }

  function createTray() {
    const pieces = [];
    for (let i = 0; i < 3; i += 1) {
      pieces.push(createPiece(pickShapeIndex()));
    }
    if (!pieces.some(piece => canFitAnywhere(piece.shape, game?.board || Array(81).fill(null)))) {
      pieces[0] = createPiece(0);
    }
    return pieces;
  }

  function pickShapeIndex() {
    const level = game?.level || 1;
    const candidates = SHAPES.map((shape, index) => ({ shape, index }))
      .filter(({ shape }) => {
        if (level < 3) return shape.size <= 4;
        if (level < 7) return shape.size <= 5;
        if (level < 12) return shape.size <= 6;
        return true;
      });
    return candidates[Math.floor(Math.random() * candidates.length)].index;
  }

  function loadGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!saved || !Array.isArray(saved.board) || !Array.isArray(saved.tray)) return null;
      return {
        board: saved.board,
        tray: saved.tray.map(item => item ? ({ id: item.id || cryptoRandomId(), shapeIndex: item.shapeIndex, shape: SHAPES[item.shapeIndex], color: item.color || COLORS[0] }) : null),
        score: Number(saved.score) || 0,
        level: Math.max(1, Number(saved.level) || 1),
        streak: Math.max(0, Number(saved.streak) || 0),
        moves: Math.max(0, Number(saved.moves) || 0),
        over: Boolean(saved.over)
      };
    } catch {
      return null;
    }
  }

  function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      board: game.board,
      tray: game.tray.map(piece => piece ? ({ id: piece.id, shapeIndex: piece.shapeIndex, color: piece.color }) : null),
      score: game.score,
      level: game.level,
      streak: game.streak,
      moves: game.moves,
      over: game.over
    }));
    localStorage.setItem(BEST_KEY, String(bestScore));
    localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
  }

  function bindEvents() {
    els.tray.addEventListener('click', onTrayClick);
    els.board.addEventListener('click', onBoardClick);
    els.tray.addEventListener('pointerdown', onPiecePointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', cancelDrag);
    window.addEventListener('resize', () => { if (dragState) updateDragPreview(dragState.clientX, dragState.clientY); });

    els.soundButton.addEventListener('click', toggleSound);
    els.settingsButton.addEventListener('click', openSettings);
    els.homeButton.addEventListener('click', () => location.reload());
    els.toggleSoundModal.addEventListener('click', toggleSound);
    els.restartGameButton.addEventListener('click', () => { restartGame(); closeSettings(); });
    els.closeSettingsButton.addEventListener('click', closeSettings);
    els.modal.addEventListener('click', event => {
      if (event.target === els.modal) closeSettings();
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeSettings();
    });
  }

  function onTrayClick(event) {
    const slot = event.target.closest('.piece-slot');
    if (!slot) return;
    const pieceId = slot.dataset.pieceId;
    const piece = game.tray.find(item => item && item.id === pieceId);
    if (!piece || game.over) return;
    selectedPieceId = selectedPieceId === pieceId ? null : pieceId;
    preview = null;
    renderTray();
    renderBoard();
  }

  function onBoardClick(event) {
    if (!selectedPieceId || game.over) return;
    const cell = event.target.closest('.cell');
    if (!cell) return;
    const piece = findPiece(selectedPieceId);
    if (!piece) return;
    const index = Number(cell.dataset.index);
    const anchor = { x: index % BOARD_SIZE, y: Math.floor(index / BOARD_SIZE) };
    attemptPlacement(piece, anchor.x, anchor.y);
  }

  function onPiecePointerDown(event) {
    const slot = event.target.closest('.piece-slot');
    if (!slot || game.over) return;
    const pieceId = slot.dataset.pieceId;
    const piece = findPiece(pieceId);
    if (!piece) return;

    selectedPieceId = pieceId;
    renderTray();

    const unit = getPieceUnit(piece.shape);
    const ghost = buildDragPiece(piece, unit);
    els.dragLayer.replaceChildren(ghost);

    dragState = {
      pieceId,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      unit,
      ghost,
      piece
    };

    if (slot.setPointerCapture) {
      try { slot.setPointerCapture(event.pointerId); } catch {}
    }

    updateDragPreview(event.clientX, event.clientY);
  }

  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragState.clientX = event.clientX;
    dragState.clientY = event.clientY;
    event.preventDefault();
    updateDragPreview(event.clientX, event.clientY);
  }

  function onPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const piece = dragState.piece;
    const position = getBoardAnchorFromPointer(event.clientX, event.clientY, piece.shape);
    const dropped = position && attemptPlacement(piece, position.x, position.y, true);
    cancelDrag();
    if (!dropped) {
      renderBoard();
      renderTray();
    }
  }

  function cancelDrag() {
    if (!dragState) return;
    dragState = null;
    els.dragLayer.replaceChildren();
    preview = null;
    renderBoard();
  }

  function findPiece(pieceId) {
    return game.tray.find(piece => piece && piece.id === pieceId) || null;
  }

  function buildDragPiece(piece, unit) {
    const grid = document.createElement('div');
    grid.className = 'drag-piece';
    grid.style.setProperty('--piece-unit', `${unit}px`);
    grid.style.gridTemplateColumns = `repeat(${piece.shape.width}, max-content)`;
    grid.style.gridTemplateRows = `repeat(${piece.shape.height}, max-content)`;

    for (let y = 0; y < piece.shape.height; y += 1) {
      for (let x = 0; x < piece.shape.width; x += 1) {
        const cell = document.createElement('div');
        const filled = piece.shape.cells.some(([cx, cy]) => cx === x && cy === y);
        cell.className = `drag-piece-cell ${filled ? `filled color-${piece.color}` : 'empty'}`;
        grid.appendChild(cell);
      }
    }
    return grid;
  }

  function updateDragPreview(clientX, clientY) {
    if (!dragState) return;
    dragState.ghost.style.left = `${clientX}px`;
    dragState.ghost.style.top = `${clientY}px`;

    const anchor = getBoardAnchorFromPointer(clientX, clientY, dragState.piece.shape);
    if (!anchor) {
      preview = null;
    } else {
      preview = {
        pieceId: dragState.piece.id,
        x: anchor.x,
        y: anchor.y,
        valid: canPlace(dragState.piece.shape, anchor.x, anchor.y)
      };
    }
    renderBoard();
  }

  function getBoardAnchorFromPointer(clientX, clientY, shape) {
    const rect = els.board.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const cellSize = rect.width / BOARD_SIZE;
    const rawX = Math.floor((clientX - rect.left) / cellSize - shape.width / 2 + 0.5);
    const rawY = Math.floor((clientY - rect.top) / cellSize - shape.height / 2 + 0.5);
    return {
      x: Math.max(0, Math.min(BOARD_SIZE - shape.width, rawX)),
      y: Math.max(0, Math.min(BOARD_SIZE - shape.height, rawY))
    };
  }

  function canPlace(shape, x, y) {
    return shape.cells.every(([dx, dy]) => {
      const bx = x + dx;
      const by = y + dy;
      if (bx < 0 || bx >= BOARD_SIZE || by < 0 || by >= BOARD_SIZE) return false;
      return !game.board[by * BOARD_SIZE + bx];
    });
  }

  function canFitAnywhere(shape, board) {
    for (let y = 0; y <= BOARD_SIZE - shape.height; y += 1) {
      for (let x = 0; x <= BOARD_SIZE - shape.width; x += 1) {
        const ok = shape.cells.every(([dx, dy]) => !board[(y + dy) * BOARD_SIZE + x + dx]);
        if (ok) return true;
      }
    }
    return false;
  }

  function attemptPlacement(piece, x, y, fromDrag = false) {
    if (!canPlace(piece.shape, x, y)) return false;

    piece.shape.cells.forEach(([dx, dy]) => {
      game.board[(y + dy) * BOARD_SIZE + x + dx] = piece.color;
    });

    const clear = getClearResult();
    let moveScore = piece.shape.size;

    if (clear.sections > 0) {
      game.streak += 1;
      const multiplier = Math.min(game.streak, 5);
      moveScore += clear.uniqueCells.length * 2 * multiplier;
      moveScore += Math.max(0, clear.sections - 1) * 12;
      clear.uniqueCells.forEach(index => {
        game.board[index] = null;
      });
      playTone('clear');
    } else {
      game.streak = 0;
      playTone('place');
    }

    game.score += moveScore;
    bestScore = Math.max(bestScore, game.score);
    game.moves += 1;
    game.level = scoreToLevel(game.score);
    game.tray = game.tray.map(item => item && item.id === piece.id ? null : item);

    if (game.tray.every(item => item === null)) {
      game.tray = createTray();
    }

    if (!game.tray.some(item => item && canFitAnywhere(item.shape, game.board))) {
      game.over = true;
    }

    selectedPieceId = null;
    preview = null;
    if (fromDrag) cancelDrag();
    saveGame();
    render();

    if (game.over) {
      setTimeout(() => {
        alert(`Game over. Score: ${game.score}`);
      }, 60);
    }

    return true;
  }

  function getClearResult() {
    const rows = [];
    const cols = [];
    const boxes = [];
    const set = new Set();

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      const full = Array.from({ length: BOARD_SIZE }, (_, x) => game.board[y * BOARD_SIZE + x]).every(Boolean);
      if (full) {
        rows.push(y);
        for (let x = 0; x < BOARD_SIZE; x += 1) set.add(y * BOARD_SIZE + x);
      }
    }

    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const full = Array.from({ length: BOARD_SIZE }, (_, y) => game.board[y * BOARD_SIZE + x]).every(Boolean);
      if (full) {
        cols.push(x);
        for (let y = 0; y < BOARD_SIZE; y += 1) set.add(y * BOARD_SIZE + x);
      }
    }

    for (let by = 0; by < 3; by += 1) {
      for (let bx = 0; bx < 3; bx += 1) {
        const indices = [];
        for (let dy = 0; dy < 3; dy += 1) {
          for (let dx = 0; dx < 3; dx += 1) {
            indices.push((by * 3 + dy) * BOARD_SIZE + (bx * 3 + dx));
          }
        }
        if (indices.every(index => game.board[index])) {
          boxes.push([bx, by]);
          indices.forEach(index => set.add(index));
        }
      }
    }

    return {
      sections: rows.length + cols.length + boxes.length,
      uniqueCells: Array.from(set)
    };
  }

  function scoreToLevel(score) {
    return 1 + Math.floor(score / 250);
  }

  function render() {
    els.score.textContent = String(game.score);
    els.best.textContent = String(bestScore);
    els.level.textContent = String(game.level);
    els.soundButton.setAttribute('aria-pressed', String(soundOn));
    els.toggleSoundModal.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
    renderBoard();
    renderTray();
  }

  function renderBoard() {
    const previewIndices = new Map();
    if (preview && preview.pieceId) {
      const piece = findPiece(preview.pieceId) || dragState?.piece;
      if (piece) {
        piece.shape.cells.forEach(([dx, dy]) => {
          previewIndices.set((preview.y + dy) * BOARD_SIZE + preview.x + dx, preview.valid ? 'preview-valid' : 'preview-invalid');
        });
      }
    }

    els.board.replaceChildren();
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const index = y * BOARD_SIZE + x;
        const value = game.board[index];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.index = String(index);

        const region = ((Math.floor(x / 3) + Math.floor(y / 3)) % 2) === 1;
        if (region) cell.classList.add('region');
        if (x === 2 || x === 5) cell.classList.add('right-divider');
        if (y === 2 || y === 5) cell.classList.add('bottom-divider');
        if (value) cell.classList.add('placed', `color-${value}`);
        if (previewIndices.has(index)) cell.classList.add(previewIndices.get(index));

        els.board.appendChild(cell);
      }
    }
  }

  function renderTray() {
    els.tray.replaceChildren();
    game.tray.forEach(piece => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'piece-slot';
      if (!piece) {
        slot.classList.add('used');
        slot.disabled = true;
        els.tray.appendChild(slot);
        return;
      }
      if (selectedPieceId === piece.id) slot.classList.add('selected');
      slot.dataset.pieceId = piece.id;

      const unit = getPieceUnit(piece.shape);
      const grid = document.createElement('div');
      grid.className = 'piece-grid';
      grid.style.setProperty('--piece-unit', `${unit}px`);
      grid.style.gridTemplateColumns = `repeat(${piece.shape.width}, max-content)`;
      grid.style.gridTemplateRows = `repeat(${piece.shape.height}, max-content)`;

      for (let y = 0; y < piece.shape.height; y += 1) {
        for (let x = 0; x < piece.shape.width; x += 1) {
          const filled = piece.shape.cells.some(([cx, cy]) => cx === x && cy === y);
          const cell = document.createElement('div');
          cell.className = `piece-cell ${filled ? `filled color-${piece.color}` : 'empty'}`;
          grid.appendChild(cell);
        }
      }

      slot.appendChild(grid);
      els.tray.appendChild(slot);
    });
  }

  function getPieceUnit(shape) {
    const trayWidth = els.tray.clientWidth || Math.min(window.innerWidth - 56, 760);
    const slotWidth = (trayWidth - 36) / 3;
    const slotHeight = window.innerWidth <= 480 ? 118 : window.innerWidth <= 720 ? 144 : 168;
    const hGap = 8;
    const maxByWidth = Math.floor((slotWidth - 30 - (shape.width - 1) * hGap) / shape.width);
    const maxByHeight = Math.floor((slotHeight - 30 - (shape.height - 1) * hGap) / shape.height);
    return Math.max(18, Math.min(maxByWidth, maxByHeight, 44));
  }

  function toggleSound() {
    soundOn = !soundOn;
    saveGame();
    render();
    playTone('tap');
  }

  function openSettings() {
    els.modal.hidden = false;
  }

  function closeSettings() {
    els.modal.hidden = true;
  }

  function restartGame() {
    game = newGameState();
    selectedPieceId = null;
    preview = null;
    saveGame();
    render();
  }

  function playTone(kind) {
    if (!soundOn) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    const time = audioCtx.currentTime;
    const frequency = kind === 'clear' ? 640 : kind === 'tap' ? 520 : 430;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.06, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (kind === 'clear' ? 0.24 : 0.16));
    oscillator.start(time);
    oscillator.stop(time + (kind === 'clear' ? 0.25 : 0.17));
  }

  function cryptoRandomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `piece-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
})();
