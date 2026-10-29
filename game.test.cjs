'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const E=require('../engine.js');
const single=E.SHAPES.find(s=>s.size===1).id;
const domino=E.SHAPES.find(s=>s.size===2).id;
const state=(board=Array(81).fill(0), offer=[single,single,single],rest={})=>({board,offer,score:0,level:1,streak:0,bestStreak:0,moves:0,clearedAreas:0,gameOver:false,...rest});
const fill=(b,coords)=>coords.forEach(([x,y])=>b[y*9+x]=1);
test('shapes have unique normalized coordinate sets, and remain on a 9×9 board',()=>{
  const sets=new Set();
  for(const s of E.SHAPES){assert.equal(s.cells.length,s.size);assert.ok(s.width<=9&&s.height<=9);
    assert.ok(s.cells.every(([x,y])=>x>=0&&y>=0&&x<s.width&&y<s.height));
    const key=s.cells.map(x=>x.join(',')).join(';');assert.ok(!sets.has(key));sets.add(key);
  }
});
test('placement checks boundaries and existing blocks',()=>{
  const one=E.shapeById(single),two=E.shapeById(domino),b=Array(81).fill(0);
  assert.ok(E.canPlace(b,one,0,0));assert.ok(!E.canPlace(b,one,-1,0));
  assert.ok(!E.canPlace(b,two,9,0));b[0]=1;assert.ok(!E.canPlace(b,one,0,0));
});
test('a completed row is cleared and scored once',()=>{
  const b=Array(81).fill(0);fill(b,Array.from({length:8},(_,x)=>[x,0]));
  const res=E.place(state(b),0,8,0,()=>0);
  assert.equal(res.detail.areas.length,1);assert.equal(res.detail.areas[0].type,'row');
  assert.equal(res.detail.placed,1);assert.equal(res.detail.cleared,18);assert.equal(res.detail.combo,0);
  assert.equal(res.detail.total,19);assert.equal(res.state.board.slice(0,9).reduce((a,b)=>a+b),0);
});
test('a completed column is cleared',()=>{
  const b=Array(81).fill(0);fill(b,Array.from({length:8},(_,y)=>[2,y]));
  const res=E.place(state(b),0,2,8,()=>0);
  assert.equal(res.detail.areas.length,1);assert.equal(res.detail.areas[0].type,'column');assert.equal(res.detail.total,19);
});
test('a completed 3×3 box is cleared',()=>{
  const b=Array(81).fill(0);fill(b,Array.from({length:9},(_,i)=>[i%3,Math.floor(i/3)]).filter(([x,y])=>x!==2||y!==2));
  const res=E.place(state(b),0,2,2,()=>0);
  assert.equal(res.detail.areas.length,1);assert.equal(res.detail.areas[0].type,'box');assert.equal(res.detail.total,19);
});
test('row and box combo scores overlap as a set of 15 unique cells, not 18',()=>{
  const b=Array(81).fill(0);
  fill(b,Array.from({length:8},(_,i)=>[i+1,0]));
  fill(b,[[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]]);
  const res=E.place(state(b),0,0,0,()=>0);
  assert.equal(res.detail.areas.length,2);assert.equal(res.detail.indices.length,15);
  assert.deepEqual([res.detail.placed,res.detail.cleared,res.detail.combo,res.detail.total],[1,30,12,43]);
});
test('consecutive clear increases multiplier and a non-clear resets it',()=>{
  const b=Array(81).fill(0);
  fill(b,Array.from({length:8},(_,x)=>[x,0]));fill(b,Array.from({length:8},(_,x)=>[x,1]));
  const r1=E.place(state(b),0,8,0,()=>0);
  const r2=E.place(r1.state,1,8,1,()=>0);
  assert.equal(r1.state.streak,1);assert.equal(r2.state.streak,2);
  assert.equal(r2.detail.cleared,36);assert.equal(r2.detail.total,37);
  const r3=E.place(r2.state,2,4,4,()=>0);
  assert.equal(r3.state.streak,0);assert.equal(r3.state.bestStreak,2);
});
test('level thresholds increase and level numbering has no artificial cap',()=>{
  assert.equal(E.levelStart(1),0);assert.equal(E.levelStart(2),250);
  assert.equal(E.levelStart(3),625);assert.equal(E.levelStart(4),1125);
  assert.equal(E.levelAtScore(249),1);assert.equal(E.levelAtScore(250),2);
  assert.equal(E.levelAtScore(E.levelStart(1000)),1000);
  const b=Array(81).fill(0);fill(b,Array.from({length:8},(_,x)=>[x,0]));
  const r=E.place(state(b,[single,single,single],{score:240}),0,8,0,()=>0);
  assert.equal(r.state.level,2);assert.equal(r.detail.leveledUp,true);
});
test('used slots are replenished only after all three pieces are placed',()=>{
  let s=state();
  s=E.place(s,0,0,0,()=>0).state;assert.equal(s.offer[0],null);
  s=E.place(s,1,2,0,()=>0).state;assert.equal(s.offer[1],null);
  s=E.place(s,2,4,0,()=>0).state;
  assert.ok(s.offer.every(id=>Number.isInteger(id)));
});
test('an invalid move returns null and does not mutate the board',()=>{
  const s=state();const first=E.place(s,0,0,0,()=>0);
  assert.equal(E.place(first.state,1,0,0,()=>0),null);
  assert.equal(s.board[0],0);
});
test('a new offer contains a playable piece if a single-cell placement remains',()=>{
  const b=Array(81).fill(1);b[13]=0;
  const offer=E.newOffer(b,100,()=>.99);
  assert.equal(offer.length,3);
  assert.ok(offer.some(id=>E.canFitSomewhere(b,E.shapeById(id))));
});
test('detects no available move and validates serialized state',()=>{
  const s=state(Array(81).fill(1),[single,domino,null]);
  assert.equal(E.noMoves(s),true);
  assert.equal(E.validState(E.newGame(()=>0)),true);
  assert.equal(E.validState({...s,board:[0]}),false);
});
