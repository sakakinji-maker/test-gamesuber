const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../public/shogi/engine');

function position(tokens, turn = 'player', hands = {}) {
  const state = E.blank();
  for (const [type, owner, row, col] of tokens) state.board[row][col] = { type, owner };
  state.turn = turn;
  state.hands = { player: [], opponent: [], ...hands };
  state.positions = [{ key: E.positionKey(state), turn, check: E.inCheck(state.board, turn) }];
  return state;
}
const kings = [['K', 'player', 8, 8], ['K', 'opponent', 0, 8]];
const at = (moves, from, to) => moves.filter(m => E.equal(m.from, from) && E.equal(m.to, to));
const drops = (state, type, to) => E.legalMoves(state).filter(m => m.drop === type && (!to || E.equal(m.to, to)));

test('standard setup has 40 pieces and 30 legal opening moves', () => {
  const s = E.initialState();
  assert.equal(s.board.flat().filter(Boolean).length, 40);
  assert.equal(E.legalMoves(s).length, 30);
  assert.equal(s.board[7][7].type, 'R');
  assert.equal(s.board[1][1].type, 'R');
  assert.equal(E.inCheck(s.board, 'player'), false);
});

test('play alternates turns without mutating the previous position', () => {
  const s = E.initialState();
  const snapshot = JSON.stringify(s);
  const next = E.play(s, { from: [6,4], to: [5,4], promote: false });
  assert.equal(next.turn, 'opponent');
  assert.equal(next.ply, 1);
  assert.equal(next.positions.length, 2);
  assert.equal(JSON.stringify(s), snapshot);
  assert.throws(() => E.play(next, { from: [6,3], to: [5,3] }));
});

test('cannot leave own king in check or move a pinned defender away', () => {
  const s = position([['K','player',8,4], ['K','opponent',0,8], ['R','opponent',0,4], ['G','player',7,4]]);
  assert.equal(at(E.legalMoves(s), [7,4], [7,3]).length, 0);
  assert.equal(at(E.legalMoves(s), [7,4], [6,4]).length, 1);
  s.board[7][4] = null;
  s.board[7][3] = { type: 'G', owner: 'player' };
  assert.equal(E.inCheck(s.board, 'player'), true);
  assert.equal(at(E.legalMoves(s), [7,3], [7,4]).length, 1);
  assert.equal(at(E.legalMoves(s), [7,3], [6,3]).length, 0);
});

test('kings cannot enter attack or capture each other', () => {
  const s = position([['K','player',4,4], ['K','opponent',2,4]]);
  assert.equal(at(E.legalMoves(s), [4,4], [3,4]).length, 0);
  s.board[2][4] = null; s.board[3][4] = { type: 'K', owner: 'opponent' };
  assert.equal(at(E.legalMoves(s), [4,4], [3,4]).length, 0);
});

test('promotion is optional on entering, within, and leaving enemy camp for both sides', () => {
  for (const owner of ['player','opponent']) {
    const rows = owner === 'player' ? [[3,2],[2,1],[2,3]] : [[5,6],[6,7],[6,5]];
    for (const [from, to] of rows) {
      const s = position([...kings, ['S',owner,from,4]], owner);
      const variants = at(E.legalMoves(s), [from,4], [to, from < to && owner === 'player' || from > to && owner === 'opponent' ? 3 : 4]);
      assert.equal(variants.length, 2, `${owner}: ${from} → ${to}`);
      assert.deepEqual(new Set(variants.map(m => m.promote)), new Set([true,false]));
    }
  }
});

test('pawn, lance and knight must promote on dead ranks', () => {
  for (const owner of ['player','opponent']) for (const type of ['P','L','N']) {
    const row = owner === 'player' ? type === 'N' ? 2 : 1 : type === 'N' ? 6 : 7;
    const to = [owner === 'player' ? 0 : 8, type === 'N' ? 3 : 4];
    const s = position([...kings, [type,owner,row,4]], owner);
    const variants = at(E.legalMoves(s), [row,4], to);
    assert.equal(variants.length, 1);
    assert.equal(variants[0].promote, true);
    assert.equal(E.play(s, variants[0]).board[to[0]][to[1]].type, '+' + type);
  }
});

test('all promoted pieces have correct movement', () => {
  for (const type of ['+P','+L','+N','+S']) {
    const s = position([...kings, [type,'player',4,4]]);
    assert.equal(E.pseudoMoves(s.board, [4,4]).length, 6);
    assert.equal(E.pseudoMoves(s.board, [4,4]).some(to => E.equal(to, [5,3])), false);
  }
  for (const [type, step, forbidden] of [['+R',[3,3],[2,2]], ['+B',[4,3],[4,2]]]) {
    const s = position([...kings, [type,'player',4,4]]);
    assert.ok(E.pseudoMoves(s.board, [4,4]).some(to => E.equal(to, step)));
    assert.ok(!E.pseudoMoves(s.board, [4,4]).some(to => E.equal(to, forbidden)));
  }
});

test('captured promoted pieces return unpromoted to hand', () => {
  const s = position([...kings, ['R','player',5,4], ['+S','opponent',4,4]]);
  const next = E.play(s, { from: [5,4], to: [4,4] });
  assert.deepEqual(next.hands.player, ['S']);
});

test('drops cannot capture, promote, duplicate a pawn file, or enter dead ranks', () => {
  for (const owner of ['player','opponent']) {
    const s = position([...kings, ['P',owner,4,4], ['+P',owner,4,5]], owner,
      { [owner]: ['P','P','L','N'] });
    const pawnDrops = drops(s, 'P');
    assert.ok(pawnDrops.length > 0);
    assert.equal(pawnDrops.some(m => m.to[1] === 4), false);
    assert.ok(pawnDrops.some(m => m.to[1] === 5));
    const last = owner === 'player' ? 0 : 8;
    assert.equal(pawnDrops.some(m => m.to[0] === last), false);
    assert.equal(drops(s, 'L').some(m => m.to[0] === last), false);
    assert.equal(drops(s, 'N').some(m => Math.abs(m.to[0] - last) < 2), false);
    assert.equal(drops(s, 'P', [4,5]).length, 0);
    const move = pawnDrops.find(m => m.to[0] === (owner === 'player' ? 2 : 6));
    const next = E.play(s, move);
    assert.equal(next.board[move.to[0]][move.to[1]].type, 'P');
    assert.equal(next.hands[owner].filter(t => t === 'P').length, 1);
    assert.equal(pawnDrops.length, new Set(pawnDrops.map(m => m.to.join(','))).size);
  }
});

test('pawn-drop mate is forbidden, rook-drop mate wins, for both sides', () => {
  for (const owner of ['player','opponent']) {
    const opponent = E.other(owner);
    const row = r => owner === 'player' ? r : 8-r;
    const s = position([['K',opponent,row(0),4], ['L',owner,row(2),3], ['L',owner,row(2),5],
      ['G',owner,row(2),4], ['K',owner,row(8),8]], owner, { [owner]: ['P','R'] });
    const to = [row(1),4];
    assert.equal(drops(s, 'P', to).length, 0);
    const next = E.play(s, { drop: 'R', to });
    assert.deepEqual(next.result, { winner: owner, reason: 'mate' });
  }
});

test('ordinary pawn-drop check is allowed when king can escape or defender captures', () => {
  const s = position([['K','opponent',0,4], ['G','player',2,4], ['K','player',8,8]], 'player', {player:['P']});
  assert.equal(drops(s, 'P', [1,4]).length, 1);
  s.board[2][3] = {type:'L',owner:'player'}; s.board[2][5] = {type:'L',owner:'player'};
  s.board[1][0] = {type:'R',owner:'opponent'};
  assert.equal(drops(s, 'P', [1,4]).length, 1);
});

test('checkmate adjudication includes interposing moves and hand drops', () => {
  const s = position([['K','opponent',0,4], ['P','opponent',0,3], ['P','opponent',0,5],
    ['P','opponent',1,3], ['P','opponent',1,5], ['R','player',5,3], ['K','player',8,8]], 'player', {opponent:['G']});
  const next = E.play(s, {from:[5,3],to:[5,4]});
  assert.equal(E.inCheck(next.board, 'opponent'), true);
  assert.equal(next.result, null);
  assert.ok(drops(next,'G',[1,4]).length);
});

test('fourfold repetition draws and perpetual checking loses', () => {
  let s = position([['K','player',8,8],['K','opponent',0,0]]);
  const loop = [{from:[8,8],to:[8,7]}, {from:[0,0],to:[0,1]}, {from:[8,7],to:[8,8]}, {from:[0,1],to:[0,0]}];
  for (let n=0;n<3;n++) for (const move of loop) s = E.play(s, move);
  assert.deepEqual(s.result, {winner:null,reason:'repetition'});
  const history = [{key:'repeat',turn:'player',check:false}];
  for (let n=0;n<3;n++) history.push({key:'response',turn:'opponent',check:true}, {key:'repeat',turn:'player',check:false});
  assert.deepEqual(E.repetitionResult(history), {winner:'opponent',reason:'perpetual-check'});
});

test('save replay restores legal state and rejects malformed or illegal records', () => {
  const moves = [{from:[6,4],to:[5,4]}, {from:[2,4],to:[3,4]}];
  const record = {version:1,level:'beginner',moves};
  const restored = E.restore(record);
  assert.equal(restored.state.ply,2);
  assert.equal(restored.states.length,3);
  assert.equal(restored.state.turn,'player');
  assert.throws(() => E.restore({...record,version:2}));
  assert.throws(() => E.restore({...record,moves:[{from:[6,4],to:[3,4]}]}));
  assert.throws(() => E.restore({...record,moves:[null]}));
  assert.throws(() => E.restore({...record,level:'untrusted'}));
  assert.equal(E.restore({...record,resigned:true}).state.result.reason,'resign');
});

test('all AI levels and timeout fallback return legal moves without mutating state', () => {
  const s = E.initialState();
  const before = JSON.stringify(s);
  const legal = E.legalMoves(s);
  for (const level of ['rookie','beginner','intermediate','advanced']) {
    const move = E.chooseMove(s,level,{timeMs:100,random:()=>0});
    assert.ok(legal.some(m => E.sameMove(m,move)));
  }
  assert.ok(legal.some(m => E.sameMove(m,E.chooseMove(s,'advanced',{timeMs:-1}))));
  assert.equal(JSON.stringify(s),before);
});

test('AI recognizes a mating move and returns null after game over', () => {
  const s = position([['K','opponent',0,4],['L','player',2,3],['G','player',2,4],['L','player',2,5],['K','player',8,8]], 'player', {player:['R']});
  const move = E.chooseMove(s,'beginner',{timeMs:3000});
  const next = E.play(s,move);
  assert.equal(next.result?.reason,'mate');
  assert.equal(E.chooseMove(next),null);
});

test('random legal self-play preserves all forty pieces and each moving king safety', () => {
  let s = E.initialState(); let seed = 42;
  for (let i=0;i<120 && !s.result;i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const legal = E.legalMoves(s);
    const owner = s.turn;
    s = E.play(s,legal[seed % legal.length]);
    assert.equal(E.inCheck(s.board,owner),false);
    assert.equal(s.board.flat().filter(Boolean).length+s.hands.player.length+s.hands.opponent.length,40);
  }
});
