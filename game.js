(() => {
  'use strict';
  const E = window.BlockudokuEngine;
  if (!E) throw new Error('Blockudoku engine did not load');
  const SIZE = 9;
  const SAVE = 'blockudoku-cozy-v4';
  const BEST = 'blockudoku-best-v4';
  const SOUND = 'blockudoku-sound-v4';
  const byId = id => document.getElementById(id);
  const boardElement = byId('board');
  const trayElement = byId('tray');
  const dragLayer = byId('dragLayer');
  const cells = [];
  const colors = ['purple', 'pink', 'blue'];
  let state;
  let selectedSlot = null;
  let hovered = null;
  let drag = null;
  let audioContext = null;
  let soundOn = safeRead(SOUND) !== 'off';
  let bestScore = Math.max(0,Number(safeRead(BEST) || safeRead('blockudoku-exact-best-v1') || '0') || 0);

  function safeRead(key){try{return localStorage.getItem(key);}catch{return null;}}
  function safeWrite(key,value){try{localStorage.setItem(key,value);}catch{}}

  function signature(shape) {return shape.cells.map(pair=>pair.join(',')).sort().join('|');}
  function findShape(coords) {
    const sig = coords.map(pair=>pair.join(',')).sort().join('|');
    const found = E.SHAPES.find(s=>signature(s)===sig);
    if (!found) throw new Error('A starting piece is missing from the engine');
    return found.id;
  }
  const FIRST_OFFER = [
    findShape([[0,0],[1,0],[2,0],[0,1]]),
    findShape([[0,0],[1,0],[0,1]]),
    findShape([[1,0],[0,1],[1,1],[1,2]])
  ];

  function freshState() {
    const next = E.newGame();
    next.offer = FIRST_OFFER.slice();
    return next;
  }
  function loadState() {
    try {
      const s=JSON.parse(safeRead(SAVE) || 'null');
      return E.validState(s) ? s : null;
    }catch{return null;}
  }
  state = loadState() || freshState();
  bestScore = Math.max(bestScore,state.score);

  function persist() {
    safeWrite(SAVE,JSON.stringify(state));
    safeWrite(BEST,String(bestScore));
    safeWrite(SOUND,soundOn ? 'on' : 'off');
  }
  function announce(text){byId('announcer').textContent=text;}

  function buildBoard() {
    const frag=document.createDocumentFragment();
    for(let y=0;y<9;y++)for(let x=0;x<9;x++){
      const b=document.createElement('button');
      b.type='button';b.className='cell';b.dataset.index=String(y*9+x);
      if((Math.floor(x/3)+Math.floor(y/3))%2===1)b.classList.add('region');
      if(x===2||x===5)b.classList.add('r-border');
      if(y===2||y===5)b.classList.add('b-border');
      if(x===8)b.classList.add('last-col');
      if(y===8)b.classList.add('last-row');
      b.setAttribute('aria-label',`Row ${y+1}, column ${x+1}`);
      frag.appendChild(b);cells.push(b);
    }
    boardElement.replaceChildren(frag);
  }
  function drawBoard() {
    const previewMap=new Map();
    if(hovered && selectedSlot!==null){
      const shape=E.shapeById(state.offer[selectedSlot]);
      if(shape){
        const valid=E.canPlace(state.board,shape,hovered.x,hovered.y);
        for(const [dx,dy] of shape.cells){
          const x=hovered.x+dx,y=hovered.y+dy;
          if(x>=0&&x<9&&y>=0&&y<9)previewMap.set(y*9+x,valid?'valid':'invalid');
        }
      }
    }
    for(let i=0;i<81;i++){
      const el=cells[i];
      el.classList.remove('placed','color-1','color-2','color-3','color-4','valid','invalid');
      if(state.board[i])el.classList.add('placed',`color-${state.board[i]}`);
      const p=previewMap.get(i);if(p)el.classList.add(p);
    }
  }
  function pieceUnit(shape,slotWidth){
    const gap=3;
    const h=window.innerWidth<=370 ? 77 :window.innerWidth<650?92:140;
    const widthLimit=(slotWidth-12-gap*(shape.width-1))/shape.width;
    const heightLimit=(h-12-gap*(shape.height-1))/shape.height;
    return Math.max(9,Math.floor(Math.min(widthLimit,heightLimit,window.innerWidth>=650?37:23)));
  }
  function makePieceGrid(shape,color,unit,ghost=false) {
    const grid=document.createElement('span');
    grid.className=ghost?'drag-piece':'piece-grid';
    grid.style.setProperty('--cols',String(shape.width));
    grid.style.setProperty('--rows',String(shape.height));
    grid.style.setProperty('--unit',unit+'px');
    const occupied=new Set(shape.cells.map(([x,y])=>`${x}:${y}`));
    for(let y=0;y<shape.height;y++)for(let x=0;x<shape.width;x++){
      const el=document.createElement('i');
      el.className=(ghost?'drag-piece-cell':'piece-cell')+(occupied.has(`${x}:${y}`)?' filled color-'+color:' empty');
      grid.appendChild(el);
    }
    return grid;
  }
  function drawTray() {
    const frag=document.createDocumentFragment();
    const unitWidth=(trayElement.clientWidth-20)/3;
    state.offer.forEach((id,i)=>{
      const slot=document.createElement('button');
      slot.type='button';slot.className='piece-slot';slot.dataset.slot=String(i);
      if(id===null || state.gameOver){slot.disabled=true;if(id===null)slot.classList.add('used');}
      if(i===selectedSlot)slot.classList.add('selected');
      const shape=E.shapeById(id);
      if(shape){
        slot.appendChild(makePieceGrid(shape,colors[i],pieceUnit(shape,unitWidth)));
        slot.setAttribute('aria-label',`Piece ${i+1}, ${shape.size} blocks`);
      }else slot.setAttribute('aria-label',`Piece ${i+1} used`);
      frag.appendChild(slot);
    });
    trayElement.replaceChildren(frag);
  }
  function drawStats() {
    byId('scoreValue').textContent=state.score.toLocaleString();
    byId('bestValue').textContent=bestScore.toLocaleString();
    byId('levelValue').textContent=state.level.toLocaleString();
    document.body.classList.toggle('muted',!soundOn);
    byId('soundButton').setAttribute('aria-pressed',String(soundOn));
    byId('soundButton').setAttribute('aria-label',soundOn?'Mute sound':'Unmute sound');
    byId('toggleSoundModal').textContent='Sound: '+(soundOn?'On':'Off');
  }
  function renderAll(){drawStats();drawBoard();drawTray();}

  function setSelection(i){
    selectedSlot=i===selectedSlot?null:i;
    hovered=null;
    trayElement.querySelectorAll('.piece-slot').forEach((node,j)=>node.classList.toggle('selected',j===selectedSlot));
    drawBoard();
  }
  function boardAnchor(px,py,shape,fromTouch=false){
    const rect=boardElement.getBoundingClientRect();
    // Lift under the finger so the piece is visible while dragging on touchscreens.
    const liftedY=py-(fromTouch?58:0);
    if(px<rect.left||px>rect.right||liftedY<rect.top||liftedY>rect.bottom)return null;
    const unit=rect.width/9;
    const cellX=Math.floor((px-rect.left)/unit);
    const cellY=Math.floor((liftedY-rect.top)/unit);
    const x=Math.min(9-shape.width,Math.max(0,cellX-Math.floor(shape.width/2)));
    const y=Math.min(9-shape.height,Math.max(0,cellY-Math.floor(shape.height/2)));
    return {x,y};
  }
  function tryPlace(x,y){
    if(selectedSlot===null||state.gameOver)return false;
    const result=E.place(state,selectedSlot,x,y);
    if(!result)return false;
    state=result.state;
    bestScore=Math.max(bestScore,state.score);
    const {detail}=result;
    selectedSlot=null;hovered=null;
    persist();renderAll();
    sound(detail.areas.length?'clear':'place');
    announce(`+${detail.total} points, score ${state.score}, level ${state.level}`);
    if(state.gameOver) setTimeout(()=>openDialog('Game Over',`Score: ${state.score.toLocaleString()} · Level ${state.level}`),300);
    return true;
  }

  function onTrayPointerDown(e){
    if(e.button!==0 && e.pointerType==='mouse')return;
    const slot=e.target.closest('.piece-slot');if(!slot||slot.disabled)return;
    const i=Number(slot.dataset.slot);
    setSelection(i);
    if(selectedSlot===null)return;
    const shape=E.shapeById(state.offer[selectedSlot]);
    drag={pointer:e.pointerId,slot:i,shape,source:slot,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch',moved:false,ghost:null};
    // Keep the source element mounted for the entire pointer capture lifetime.
    try{slot.setPointerCapture(e.pointerId);}catch{}
    if(e.cancelable)e.preventDefault();
  }
  function dragPointerMove(e){
    if(!drag||e.pointerId!==drag.pointer)return;
    drag.x=e.clientX;drag.y=e.clientY;
    if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>7){
      drag.moved=true;
      const unit=Math.min(55,Math.floor(boardElement.getBoundingClientRect().width/9));
      drag.ghost=makePieceGrid(drag.shape,colors[drag.slot],unit,true);
      dragLayer.appendChild(drag.ghost);
    }
    if(!drag.moved)return;
    if(e.cancelable)e.preventDefault();
    drag.ghost.style.left=e.clientX+'px';
    drag.ghost.style.top=(e.clientY-(drag.touch?58:0))+'px';
    hovered=boardAnchor(e.clientX,e.clientY,drag.shape,drag.touch);
    drawBoard();
  }
  function endDrag(e){
    if(!drag||e.pointerId!==drag.pointer)return;
    const d=drag;
    // Clean up after resolving the drop so no tray re-render races with pointer capture.
    const anchor=d.moved?boardAnchor(e.clientX,e.clientY,d.shape,d.touch):null;
    drag=null;dragLayer.replaceChildren();
    if(d.moved && anchor && tryPlace(anchor.x,anchor.y))return;
    hovered=null;drawBoard();
  }
  function cancelDrag(){drag=null;dragLayer.replaceChildren();hovered=null;drawBoard();}

  function sound(kind){
    if(!soundOn)return;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      audioContext=audioContext||new Ctx();
      if(audioContext.state==='suspended') audioContext.resume();
      const start=audioContext.currentTime;
      const count=kind==='clear'?3:1;
      for(let j=0;j<count;j++){
        const oscillator=audioContext.createOscillator();
        const gain=audioContext.createGain();
        oscillator.type='sine';
        oscillator.frequency.value=(kind==='clear'?510:350)+j*130;
        const at=start+j*.07;
        gain.gain.setValueAtTime(.0001,at);
        gain.gain.exponentialRampToValueAtTime(.048,at+.018);
        gain.gain.exponentialRampToValueAtTime(.0001,at+.19);
        oscillator.connect(gain);gain.connect(audioContext.destination);
        oscillator.start(at);oscillator.stop(at+.2);
      }
    }catch{}
  }
  function toggleSound(){soundOn=!soundOn;drawStats();persist();if(soundOn)sound('place');}
  function openDialog(title,message=''){
    byId('settingsTitle').textContent=title;
    byId('dialogMessage').textContent=message;
    byId('dialogMessage').hidden=!message;
    byId('settingsModal').hidden=false;
  }
  function closeDialog(){byId('settingsModal').hidden=true;}
  function reset(){
    state=freshState();selectedSlot=null;hovered=null;cancelDrag();persist();renderAll();closeDialog();
    announce('Started a new game');
  }

  buildBoard();renderAll();
  trayElement.addEventListener('pointerdown',onTrayPointerDown);
  window.addEventListener('pointermove',dragPointerMove,{passive:false});
  window.addEventListener('pointerup',endDrag);
  window.addEventListener('pointercancel',cancelDrag);
  trayElement.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const slot=e.target.closest('.piece-slot');if(!slot||slot.disabled)return;
    e.preventDefault();setSelection(Number(slot.dataset.slot));
  });
  boardElement.addEventListener('click',e=>{
    if(drag||selectedSlot===null)return;
    const tile=e.target.closest('.cell');if(!tile)return;
    const shape=E.shapeById(state.offer[selectedSlot]);if(!shape)return;
    const index=Number(tile.dataset.index);
    const x=Math.max(0,Math.min(9-shape.width,index%9-Math.floor(shape.width/2)));
    const y=Math.max(0,Math.min(9-shape.height,Math.floor(index/9)-Math.floor(shape.height/2)));
    tryPlace(x,y);
  });
  boardElement.addEventListener('pointermove',e=>{
    if(drag||selectedSlot===null||e.pointerType!=='mouse')return;
    const shape=E.shapeById(state.offer[selectedSlot]);
    hovered=shape?boardAnchor(e.clientX,e.clientY,shape):null;drawBoard();
  });
  boardElement.addEventListener('pointerleave',()=>{if(!drag){hovered=null;drawBoard();}});
  byId('soundButton').addEventListener('click',toggleSound);
  byId('settingsButton').addEventListener('click',()=>openDialog('Settings'));
  byId('homeButton').addEventListener('click',()=>openDialog('Blockudoku'));
  byId('toggleSoundModal').addEventListener('click',toggleSound);
  byId('restartGameButton').addEventListener('click',reset);
  byId('closeSettingsButton').addEventListener('click',closeDialog);
  byId('settingsModal').addEventListener('click',e=>{if(e.target===byId('settingsModal'))closeDialog();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog();});
  window.addEventListener('resize',()=>{if(!drag)drawTray();});
})();
