/* Shared, DOM-free rules for the practice board and its worker. */
(function (root) {
  'use strict';
  const TYPES = ['P', 'L', 'N', 'S', 'G', 'B', 'R'];
  const PIECES = {
    K: ['王', '왕장'], R: ['飛', '비차'], B: ['角', '각행'], G: ['金', '금장'],
    S: ['銀', '은장'], N: ['桂', '계마'], L: ['香', '향차'], P: ['歩', '보병'],
    '+R': ['龍', '용왕'], '+B': ['馬', '용마'], '+S': ['全', '성은'],
    '+N': ['圭', '성계'], '+L': ['杏', '성향'], '+P': ['と', '토킨'],
  };
  const VALUES = { K: 0, R: 950, B: 850, G: 550, S: 450, N: 300, L: 300, P: 100,
    '+R': 1250, '+B': 1150, '+S': 550, '+N': 550, '+L': 550, '+P': 550 };
  const other = (owner) => owner === 'player' ? 'opponent' : 'player';
  const base = (type) => type.replace('+', '');
  const inside = (r, c) => r >= 0 && r < 9 && c >= 0 && c < 9;
  const equal = (a, b) => Boolean(a && b && a[0] === b[0] && a[1] === b[1]);
  const zone = (owner, row) => owner === 'player' ? row <= 2 : row >= 6;
  const deadRank = (type, owner, row) => {
    const distance = owner === 'player' ? row : 8 - row;
    return (['P', 'L'].includes(type) && distance === 0) || (type === 'N' && distance <= 1);
  };
  function blank() {
    return { board: Array.from({ length: 9 }, () => Array(9).fill(null)),
      hands: { player: [], opponent: [] }, turn: 'player', ply: 0, result: null, lastMove: null, positions: [] };
  }
  function positionKey(state) {
    return JSON.stringify([state.board, [...state.hands.player].sort(), [...state.hands.opponent].sort(), state.turn]);
  }
  function initialState() {
    const state = blank();
    const back = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];
    for (let c = 0; c < 9; c++) {
      state.board[0][c] = { type: back[c], owner: 'opponent' };
      state.board[2][c] = { type: 'P', owner: 'opponent' };
      state.board[6][c] = { type: 'P', owner: 'player' };
      state.board[8][c] = { type: back[c], owner: 'player' };
    }
    for (const [r, c, type, owner] of [[1, 1, 'R', 'opponent'], [1, 7, 'B', 'opponent'],
      [7, 1, 'B', 'player'], [7, 7, 'R', 'player']]) state.board[r][c] = { type, owner };
    state.positions = [{ key: positionKey(state), turn: state.turn, check: false }];
    return state;
  }
  function pseudoMoves(board, from) {
    const [r, c] = from;
    const token = board[r]?.[c];
    if (!token) return [];
    const moves = [];
    const d = token.owner === 'player' ? -1 : 1;
    const step = (dr, dc) => {
      if (inside(r + dr, c + dc) && board[r + dr][c + dc]?.owner !== token.owner) moves.push([r + dr, c + dc]);
    };
    const ray = (dr, dc) => {
      for (let n = 1; inside(r + dr * n, c + dc * n); n++) {
        const target = board[r + dr * n][c + dc * n];
        if (target?.owner !== token.owner) moves.push([r + dr * n, c + dc * n]);
        if (target) break;
      }
    };
    const orthogonal = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    switch (token.type) {
      case 'P': step(d, 0); break;
      case 'L': ray(d, 0); break;
      case 'N': step(2 * d, -1); step(2 * d, 1); break;
      case 'S': [[d, -1], [d, 0], [d, 1], [-d, -1], [-d, 1]].forEach(v => step(...v)); break;
      case 'G': case '+P': case '+L': case '+N': case '+S':
        [[d, -1], [d, 0], [d, 1], [0, -1], [0, 1], [-d, 0]].forEach(v => step(...v)); break;
      case 'K': [...orthogonal, ...diagonal].forEach(v => step(...v)); break;
      case 'R': case '+R':
        orthogonal.forEach(v => ray(...v));
        if (token.type === '+R') diagonal.forEach(v => step(...v));
        break;
      case 'B': case '+B':
        diagonal.forEach(v => ray(...v));
        if (token.type === '+B') orthogonal.forEach(v => step(...v));
        break;
    }
    return moves;
  }
  function inCheck(board, owner) {
    let king;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (board[r][c]?.owner === owner && board[r][c].type === 'K') king = [r, c];
    }
    if (!king) return true;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (board[r][c]?.owner === other(owner) && pseudoMoves(board, [r, c]).some(to => equal(to, king))) return true;
    }
    return false;
  }
  // For generated moves only. Public callers use play() for validation and adjudication.
  function simulate(state, move) {
    const next = { ...state, board: state.board.map(row => row.map(p => p ? { ...p } : null)),
      hands: { player: [...state.hands.player], opponent: [...state.hands.opponent] },
      turn: other(state.turn), ply: state.ply + 1, lastMove: move, result: null };
    const [r, c] = move.to;
    if (move.drop) {
      next.hands[state.turn].splice(next.hands[state.turn].indexOf(move.drop), 1);
      next.board[r][c] = { type: move.drop, owner: state.turn };
    } else {
      const token = next.board[move.from[0]][move.from[1]];
      const captured = next.board[r][c];
      if (captured) next.hands[state.turn].push(base(captured.type));
      next.board[move.from[0]][move.from[1]] = null;
      next.board[r][c] = { ...token, type: move.promote ? '+' + token.type : token.type };
    }
    return next;
  }
  function* legalIterator(state, boardOnly = false) {
    if (state.result) return;
    const owner = state.turn;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const token = state.board[r][c];
      if (token?.owner !== owner) continue;
      for (const to of pseudoMoves(state.board, [r, c])) {
        if (state.board[to[0]][to[1]]?.type === 'K') continue;
        const promotable = ['P', 'L', 'N', 'S', 'B', 'R'].includes(token.type) && (zone(owner, r) || zone(owner, to[0]));
        const variants = deadRank(token.type, owner, to[0]) ? [true] : promotable ? [true, false] : [false];
        for (const promote of variants) {
          const move = { from: [r, c], to, promote };
          if (!inCheck(simulate(state, move).board, owner)) yield move;
        }
      }
    }
    if (boardOnly) return;
    for (const type of new Set(state.hands[owner])) {
      for (let c = 0; c < 9; c++) {
        if (type === 'P' && state.board.some(row => row[c]?.owner === owner && row[c].type === 'P')) continue;
        for (let r = 0; r < 9; r++) {
          if (state.board[r][c] || deadRank(type, owner, r)) continue;
          const move = { drop: type, to: [r, c] };
          const next = simulate(state, move);
          if (inCheck(next.board, owner)) continue;
          // A pawn checks the adjacent king; a drop cannot interpose or capture it.
          // Thus only board moves need checking for the pawn-drop mate prohibition.
          const kingRow = r + (owner === 'player' ? -1 : 1);
          if (type === 'P' && next.board[kingRow]?.[c]?.type === 'K' &&
              next.board[kingRow][c].owner === other(owner) && legalIterator(next, true).next().done) continue;
          yield move;
        }
      }
    }
  }
  const legalMoves = state => [...legalIterator(state)];
  const sameMove = (a, b) => Boolean(a && b && equal(a.to, b.to) &&
    (a.drop ? a.drop === b.drop && !b.from : !b.drop && equal(a.from, b.from) && Boolean(a.promote) === Boolean(b.promote)));
  function repetitionResult(positions) {
    const key = positions.at(-1).key;
    const occurrences = positions.map((p, i) => p.key === key ? i : -1).filter(i => i >= 0);
    if (occurrences.length < 4) return null;
    const cycle = positions.slice(occurrences.at(-4) + 1);
    for (const owner of ['player', 'opponent']) {
      const checks = cycle.filter(p => p.turn === other(owner));
      if (checks.length && checks.every(p => p.check)) return { winner: other(owner), reason: 'perpetual-check' };
    }
    return { winner: null, reason: 'repetition' };
  }
  function play(state, requested) {
    const move = legalMoves(state).find(candidate => sameMove(candidate, requested));
    if (!move) throw new Error('허용되지 않는 수입니다. 왕수와 말 놓기 규칙을 확인하세요.');
    const next = simulate(state, move);
    const check = inCheck(next.board, next.turn);
    next.positions = [...state.positions, { key: positionKey(next), turn: next.turn, check }];
    if (legalIterator(next).next().done) next.result = { winner: state.turn, reason: check ? 'mate' : 'no-moves' };
    else next.result = repetitionResult(next.positions);
    return next;
  }
  function evaluate(state) {
    let value = 0;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      const advance = p.owner === 'player' ? 8 - r : r;
      const bonus = p.type === 'K' ? 0 : advance * 4 + (4 - Math.abs(4 - c)) * 2;
      value += (p.owner === state.turn ? 1 : -1) * (VALUES[p.type] + bonus);
    }
    for (const owner of ['player', 'opponent']) for (const type of state.hands[owner]) {
      value += (owner === state.turn ? 1 : -1) * VALUES[type];
    }
    return value;
  }
  function movePriority(state, move) {
    const captured = state.board[move.to[0]][move.to[1]];
    return (captured ? VALUES[captured.type] * 10 : 0) + (move.promote ? 500 : 0);
  }
  function chooseMove(state, level = 'beginner', options = {}) {
    const moves = legalMoves(state);
    if (!moves.length) return null;
    const random = options.random || Math.random;
    if (level === 'rookie') return moves[Math.min(moves.length - 1, Math.floor(random() * moves.length))];
    const depthLimit = { beginner: 1, intermediate: 2, advanced: 3 }[level] || 1;
    const deadline = Date.now() + (options.timeMs ?? 850);
    const timeout = Symbol('timeout');
    const search = (node, depth, alpha, beta) => {
      if (Date.now() > deadline) throw timeout;
      const children = legalMoves(node);
      if (!children.length) return -100000 - depth;
      if (!depth) return evaluate(node);
      children.sort((a, b) => movePriority(node, b) - movePriority(node, a));
      let best = -Infinity;
      for (const move of children) {
        const score = -search(simulate(node, move), depth - 1, -beta, -alpha);
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
        if (alpha >= beta) break;
      }
      return best;
    };
    moves.sort((a, b) => movePriority(state, b) - movePriority(state, a));
    let bestMove = moves[0];
    for (let depth = 1; depth <= depthLimit; depth++) {
      let score = -Infinity;
      let candidate = bestMove;
      try {
        for (const move of moves) {
          const value = -search(simulate(state, move), depth - 1, -Infinity, -score);
          if (value > score) { score = value; candidate = move; }
        }
        bestMove = candidate;
        moves.sort((a, b) => Number(sameMove(b, bestMove)) - Number(sameMove(a, bestMove)));
      } catch (error) {
        if (error !== timeout) throw error;
        break;
      }
    }
    return bestMove;
  }
  // Restore by replaying validated moves, never trust serialized board objects.
  function restore(record) {
    if (record?.version !== 1 || !Array.isArray(record.moves) || record.moves.length > 600 ||
        !['rookie', 'beginner', 'intermediate', 'advanced'].includes(record.level)) throw new Error('저장 형식 오류');
    let state = initialState();
    const states = [state];
    for (const move of record.moves) { state = play(state, move); states.push(state); }
    if (record.resigned && !state.result) state.result = { winner: 'opponent', reason: 'resign' };
    return { state, states, level: record.level, moves: record.moves };
  }
  const api = { PIECES, TYPES, VALUES, blank, initialState, pseudoMoves, inCheck, legalMoves,
    play, chooseMove, positionKey, repetitionResult, restore, equal, sameMove, other };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shogi = api;
})(typeof self !== 'undefined' ? self : this);
