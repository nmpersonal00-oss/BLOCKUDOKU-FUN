/* Infinite Glow Blockudoku — deterministic, dependency-free game engine. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BlockudokuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SIZE = 9;
  const BASE = [
    [[0,0]], [[0,0],[1,0]], [[0,0],[1,0],[2,0]],
    [[0,0],[1,0],[0,1]], [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[1,0],[0,1],[1,1]],
    [[0,0],[0,1],[0,2],[1,2]],
    [[0,0],[1,0],[2,0],[1,1]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,0],[1,0],[2,0],[3,0],[4,0]],
    [[0,0],[1,0],[2,0],[0,1],[0,2]],
    [[0,0],[1,0],[0,1],[1,1],[0,2]],
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]]
  ];
  const normalize = pts => {
    const mx = Math.min(...pts.map(p => p[0]));
    const my = Math.min(...pts.map(p => p[1]));
    return pts.map(([x,y]) => [x-mx,y-my]).sort((a,b) => a[1]-b[1] || a[0]-b[0]);
  };
  const rotate = pts => pts.map(([x,y]) => [-y,x]);
  const SHAPES = [];
  const signatures = new Set();
  for (const seed of BASE) {
    let shape = seed;
    for (let r = 0; r < 4; r++) {
      const cells = normalize(shape);
      const key = cells.map(p => p.join(',')).join(';');
      if (!signatures.has(key)) {
        signatures.add(key);
        SHAPES.push(Object.freeze({
          id: SHAPES.length,
          cells: Object.freeze(cells.map(p => Object.freeze(p))),
          width: Math.max(...cells.map(p => p[0]))+1,
          height: Math.max(...cells.map(p => p[1]))+1,
          size: cells.length
        }));
      }
      shape = rotate(shape);
    }
  }
  // Keep the original shapes and their numeric IDs first: saved games from earlier
  // versions must continue to deserialize to the same pieces.
  function addShape(points) {
    const cells = normalize(points);
    const key = cells.map(p => p.join(',')).join(';');
    if (signatures.has(key)) return;
    signatures.add(key);
    SHAPES.push(Object.freeze({
      id: SHAPES.length,
      cells: Object.freeze(cells.map(p => Object.freeze(p))),
      width: Math.max(...cells.map(p => p[0])) + 1,
      height: Math.max(...cells.map(p => p[1])) + 1,
      size: cells.length
    }));
  }
  // Full set of *fixed* connected polyominoes of 1–5 squares. Unlike a
  // handful of rotated templates, this includes mirrored hooks, zigzags,
  // skewed T/F/W shapes, the full family of pentominoes, and their rotations.
  // A fixed orientation is generated in the tray; players cannot rotate it.
  let generation = [[[0, 0]]];
  for (let size = 1; size <= 5; size++) {
    if (size > 1) {
      const next = new Map();
      for (const points of generation) for (const [x, y] of points) {
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx=x+dx, ny=y+dy;
          if (points.some(([px,py]) => px===nx && py===ny)) continue;
          const shape = normalize([...points, [nx,ny]]);
          next.set(shape.map(p => p.join(',')).join(';'),shape);
        }
      }
      generation = [...next.values()];
    }
    for (const points of generation) addShape(points);
  }
  // Larger distinctive pieces, appearing increasingly often in later levels.
  // Shapes and mirrored orientations are generated without increasing the
  // count of near-duplicates in a single three-piece offer.
  const largeSeeds = [
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], // 2x3 slab
    [[0,0],[1,0],[2,0],[3,0],[0,1],[0,2]], // tall corner
    [[0,0],[1,0],[2,0],[3,0],[1,1],[1,2]], // broad T
    [[0,0],[1,0],[1,1],[2,1],[2,2],[3,2]], // long stair
    [[0,0],[1,0],[0,1],[1,1],[1,2],[2,2]], // double square offset
    [[0,0],[1,0],[2,0],[0,1],[2,1],[2,2]], // open corner
    [[0,0],[1,0],[2,0],[0,1],[1,1],[1,2]], // arrow/piece
    [[0,0],[0,1],[1,1],[2,1],[2,2],[3,2]], // snake
    [[0,0],[1,0],[2,0],[3,0],[4,0],[2,1]], // long T
    [[0,0],[1,0],[2,0],[3,0],[3,1],[3,2]], // long L
    [[0,0],[1,0],[2,0],[0,1],[1,1],[0,2]], // tapered corner
    [[0,0],[1,0],[0,1],[1,1],[2,1],[2,2]], // block twist
    [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[1,2]], // seven-cell crown
    [[0,0],[1,0],[2,0],[3,0],[0,1],[0,2],[0,3]], // long hook
    [[0,0],[1,0],[2,0],[1,1],[1,2],[1,3],[1,4]] // long T cross
  ];
  for (const seed of largeSeeds) {
    for (const reflection of [false,true]) {
      let rotated = reflection ? seed.map(([x,y]) => [-x,y]) : seed;
      for (let r=0;r<4;r++) { addShape(rotated);rotated=rotate(rotated); }
    }
  }
  Object.freeze(SHAPES);
  const familyKey = shape => {
    const keys = [];
    for (const reflected of [false,true]) {
      let cells = reflected ? shape.cells.map(([x,y])=>[-x,y]) : shape.cells;
      for (let i=0;i<4;i++) {
        keys.push(normalize(cells).map(p=>p.join(',')).join(';'));
        cells = rotate(cells);
      }
    }
    return keys.sort()[0];
  };
  const FAMILY_KEYS=SHAPES.map(familyKey);

  const shapeById = id => Number.isInteger(id) ? SHAPES[id] || null : null;
  function canPlace(board, shape, x, y) {
    if (!Array.isArray(board) || board.length !== 81 || !shape || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (x < 0 || y < 0 || x+shape.width > SIZE || y+shape.height > SIZE) return false;
    return shape.cells.every(([dx,dy]) => board[(y+dy)*SIZE+x+dx] === 0);
  }
  function canFitSomewhere(board, shape) {
    for (let y = 0; y <= SIZE-shape.height; y++) {
      for (let x = 0; x <= SIZE-shape.width; x++) {
        if (canPlace(board, shape, x, y)) return true;
      }
    }
    return false;
  }
  function getClears(board) {
    const areas = [];
    const indices = new Set();
    function add(type, number, squares) {
      if (squares.every(i => board[i] !== 0)) {
        areas.push({type, number});
        squares.forEach(i => indices.add(i));
      }
    }
    for (let row=0;row<9;row++) add('row',row,Array.from({length:9},(_,col)=>row*9+col));
    for (let col=0;col<9;col++) add('column',col,Array.from({length:9},(_,row)=>row*9+col));
    for (let by=0;by<3;by++) for (let bx=0;bx<3;bx++) {
      const squares=[];
      for (let y=0;y<3;y++) for (let x=0;x<3;x++) squares.push((by*3+y)*9+bx*3+x);
      add('box',by*3+bx,squares);
    }
    return {areas, indices:Array.from(indices)};
  }
  function levelStart(level) {
    const n=Math.max(0,Math.floor(level)-1);
    return 250*n+125*n*(n-1)/2;
  }
  function levelAtScore(score, previous=1) {
    let level=Math.max(1,Math.floor(previous));
    while (score >= levelStart(level+1)) level++;
    return level;
  }
  function maxShapeSize(level) { return level < 3 ? 5 : level < 8 ? 6 : 9; }
  function pickShape(level, rng=Math.random, excluded=new Set(), excludedFamilies=new Set()) {
    // Common pieces remain common, but interesting bends and mirrored shapes
    // appear from the very beginning. Larger pieces slowly enter circulation.
    const max = maxShapeSize(level);
    const difficulty = level < 3 ? 0 : level < 8 ? 1 : 2;
    const weights = difficulty===0
      ? [0,7,10,21,28,34,0,0,0,0]
      : difficulty===1
        ? [0,5,8,16,28,30,13,0,0,0]
        : [0,5,6,15,24,29,15,5,0,1];
    const pool = SHAPES.filter(s => s.size <= max && !excluded.has(s.id) && !excludedFamilies.has(FAMILY_KEYS[s.id]));
    if (!pool.length) return SHAPES[0].id;
    // Weight SIZE groups rather than individual IDs so the 63 different
    // pentominoes don't drown out singles, bars and smaller shapes.
    let total = 0;
    const groups = [];
    for (let size=1;size<=max;size++) {
      const variants = pool.filter(s => s.size === size);
      if (variants.length && weights[size]) {
        total += weights[size];
        groups.push({variants,upper:total});
      }
    }
    const roll = rng()*total;
    const group = groups.find(g => roll < g.upper) || groups[groups.length-1];
    const index = Math.min(group.variants.length-1,Math.floor(rng()*group.variants.length));
    return group.variants[index].id;
  }
  function newOffer(board, level, rng=Math.random) {
    const selected = new Set();
    const selectedFamilies = new Set();
    const offer = [];
    for (let i=0;i<3;i++) {
      const id = pickShape(level,rng,selected,selectedFamilies);
      offer.push(id);
      selected.add(id);
      selectedFamilies.add(FAMILY_KEYS[id]);
    }
    // Three genuinely different silhouettes per tray, while preserving the
    // classic possibility of losing if there is truly nowhere for a piece.
    if (!offer.some(id=>canFitSomewhere(board,SHAPES[id]))) {
      const possible = SHAPES.filter(s => s.size<=5 && !selected.has(s.id) && canFitSomewhere(board,s));
      if (possible.length) offer[0] = possible[Math.min(possible.length-1,Math.floor(rng()*possible.length))].id;
    }
    return offer;
  }
  function noMoves(state) {
    return !state.offer.some(id=>id!==null && canFitSomewhere(state.board,shapeById(id)));
  }
  function newGame(rng=Math.random) {
    const board=Array(81).fill(0);
    return {board, offer:newOffer(board,1,rng), score:0, level:1, streak:0, bestStreak:0,
      moves:0, clearedAreas:0, gameOver:false};
  }
  function place(state, slot, x, y, rng=Math.random) {
    const shape=shapeById(state.offer[slot]);
    if (state.gameOver || !canPlace(state.board,shape,x,y)) return null;
    const board=state.board.slice();
    const color=1+(state.moves%4);
    shape.cells.forEach(([dx,dy])=>{board[(y+dy)*9+x+dx]=color;});
    const {areas,indices}=getClears(board);
    const streak=areas.length ? state.streak+1 : 0;
    const multiplier=areas.length ? Math.min(5,streak) : 1;
    const placed=shape.size;
    const cleared=indices.length*2*multiplier;
    const combo=Math.max(0,areas.length-1)*12;
    indices.forEach(i=>{board[i]=0;});
    const score=state.score+placed+cleared+combo;
    const level=levelAtScore(score,state.level);
    let offer=state.offer.slice();
    offer[slot]=null;
    if (offer.every(id=>id===null)) offer=newOffer(board,level,rng);
    const next={board,offer,score,level,streak,bestStreak:Math.max(state.bestStreak,streak),
      moves:state.moves+1,clearedAreas:state.clearedAreas+areas.length,gameOver:false};
    next.gameOver=noMoves(next);
    return {state:next,detail:{placed,cleared,combo,total:placed+cleared+combo,areas,indices,streak,multiplier,leveledUp:level>state.level}};
  }
  function validState(state) {
    if (!state || !Array.isArray(state.board) || state.board.length !== 81 || !state.board.every(v=>Number.isInteger(v)&&v>=0&&v<=4)) return false;
    if (!Array.isArray(state.offer) || state.offer.length!==3 || !state.offer.every(id=>id===null||!!shapeById(id)))return false;
    for (const key of ['score','level','streak','bestStreak','moves','clearedAreas']) {
      if (!Number.isSafeInteger(state[key]) || state[key]<0)return false;
    }
    return state.level>=1 && typeof state.gameOver==='boolean';
  }
  return {SIZE,SHAPES,shapeById,canPlace,canFitSomewhere,getClears,levelStart,levelAtScore,
    maxShapeSize,newOffer,newGame,noMoves,place,validState};
});
