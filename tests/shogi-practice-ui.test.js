// DOM/event simulation: verifies controller behavior, not browser layout or rendering.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../public/shogi/engine');
const html = fs.readFileSync(path.join(__dirname, '../public/shogi/practice.html'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, '../public/shogi/practice.js'), 'utf8');

function boot(saved, {storageFailure = false, workerFailure = false} = {}) {
  const nodes = new Map();
  const timers = new Map();
  const workers = [];
  const storage = new Map(saved ? [['shogi_practice_v1',JSON.stringify(saved)]] : []);
  let timerId = 0;
  class Element {
    constructor(tag) {
      this.tagName = tag; this.children = []; this.listeners = {}; this.dataset = {};
      this.attributes = {}; this.className = ''; this.textContent = ''; this.disabled = false; this.open = false;
      this.classList = {
        add: value => { if (!this.className.split(' ').includes(value)) this.className += ' '+value; },
        toggle: (value, enabled) => { this.className = this.className.split(' ').filter(v => v !== value).join(' '); if (enabled) this.classList.add(value); },
      };
    }
    append(...elements) {
      for (const e of elements) {
        if (e.tagName === 'fragment') this.append(...e.children);
        else { this.children.push(e); e.parentElement = this; }
      }
    }
    replaceChildren(...elements) { this.children = []; this.append(...elements); }
    setAttribute(key,value) { this.attributes[key] = String(value); }
    addEventListener(event, callback) { (this.listeners[event] ||= []).push(callback); }
    emit(event, data = {}) { for (const callback of this.listeners[event] || []) callback(data); }
    click() { if (!this.disabled) this.emit('click'); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close(value) { this.returnValue = value; this.open = false; this.emit('close'); }
    querySelector(selector) {
      const pair = selector.match(/data-row="(-?\d+)"\]\[data-col="(-?\d+)"/);
      return pair ? this.children.find(e => String(e.dataset.row) === pair[1] && String(e.dataset.col) === pair[2]) : null;
    }
  }
  for (const [,id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id,new Element('div'));
  const document = {
    activeElement: null,
    getElementById: id => nodes.get(id),
    createElement: tag => new Element(tag), createDocumentFragment: () => new Element('fragment'),
  };
  class Worker {
    constructor() { if (workerFailure) throw new Error('Worker unavailable'); workers.push(this); }
    postMessage(data) { this.data = data; }
    terminate() { this.terminated = true; }
    respond() { this.onmessage({data:{id:this.data.id,move:E.chooseMove(this.data.state,this.data.level,{timeMs:30})}}); }
  }
  const window = {Shogi:E,listeners:{},addEventListener(type,callback){this.listeners[type]=callback;}};
  vm.runInNewContext(controller, {window,document,Worker,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(storageFailure)throw new Error('Storage blocked');storage.set(key,value);}},
    setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},clearTimeout:id=>timers.delete(id),
  });
  const $ = id => nodes.get(id);
  const square = (r,c) => $('practice-board').children.find(e=>e.dataset.row===r && e.dataset.col===c);
  const snapshot = () => JSON.parse(storage.get('shogi_practice_v1'));
  return {$,square,workers,storage,snapshot,timers,window};
}

test('practice UI renders board and updates turn, record and save after computer response', () => {
  const ui = boot();
  assert.equal(ui.$('practice-board').children.length,81);
  assert.equal(ui.$('undo-move').disabled,true);
  ui.square(6,4).click();
  assert.ok(ui.square(5,4).className.includes('legal'));
  ui.square(5,4).click();
  assert.equal(ui.$('turn-label').textContent,'컴퓨터 차례 · 후공');
  assert.equal(ui.$('hint-move').disabled,true);
  assert.equal(ui.snapshot().moves.length,1);
  ui.workers.at(-1).respond();
  assert.equal(ui.$('turn-label').textContent,'내 차례 · 선공');
  assert.equal(ui.snapshot().moves.length,2);
  assert.equal(ui.$('move-history').children.length,2);
});

test('undo cancels pending AI, ignores stale reply and returns full turn', () => {
  const ui = boot();
  ui.square(6,4).click(); ui.square(5,4).click();
  const stale = ui.workers.at(-1);
  ui.$('undo-move').click(); stale.respond();
  assert.equal(ui.snapshot().moves.length,0);
  assert.equal(ui.$('turn-label').textContent,'내 차례 · 선공');
  assert.equal(stale.terminated,true);
  ui.square(6,4).click(); ui.square(5,4).click(); ui.workers.at(-1).respond();
  ui.$('undo-move').click();
  assert.equal(ui.snapshot().moves.length,0);
});

test('hint highlights a move without committing it and remains playable', () => {
  const ui = boot();
  ui.$('hint-move').click(); ui.workers.at(-1).respond();
  assert.match(ui.$('match-status').textContent,/추천 한 수/);
  assert.ok(ui.$('practice-board').children.some(e=>e.className.includes('hint')));
  assert.equal(ui.$('move-count').textContent,'0수');
  assert.equal(ui.$('hint-move').disabled,false);
});

test('back-forward restoration unlocks a cancelled hint and restarts the computer turn', () => {
  const ui = boot();
  ui.$('hint-move').click();
  ui.window.listeners.pagehide(); ui.window.listeners.pageshow({persisted:true});
  assert.equal(ui.$('hint-move').disabled,false);
  ui.square(6,4).click(); ui.square(5,4).click();
  const count = ui.workers.length;
  ui.window.listeners.pagehide(); ui.window.listeners.pageshow({persisted:true});
  assert.equal(ui.workers.length,count+1);
  ui.workers.at(-1).respond();
  assert.equal(ui.$('move-count').textContent,'2수');
});

test('worker watchdog falls back to a legal move and ignores a late response', () => {
  const ui = boot();
  ui.square(6,4).click(); ui.square(5,4).click();
  const stale = ui.workers.at(-1);
  [...ui.timers.values()][0](); stale.respond();
  assert.equal(ui.$('move-count').textContent,'2수');
  assert.equal(ui.$('turn-label').textContent,'내 차례 · 선공');
  assert.match(ui.$('match-status').textContent,/기본 합법 수/);
});

test('restart confirmation cancel preserves state; confirm stops stale AI and resets', () => {
  const ui = boot();
  ui.square(6,4).click(); ui.square(5,4).click(); const stale = ui.workers.at(-1);
  ui.$('new-match').click(); ui.$('confirm-dialog').close('cancel');
  assert.equal(ui.snapshot().moves.length,1);
  ui.$('new-match').click(); ui.$('confirm-dialog').close('yes'); stale.respond();
  assert.equal(ui.snapshot().moves.length,0);
  assert.equal(ui.$('move-count').textContent,'0수');
});

test('reload resumes saved opponent turn, and resignation persists', () => {
  const record = {version:1,level:'rookie',moves:[{from:[6,4],to:[5,4]}]};
  const ui = boot(record);
  assert.equal(ui.workers.length,1);
  ui.workers.at(-1).respond(); ui.$('resign').click(); ui.$('confirm-dialog').close('yes');
  assert.equal(ui.snapshot().resigned,true);
  const again = boot(ui.snapshot());
  assert.equal(again.$('turn-label').textContent,'대국 종료');
  assert.equal(again.workers.length,0);
  again.$('undo-move').click();
  assert.equal(again.snapshot().resigned,false);
});

test('invalid saves and storage/worker failures leave a playable board', () => {
  const ui = boot({version:99},{storageFailure:true,workerFailure:true});
  assert.match(ui.$('match-status').textContent,/새 판/);
  ui.square(6,4).click(); ui.square(5,4).click();
  assert.equal(ui.$('move-count').textContent,'2수');
  assert.equal(ui.$('turn-label').textContent,'내 차례 · 선공');
  assert.match(ui.$('save-status').textContent,/저장 불가/);
  assert.match(ui.$('match-status').textContent,/기본 합법 수/);
});

test('promotion dialog offers both choices, cancellation does not commit, and drop works', () => {
  // Legal cooperative line: exchange the central pawns and promote the player's pawn.
  const record = {version:1,level:'rookie',moves:[
    {from:[6,4],to:[5,4]}, {from:[2,4],to:[3,4]},
    {from:[5,4],to:[4,4]}, {from:[0,3],to:[1,3]},
    {from:[4,4],to:[3,4]}, {from:[1,3],to:[1,2]},
  ]};
  for (const choice of ['yes','no']) {
    const ui = boot(record);
    ui.square(3,4).click(); ui.square(2,4).click();
    assert.equal(ui.$('promotion-dialog').open,true);
    ui.$('promotion-dialog').close('cancel');
    assert.equal(ui.$('move-count').textContent,'6수');
    ui.square(2,4).click(); ui.$('promotion-dialog').close(choice);
    assert.equal(ui.snapshot().moves.at(-1).promote,choice==='yes');
    assert.equal(ui.snapshot().moves.length,7);
  }
  // Move the captured pawn to a legal empty file after promoting the on-board pawn.
  const promotion = {from:[3,4],to:[2,4],promote:true};
  const follow = {...record,moves:[...record.moves,promotion,{from:[0,8],to:[1,8]}]};
  const withHand = boot(follow);
  withHand.$('player-hand').children[0].click();
  assert.ok(withHand.square(4,4).className.includes('legal'));
  withHand.square(4,4).click();
  assert.equal(withHand.snapshot().moves.at(-1).drop,'P');
});
