const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DIFFICULTIES,
  LESSONS,
  createBoard,
  getLegalMoves,
  isKingInCheck,
  isKingCheckmated,
  promotePiece,
} = require('../public/shogi/game.js');

const hasMove = (moves, row, col) => moves.some(([r, c]) => r === row && c === col);

test('tutorial contains four difficulties with three challenges each', () => {
  assert.equal(DIFFICULTIES.length, 4);
  assert.equal(LESSONS.length, 13);
  assert.equal(LESSONS.filter((lesson) => lesson.objective).length, 12);
  for (const difficulty of DIFFICULTIES) {
    assert.equal(LESSONS.filter((lesson) => lesson.difficulty === difficulty.id).length, 3);
  }
  assert.deepEqual(
    LESSONS.slice(1).map((lesson) => lesson.objective.kind),
    ['move', 'move', 'capture', 'promote', 'drop', 'check', 'capture', 'move', 'escape', 'check', 'check', 'mate'],
  );
});

test('every board challenge hint is a legal move', () => {
  for (const lesson of LESSONS.slice(1)) {
    if (!lesson.hint.from) continue;
    const board = createBoard(lesson.pieces);
    assert.equal(
      hasMove(getLegalMoves(board, lesson.hint.from), ...lesson.hint.to),
      true,
      `${lesson.kicker}: hinted move must be legal`,
    );
  }
});

test('player pawn advances exactly one square', () => {
  const board = createBoard([{ type: 'P', owner: 'player', row: 6, col: 4 }]);
  assert.deepEqual(getLegalMoves(board, [6, 4]), [[5, 4]]);
});

test('gold general uses its six legal directions', () => {
  const board = createBoard([{ type: 'G', owner: 'player', row: 4, col: 4 }]);
  const moves = getLegalMoves(board, [4, 4]);
  assert.equal(moves.length, 6);
  for (const expected of [[3, 3], [3, 4], [3, 5], [4, 3], [4, 5], [5, 4]]) {
    assert.equal(hasMove(moves, ...expected), true);
  }
});

test('rook cannot jump over another piece', () => {
  const board = createBoard([
    { type: 'R', owner: 'player', row: 7, col: 4 },
    { type: 'P', owner: 'player', row: 5, col: 4 },
  ]);
  const moves = getLegalMoves(board, [7, 4]);
  assert.equal(hasMove(moves, 6, 4), true);
  assert.equal(hasMove(moves, 5, 4), false);
  assert.equal(hasMove(moves, 4, 4), false);
});

test('bishop moves diagonally and captures at the end of its path', () => {
  const lesson = LESSONS[7];
  const board = createBoard(lesson.pieces);
  const moves = getLegalMoves(board, lesson.hint.from);
  assert.equal(hasMove(moves, ...lesson.hint.to), true);
  assert.equal(board[lesson.hint.to[0]][lesson.hint.to[1]].type, 'S');
});

test('knight jumps over a blocked front line', () => {
  const lesson = LESSONS[8];
  const board = createBoard(lesson.pieces);
  const moves = getLegalMoves(board, lesson.hint.from);
  assert.equal(moves.length, 2);
  assert.equal(hasMove(moves, 5, 3), true);
  assert.equal(hasMove(moves, 5, 5), true);
});

test('lance advances along its file and stops at a blocker', () => {
  const board = createBoard([
    { type: 'L', owner: 'player', row: 7, col: 4 },
    { type: 'P', owner: 'opponent', row: 3, col: 4 },
  ]);
  const moves = getLegalMoves(board, [7, 4]);
  assert.equal(hasMove(moves, 3, 4), true);
  assert.equal(hasMove(moves, 2, 4), false);
});

test('pawn promotes to tokin inside the promotion zone', () => {
  assert.equal(promotePiece('P', 2, 'player'), '+P');
  assert.equal(promotePiece('P', 3, 'player'), 'P');
  assert.equal(promotePiece('G', 2, 'player'), 'G');
});

test('beginner rook move creates check on the opponent king', () => {
  const board = createBoard(LESSONS[6].pieces);
  board[7][2] = null;
  board[7][4] = { type: 'R', owner: 'player' };
  assert.equal(isKingInCheck(board, 'opponent'), true);
});

test('intermediate defense blocks the rook check', () => {
  const lesson = LESSONS[9];
  const board = createBoard(lesson.pieces);
  assert.equal(isKingInCheck(board, 'player'), true);
  board[7][3] = null;
  board[7][4] = { type: 'G', owner: 'player' };
  assert.equal(isKingInCheck(board, 'player'), false);
});

test('advanced fork and discovered attack both create check', () => {
  for (const lesson of [LESSONS[10], LESSONS[11]]) {
    const board = createBoard(lesson.pieces);
    const moving = board[lesson.hint.from[0]][lesson.hint.from[1]];
    board[lesson.hint.from[0]][lesson.hint.from[1]] = null;
    board[lesson.hint.to[0]][lesson.hint.to[1]] = moving;
    assert.equal(isKingInCheck(board, 'opponent'), true, lesson.kicker);
  }
});

test('advanced final rook drop is checkmate', () => {
  const lesson = LESSONS[12];
  const board = createBoard(lesson.pieces);
  board[lesson.hint.to[0]][lesson.hint.to[1]] = { type: 'R', owner: 'player' };
  assert.equal(isKingInCheck(board, 'opponent'), true);
  assert.equal(isKingCheckmated(board, 'opponent'), true);
});
