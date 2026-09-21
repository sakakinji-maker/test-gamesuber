const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../public/shogi/engine');
const D = require('../public/shogi/strategies-data');

const finalPieces = {
  ibisha: {28:'R',25:'P',38:'S'},
  furibisha: {68:'R',66:'P',59:'K'},
  bogin: {24:'S',28:'R'},
  mino: {28:'K',38:'S',49:'G',58:'G',68:'R'},
  yagura: {88:'K',77:'S',78:'G',67:'G'},
  anaguma: {99:'K',98:'L',88:'S',79:'G',78:'G'},
  'silver-crown': {28:'K',27:'S',38:'G',47:'G'},
};
for (const lesson of D.lessons) test(`${lesson.id}: legal opening reaches its named formation and can continue with AI`, () => {
  const record = {version:1,level:'beginner',moves:D.transcript(lesson)};
  const {state} = E.restore(record);
  assert.equal(state.turn,'player'); assert.equal(state.result,null);
  for(const [coord,type] of Object.entries(finalPieces[lesson.id])) {
    assert.deepEqual(state.board[Number(coord[1])-1][9-Number(coord[0])],{type,owner:'player'});
  }
  assert.equal(state.board.flat().filter(Boolean).length+state.hands.player.length+state.hands.opponent.length,40);
  if(lesson.id==='bogin') {
    assert.deepEqual(state.hands.player,['P']);
    assert.deepEqual(state.hands.opponent,['P']);
    assert.equal(state.board[6][7],null); assert.equal(state.board[5][7],null); assert.equal(state.board[4][7],null);
  }
  const replyState=E.play(state,E.legalMoves(state)[0]);
  const reply=E.chooseMove(replyState,'beginner',{timeMs:20});
  assert.ok(E.legalMoves(replyState).some(m=>E.sameMove(m,reply)));
  assert.doesNotThrow(()=>E.play(replyState,reply));
});

// Controller event harness: checks interaction/state, not browser rendering.
function boot({hash='',saved='[]',storageFailure=false}={}) {
  const nodes=new Map(), storage=new Map([['shogi_strategies_v1',saved]]);
  class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.attributes={};this.className='';this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.classList={add:x=>{this.className+=' '+x;}};}
    append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}
    replaceChildren(...items){this.children=[];this.append(...items);}
    setAttribute(k,v){this.attributes[k]=String(v);}
    addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}
    emit(k,e={}){for(const fn of this.listeners[k]||[])fn(e);}
    click(){if(!this.disabled)this.emit('click');}
    focus(){document.activeElement=this;}
    scrollIntoView(){}
    querySelector(selector){const p=selector.match(/data-row="(-?\d+)"\]\[data-col="(-?\d+)"/);return p?this.children.find(e=>String(e.dataset.row)===p[1]&&String(e.dataset.col)===p[2]):null;}
  }
  const html=fs.readFileSync(require.resolve('../public/shogi/strategies.html'),'utf8');
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))nodes.set(id,new Element('div'));
  const document={activeElement:null,getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag)};
  nodes.get('strategy-category').value='all';
  const window={Shogi:E,ShogiStrategies:D,location:{hash},listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},history:{replaceState(_s,_t,url){window.location.hash=url;}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/shogi/strategies.js'),'utf8'),{window,document,
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>{if(storageFailure)throw new Error('blocked');storage.set(k,v);}}});
  const $=id=>nodes.get(id);
  const square=([r,c])=>$('strategy-board').children.find(b=>b.dataset.row===r&&b.dataset.col===c);
  const play=s=>{square(s.move.from).click();square(s.move.to).click();};
  return {$,square,play,storage,window,active:()=>document.activeElement};
}
test('all seven lessons are completable through clicks, including capture and practice link',()=>{
  for(const lesson of D.lessons){
    const ui=boot({hash:'#'+lesson.id});
    assert.equal(ui.$('strategy-board').children.length,81);
    for(const step of lesson.steps)ui.play(step);
    assert.equal(ui.$('step-count').textContent,'수업 완료!');
    assert.equal(ui.$('strategy-finish').hidden,false);
    assert.equal(ui.$('strategy-play').href,'/shogi/practice.html?strategy='+lesson.id);
    assert.deepEqual(JSON.parse(ui.storage.get('shogi_strategies_v1')),[lesson.id]);
    assert.equal(ui.$('strategy-record').children.length,lesson.steps.length*2);
    if(lesson.id==='bogin')assert.equal(ui.$('strategy-player-hand').textContent,'보병');
  }
});
test('preview does not complete lesson; undo/reset restore position; wrong legal moves do not advance',()=>{
  const ui=boot();
  ui.$('strategy-preview').click();
  assert.equal(ui.$('strategy-progress').value,0);
  assert.deepEqual(JSON.parse(ui.storage.get('shogi_strategies_v1')),[]);
  assert.ok(ui.$('strategy-board').children.every(b=>b.disabled));
  ui.$('strategy-preview').click();
  ui.square([6,4]).click();ui.square([5,4]).click();
  assert.match(ui.$('strategy-feedback').textContent,/목표와 달라/);
  assert.equal(ui.$('strategy-progress').value,0);
  ui.$('strategy-hint').click();ui.square(D.lessons[0].steps[0].move.to).click();
  assert.equal(ui.$('strategy-progress').value,1);
  ui.$('strategy-back').click();assert.equal(ui.$('strategy-progress').value,0);
  ui.play(D.lessons[0].steps[0]);ui.$('strategy-reset').click();
  assert.equal(ui.$('strategy-progress').value,0);
  assert.match(ui.square([6,7]).attributes['aria-label'],/내 보병/);
});
test('search, category, keyboard navigation and corrupted/blocked storage remain usable',()=>{
  const ui=boot({hash:'#unknown',saved:'invalid',storageFailure:true});
  assert.equal(ui.$('strategy-title').textContent,'앉은비차');
  ui.$('strategy-category').value='수비';ui.$('strategy-category').emit('change');
  assert.equal(ui.$('strategy-cards').children.length,4);
  ui.$('strategy-search').value='아나구마';ui.$('strategy-search').emit('input');
  assert.equal(ui.$('strategy-cards').children.length,1);
  ui.$('strategy-cards').children[0].click();
  assert.equal(ui.$('strategy-title').textContent,'동굴곰');
  const cell=ui.square([8,4]);cell.focus();cell.emit('keydown',{key:'ArrowLeft',preventDefault(){}});
  assert.equal(ui.active(),ui.square([8,3]));
  for(const step of D.lessons.find(l=>l.id==='anaguma').steps)ui.play(step);
  assert.match(ui.$('completion-count').textContent,/기록 저장 불가/);
  assert.equal(ui.$('strategy-finish').hidden,false);
  ui.$('strategy-search').value='없는용어';ui.$('strategy-search').emit('input');
  assert.equal(ui.$('search-empty').hidden,false);
});
