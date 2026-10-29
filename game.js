/* Infinite Glow Blockudoku — UI, animations, input, local saves, and audio. */
(function(){
'use strict';
const E=window.BlockudokuEngine;
const STORAGE='infinite-glow-blockudoku-state-v2';
const RECORDS='infinite-glow-blockudoku-records-v2';
const SOUND='infinite-glow-blockudoku-sound-v2';
const $=id=>document.getElementById(id);
const tray=$('tray'),board=$('board'),ghost=$('piece-ghost'),modal=$('dialog-backdrop');
const cellEls=[];
let game=E.newGame(),records={best:0,highestLevel:1},selected=null,preview=null,drag=null,audio=null;
let sound=true,clearing=new Set(),animationId=0,gameOverTimer=0;
const fmt=n=>n.toLocaleString('en-US');
function tryRead(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function save(){
  try{localStorage.setItem(STORAGE,JSON.stringify(game));localStorage.setItem(RECORDS,JSON.stringify(records));}catch{}
}
function load(){
  const rec=tryRead(RECORDS);
  if(rec&&Number.isSafeInteger(rec.best)&&rec.best>=0&&Number.isSafeInteger(rec.highestLevel)&&rec.highestLevel>=1) records=rec;
  const state=tryRead(STORAGE);
  if(E.validState(state)) game=state;
  const soundChoice=tryRead(SOUND);sound=soundChoice!==false;
  records.best=Math.max(records.best,game.score);
  records.highestLevel=Math.max(records.highestLevel,game.level);
  render();
  if(game.gameOver)setTimeout(()=>{if(game.gameOver)showGameOver();},400);
}
function makeBoard(){
  const fragment=document.createDocumentFragment();
  for(let i=0;i<81;i++){
    const b=document.createElement('button');b.type='button';b.dataset.index=i;
    b.setAttribute('role','gridcell');b.setAttribute('aria-label',`Row ${Math.floor(i/9)+1}, column ${i%9+1}`);
    cellEls.push(b);fragment.appendChild(b);
  }
  board.appendChild(fragment);
}
function shapeElement(shape,color,tileSize=22){
  const el=document.createElement('div');el.className='shape';
  el.style.setProperty('--cols',shape.width);el.style.setProperty('--rows',shape.height);el.style.setProperty('--tile',tileSize+'px');
  const coords=new Set(shape.cells.map(p=>p.join(',')));
  for(let y=0;y<shape.height;y++)for(let x=0;x<shape.width;x++){
    const t=document.createElement('i');t.className='shape-tile '+(coords.has(x+','+y)?'c'+color:'empty');el.appendChild(t);
  }
  return el;
}
function renderTray(){
  const fragment=document.createDocumentFragment();
  game.offer.forEach((id,index)=>{
    const shape=E.shapeById(id),button=document.createElement('button');
    button.type='button';button.className='slot'+(selected===index?' selected':'');
    button.dataset.slot=index;button.disabled=!shape||game.gameOver;
    button.setAttribute('aria-label',shape?`Piece ${index+1}: ${shape.size} square blocks`:`Piece ${index+1}: already used`);
    if(shape){const size=shape.width>=5?16:shape.width>=4?19:shape.width>=3?21:24;
      button.appendChild(shapeElement(shape,index%4+1,size));}
    fragment.appendChild(button);
  });
  tray.replaceChildren(fragment);
}
function highlightSlots(){for(const node of tray.children)node.classList.toggle('selected',Number(node.dataset.slot)===selected);}
function getPreviewIndices(){
  if(!preview||selected===null)return {indices:new Set(),valid:false};
  const shape=E.shapeById(game.offer[selected]);if(!shape)return {indices:new Set(),valid:false};
  const valid=E.canPlace(game.board,shape,preview.x,preview.y);
  const indices=new Set();
  for(const [dx,dy] of shape.cells){const x=preview.x+dx,y=preview.y+dy;if(x>=0&&x<9&&y>=0&&y<9)indices.add(y*9+x);}
  return {indices,valid};
}
function renderBoard(){
  const {indices,valid}=getPreviewIndices();
  for(let i=0;i<81;i++){
    const cell=cellEls[i],value=game.board[i],x=i%9,y=Math.floor(i/9);
    cell.className='cell'+((Math.floor(x/3)+Math.floor(y/3))%2?' zone':'')+
      ((x===2||x===5)?' right-edge':'')+((y===2||y===5)?' bottom-edge':'')+
      (value?' filled c'+value:'')+
      (indices.has(i)?' preview '+(valid?'good':'bad'):'')+
      (clearing.has(i)?' just-cleared':'');
    cell.setAttribute('aria-label',`Row ${y+1}, column ${x+1}, ${value?'occupied':'empty'}`);
  }
}
function levelTitle(l){return l<3?'COSMIC BEGINNER':l<6?'STAR SEEKER':l<10?'NOVA DREAMER':l<16?'GALAXY KEEPER':'INFINITE MASTER';}
function render(){
  $('score').textContent=fmt(game.score);$('best').textContent=fmt(records.best);$('level').textContent=fmt(game.level);
  $('level-name').textContent=`LEVEL ${fmt(game.level)} · ${levelTitle(game.level)}`;
  const start=E.levelStart(game.level),goal=E.levelStart(game.level+1)-start,current=game.score-start;
  const fraction=Math.max(0,Math.min(1,current/goal));
  $('progress-bar').style.width=(fraction*100)+'%';$('progress').setAttribute('aria-valuenow',Math.floor(fraction*100));
  $('level-progress').textContent=`${fmt(Math.max(0,current))} / ${fmt(goal)} XP`;
  $('areas').textContent=fmt(game.clearedAreas);$('moves').textContent=fmt(game.moves);$('peak').textContent=fmt(game.bestStreak);$('record-level').textContent=fmt(records.highestLevel);
  $('streak').textContent='✧ Clear streak · ×'+(game.streak?Math.min(5,game.streak):1)+(game.streak>5?' MAX':'');
  $('hint').textContent=game.gameOver?'No more shapes can fit. Start a new constellation!':selected===null?'Choose a piece, then tap the board or drag it into place.':'Tap the top-left destination cell, or drag your piece into place.';
  $('sound-button').textContent=sound?'♫ Sound on':'♫ Sound off';$('sound-button').setAttribute('aria-pressed',String(sound));
  renderBoard();renderTray();
}
function previewAt(x,y){if(preview&&preview.x===x&&preview.y===y)return;preview={x,y};renderBoard();}
function clearPreview(){if(!preview)return;preview=null;renderBoard();}
function cellAt(clientX,clientY){const r=board.getBoundingClientRect();
  if(clientX<r.left||clientX>=r.right||clientY<r.top||clientY>=r.bottom)return null;
  return {x:Math.min(8,Math.floor((clientX-r.left)/(r.width/9))),y:Math.min(8,Math.floor((clientY-r.top)/(r.height/9)))};
}
function dragAnchor(clientX,clientY,touch){
  if(selected===null)return null;const shape=E.shapeById(game.offer[selected]);if(!shape)return null;
  const targetY=clientY-(touch?52:0),r=board.getBoundingClientRect();
  if(clientX<r.left-12||clientX>r.right+12||targetY<r.top-12||targetY>r.bottom+12)return null;
  const s=r.width/9;
  return {x:Math.round((clientX-r.left)/s-shape.width/2),y:Math.round((targetY-r.top)/s-shape.height/2)};
}
function moveGhost(clientX,clientY,touch){ghost.style.left=clientX+'px';ghost.style.top=(clientY-(touch?52:0))+'px';}
function showGhost(){
  ghost.replaceChildren();const shape=E.shapeById(game.offer[selected]);if(!shape)return;
  const slot=selected===null?0:selected;
  ghost.appendChild(shapeElement(shape,slot%4+1,28));ghost.classList.add('visible');
}
function hideGhost(){ghost.classList.remove('visible');ghost.replaceChildren();}
function beginDrag(event){
  const slot=event.target.closest('.slot');if(!slot||slot.disabled||game.gameOver||!modal.hidden)return;
  if(event.button!==undefined&&event.button!==0)return;
  const index=Number(slot.dataset.slot);selected=index;clearPreview();highlightSlots();
  drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,touch:event.pointerType==='touch',moved:false};
}
tray.addEventListener('pointerdown',beginDrag);
document.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8){drag.moved=true;showGhost();}
  if(drag.moved){if(event.cancelable)event.preventDefault();moveGhost(event.clientX,event.clientY,drag.touch);
    const p=dragAnchor(event.clientX,event.clientY,drag.touch);if(p)previewAt(p.x,p.y);else clearPreview();}
},{passive:false});
document.addEventListener('pointerup',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  const last=drag;drag=null;hideGhost();
  if(last.moved){const p=dragAnchor(event.clientX,event.clientY,last.touch);
    if(p&&!placeAt(selected,p.x,p.y)){$('hint').textContent='That position is blocked. Try another space.';}
    clearPreview();}
});
document.addEventListener('pointercancel',()=>{drag=null;hideGhost();clearPreview();});
tray.addEventListener('click',event=>{ // Keyboard-generated clicks have detail 0; mouse/touch handled by pointer events.
  const slot=event.target.closest('.slot');if(!slot||slot.disabled||event.detail!==0)return;
  selected=Number(slot.dataset.slot);clearPreview();highlightSlots();$('hint').textContent='Choose a top-left destination cell on the board.';
});
board.addEventListener('pointermove',event=>{
  if(drag||selected===null||event.pointerType!=='mouse')return;
  const p=cellAt(event.clientX,event.clientY);if(p)previewAt(p.x,p.y);
});
board.addEventListener('pointerleave',()=>{if(!drag)clearPreview();});
board.addEventListener('click',event=>{
  if(selected===null||game.gameOver||!modal.hidden||drag)return;
  const cell=event.target.closest('.cell');if(!cell)return;
  const index=Number(cell.dataset.index),x=index%9,y=Math.floor(index/9);
  if(!placeAt(selected,x,y)){$('hint').textContent='That shape does not fit there. Try another space.';}
});
function celebrate(detail){
  const layer=$('toast-layer');
  const text=document.createElement('div');text.className='pop-text';
  text.textContent=detail.leveledUp?`LEVEL ${game.level} ✦`:
    `+${fmt(detail.total)}${detail.areas.length>1?' · COMBO!':detail.streak>1?' · STREAK ×'+detail.multiplier:detail.areas.length?' · CLEAR!':''}`;
  layer.appendChild(text);text.addEventListener('animationend',()=>text.remove());
  if(detail.areas.length||detail.leveledUp){
    for(let i=0;i<Math.min(32,11+detail.areas.length*6);i++){
      const spark=document.createElement('i');spark.className='spark';spark.style.setProperty('--spark',['#78f2ff','#fda6e4','#bf9dff','#87ffdb'][i%4]);
      spark.style.setProperty('--dx',((Math.random()-.5)*380)+'px');spark.style.setProperty('--dy',((Math.random()-.5)*330)+'px');
      layer.appendChild(spark);spark.addEventListener('animationend',()=>spark.remove());
    }
  }
}
function playSound(kind){
  if(!sound)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    audio=audio||new Audio();if(audio.state==='suspended')audio.resume();
    const now=audio.currentTime,base=kind==='level'?530:kind==='clear'?420:kind==='combo'?480:330;
    const count=kind==='place'?1:3;
    for(let i=0;i<count;i++){
      const oscillator=audio.createOscillator(),volume=audio.createGain();oscillator.type='sine';
      oscillator.frequency.setValueAtTime(base*(1+i*.24),now+i*.075);
      volume.gain.setValueAtTime(.0001,now+i*.075);volume.gain.exponentialRampToValueAtTime(.042,now+i*.075+.025);
      volume.gain.exponentialRampToValueAtTime(.0001,now+i*.075+.2);
      oscillator.connect(volume);volume.connect(audio.destination);oscillator.start(now+i*.075);oscillator.stop(now+i*.075+.21);
    }
  }catch{}
}
function placeAt(slot,x,y){
  const result=E.place(game,slot,x,y);
  if(!result)return false;
  game=result.state;selected=null;preview=null;
  records.best=Math.max(records.best,game.score);records.highestLevel=Math.max(records.highestLevel,game.level);
  const detail=result.detail;clearing=new Set(detail.indices);const thisAnimation=++animationId;
  setTimeout(()=>{if(thisAnimation===animationId){clearing.clear();renderBoard();}},480);
  save();render();celebrate(detail);
  playSound(detail.leveledUp?'level':detail.areas.length>1?'combo':detail.areas.length?'clear':'place');
  if(game.gameOver){clearTimeout(gameOverTimer);gameOverTimer=setTimeout(()=>{if(game.gameOver)showGameOver();},850);}
  return true;
}
function openDialog(title,icon,content,buttons){
  $('dialog-title').textContent=title;$('dialog-icon').textContent=icon;$('dialog-body').innerHTML=content;
  const actions=$('dialog-actions');actions.replaceChildren();
  for(const entry of buttons){const b=document.createElement('button');b.type='button';b.textContent=entry.text;
    b.className='action'+(entry.primary?' primary':'');b.addEventListener('click',entry.click);actions.appendChild(b);}
  modal.hidden=false;actions.querySelector('button')?.focus();
}
function closeDialog(){modal.hidden=true;}
function startNew(){
  clearTimeout(gameOverTimer);game=E.newGame();clearing.clear();animationId++;selected=null;preview=null;
  save();closeDialog();render();
}
function showGameOver(){
  openDialog('The stars will return','✦',
    `<div class="dialog-score">${fmt(game.score)}</div><p>Level ${fmt(game.level)} · ${fmt(game.moves)} pieces placed · ${fmt(game.clearedAreas)} areas cleared<br>Personal best: <strong>${fmt(records.best)} points</strong></p>`,
    [{text:'Play again ✦',primary:true,click:startNew},{text:'Close',click:closeDialog}]);
}
$('new-button').addEventListener('click',()=>openDialog('Start a new journey?','✧','<p>Your current score and board will reset. Your personal best and highest level will remain saved.</p>',[
  {text:'New game ✦',primary:true,click:startNew},{text:'Keep playing',click:closeDialog}
]));
$('sound-button').addEventListener('click',()=>{sound=!sound;try{localStorage.setItem(SOUND,JSON.stringify(sound));}catch{}render();if(sound)playSound('place');});
$('help-button').addEventListener('click',()=>openDialog('How to play','✧',
  '<p>Select any piece and tap its <strong>top-left destination</strong> on the grid, or drag from the piece tray. Pieces cannot rotate. Complete any full row, column, or 3×3 square to clear it.</p><p><strong>Scoring:</strong> +1 per placed square; +2 per unique cleared square multiplied by a consecutive clear streak (maximum ×5); +12 per extra area cleared on the same move. Overlapping cleared squares count only once.</p><p>Use all three pieces to refill the tray. Advance through unlimited score-based levels without resetting the board. The run ends when no remaining piece fits.</p>',
  [{text:'Let’s play ✦',primary:true,click:closeDialog}]));
modal.addEventListener('click',event=>{if(event.target===modal)closeDialog();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)closeDialog();});
makeBoard();load();
})();
