(() => {
  'use strict';
  const E = window.Shogi;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'shogi_practice_v1';
  const levelCopy = {
    rookie: '가능한 수 중에서 고르는 상대입니다. 규칙을 익히기에 좋아요.',
    beginner: '한 수의 이득을 살펴보는 연습 상대입니다.',
    intermediate: '내 응수까지 살펴봅니다. 공격과 수비를 함께 생각해 보세요.',
    advanced: '최대 세 수를 살펴보는 경량 AI입니다. 공인 고수 수준은 아닙니다.',
  };
  const descriptions = {
    P: '앞으로 한 칸. 뒤나 대각선으로는 움직이지 않습니다.', L: '앞으로 원하는 만큼. 다른 말을 뛰어넘을 수 없습니다.',
    N: '앞으로 두 칸, 좌우로 한 칸 점프합니다.', S: '앞쪽 세 방향과 뒤쪽 대각선으로 한 칸.',
    G: '뒤쪽 대각선을 제외한 여섯 방향으로 한 칸.', K: '모든 방향으로 한 칸. 공격받는 칸에는 갈 수 없습니다.',
    R: '가로·세로로 원하는 만큼. 경로가 비어 있어야 합니다.', B: '대각선으로 원하는 만큼. 경로가 비어 있어야 합니다.',
    '+R': '비차의 움직임에 대각선 한 칸 이동이 더해집니다.', '+B': '각행의 움직임에 가로·세로 한 칸 이동이 더해집니다.',
  };
  let state = E.initialState();
  let states = [state];
  let moves = [];
  let level = 'beginner';
  let selected = null;
  let hand = null;
  let available = E.legalMoves(state);
  let hint = null;
  let busy = false;
  let worker = null;
  let watchdog = null;
  let requestId = 0;
  let pendingPromotion = [];
  let pendingConfirm = null;
  let initialNotice = '';
  const coord = ([r, c]) => `${9 - c}${['一','二','三','四','五','六','七','八','九'][r]}`;
  const name = type => E.PIECES[type][1];

  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      ({ state, states, moves, level } = E.restore(JSON.parse(saved)));
      initialNotice = '저장된 대국을 이어갑니다.';
      available = E.legalMoves(state);
    }
  } catch (_) { initialNotice = '저장된 대국을 읽을 수 없어 새 판을 준비했습니다.'; }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, moves, level, resigned: state.result?.reason === 'resign' }));
      $('save-status').textContent = '이 기기에 자동 저장됨';
    } catch (_) { $('save-status').textContent = '저장 불가 · 이 화면에서 계속 가능'; }
  }
  function message(text, alert = false) {
    $('match-status').textContent = text;
    $('match-status').classList.toggle('alert', alert);
  }
  function defaultMessage() {
    if (state.result) {
      const reasons = { mate: '외통입니다.', 'no-moves': '둘 수 있는 수가 없습니다.',
        repetition: '같은 국면이 네 번 반복되었습니다.', 'perpetual-check': '연속 왕수로 같은 국면이 네 번 반복되었습니다.', resign: '기권했습니다.' };
      return `${state.result.winner === 'player' ? '승리! ' : state.result.winner === 'opponent' ? '컴퓨터의 승리. ' : '무승부. '}${reasons[state.result.reason]} 무르기로 복습하거나 새 대국을 시작하세요.`;
    }
    if (moves.length >= 600) return '600수 연습을 마쳤습니다. 저장 보호를 위해 새 대국을 시작해 주세요.';
    if (busy) return state.turn === 'opponent' ? '컴퓨터가 다음 한 수를 생각하고 있어요…' : '추천할 한 수를 살펴보고 있어요…';
    if (state.turn === 'opponent') return '컴퓨터 차례입니다.';
    if (E.inCheck(state.board, 'player')) return '왕수! 왕을 피하거나, 공격을 막거나, 공격하는 말을 잡으세요.';
    return '내 차례입니다. 말이나 말받침을 선택해 한 수를 두세요.';
  }
  function canPlay() { return !state.result && state.turn === 'player' && !busy && moves.length < 600; }
  function clearSelection() { selected = null; hand = null; hint = null; }
  function selectedMoves() { return available.filter(m => hand ? m.drop === hand : selected && E.equal(m.from, selected)); }
  function showGuide(type) {
    $('selected-guide').replaceChildren();
    const symbol = document.createElement('span'); symbol.className = 'guide-symbol'; symbol.textContent = E.PIECES[type][0];
    const content = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = name(type);
    const copy = document.createElement('p'); copy.textContent = descriptions[type] || '승격한 말입니다. 금장처럼 여섯 방향으로 한 칸 이동합니다.';
    content.append(title, copy); $('selected-guide').append(symbol, content);
  }
  function renderBoard() {
    const highlighted = selectedMoves();
    const checked = E.inCheck(state.board, state.turn);
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const p = state.board[r][c];
      const square = document.createElement('button'); square.type = 'button'; square.className = 'square';
      square.dataset.row = r; square.dataset.col = c;
      const legal = highlighted.some(m => E.equal(m.to, [r, c]));
      square.setAttribute('aria-label', `${coord([r,c])} ${p ? `${p.owner === 'player' ? '내' : '컴퓨터'} ${name(p.type)}` : '빈 칸'}${legal ? ' · 이동 가능' : ''}`);
      square.setAttribute('aria-pressed', String(E.equal(selected, [r,c])));
      if (r <= 2) square.classList.add('promotion-zone');
      if (legal) square.classList.add('legal');
      if (legal && p) square.classList.add('capture');
      if (E.equal(state.lastMove?.to, [r,c]) || E.equal(state.lastMove?.from, [r,c])) square.classList.add('last-move');
      if (E.equal(hint?.from, [r,c]) || E.equal(hint?.to, [r,c])) square.classList.add('hint');
      if (checked && p?.type === 'K' && p.owner === state.turn) square.classList.add('king-check');
      if (p) {
        const token = document.createElement('span');
        token.className = `piece ${p.owner}${p.type.startsWith('+') ? ' promoted' : ''}${E.equal(selected, [r,c]) ? ' selected' : ''}`;
        token.textContent = E.PIECES[p.type][0]; token.setAttribute('aria-hidden', 'true'); square.append(token);
      }
      square.addEventListener('click', () => onSquare([r,c]));
      // Arrow keys retain spatial navigation after re-rendering.
      square.addEventListener('keydown', event => {
        const delta = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] }[event.key];
        if (!delta) return; event.preventDefault();
        $('practice-board').querySelector(`[data-row="${r+delta[0]}"][data-col="${c+delta[1]}"]`)?.focus();
      });
      fragment.append(square);
    }
    const focused = document.activeElement;
    const focusCoord = focused?.parentElement === $('practice-board') ? [focused.dataset.row, focused.dataset.col] : null;
    $('practice-board').replaceChildren(fragment);
    if (focusCoord) $('practice-board').querySelector(`[data-row="${focusCoord[0]}"][data-col="${focusCoord[1]}"]`)?.focus({ preventScroll: true });
  }
  function renderHands() {
    for (const owner of ['player', 'opponent']) {
      const container = $(owner + '-hand'); container.replaceChildren();
      if (!state.hands[owner].length) { const empty = document.createElement('small'); empty.textContent = '잡은 말이 없습니다'; container.append(empty); }
      for (const type of E.TYPES) {
        const count = state.hands[owner].filter(t => t === type).length;
        if (!count) continue;
        const button = document.createElement('button'); button.type = 'button';
        button.className = `hand-piece${owner === 'player' && hand === type ? ' selected' : ''}`;
        button.textContent = E.PIECES[type][0]; button.disabled = owner !== 'player' || !canPlay();
        button.setAttribute('aria-label', `${owner === 'player' ? '내' : '컴퓨터'} 말받침 ${name(type)} ${count}개`);
        button.setAttribute('aria-pressed', String(owner === 'player' && hand === type));
        const amount = document.createElement('span'); amount.className = 'hand-count'; amount.textContent = count; button.append(amount);
        button.addEventListener('click', () => {
          hand = hand === type ? null : type; selected = null; hint = null; showGuide(type); render();
          message(hand ? `${name(type)}을 놓을 초록 칸을 고르세요. 이보·막힌 끝줄·보병 투입 외통은 금지입니다.` : defaultMessage());
        });
        container.append(button);
      }
    }
  }
  function moveText(before, move) {
    const owner = before.turn === 'player' ? '나' : '컴퓨터';
    const type = move.drop || before.board[move.from[0]][move.from[1]].type;
    return `${owner} · ${name(type)} ${move.drop ? '투입 → ' : coord(move.from) + ' → '}${coord(move.to)}${move.promote ? ' 승격' : ''}${before.board[move.to[0]][move.to[1]] ? ' · 포획' : ''}`;
  }
  function render() {
    renderBoard(); renderHands();
    $('ai-level').value = level; $('level-help').textContent = levelCopy[level];
    $('turn-label').textContent = state.result ? '대국 종료' : state.turn === 'player' ? '내 차례 · 선공' : '컴퓨터 차례 · 후공';
    $('turn-dot').classList.toggle('thinking', busy);
    $('move-count').textContent = `${state.ply}수`;
    $('undo-move').disabled = moves.length === 0;
    $('hint-move').disabled = !canPlay(); $('resign').disabled = Boolean(state.result) || busy;
    $('ai-level').disabled = busy;
    $('move-history').replaceChildren();
    if (!moves.length) {
      const empty = document.createElement('li'); empty.className = 'empty-history'; empty.textContent = '첫 수를 두면 기록이 시작됩니다.'; $('move-history').append(empty);
    }
    moves.forEach((move, i) => {
      const li = document.createElement('li');
      const number = document.createElement('span'); number.className = 'move-number'; number.textContent = i+1;
      const text = document.createElement('span'); text.textContent = moveText(states[i], move); li.append(number, text); $('move-history').append(li);
    });
    $('move-history').scrollTop = $('move-history').scrollHeight;
  }
  function cancelJob() { requestId++; worker?.terminate(); worker = null; clearTimeout(watchdog); busy = false; }
  function commit(move) {
    try {
      const next = E.play(state, move);
      state = next; states.push(state); moves.push(move); clearSelection(); available = E.legalMoves(state);
      save(); render(); message(defaultMessage(), Boolean(state.result || E.inCheck(state.board, state.turn)));
      if (!state.result && state.turn === 'opponent' && moves.length < 600) compute('ai');
    } catch (_) { message('둘 수 없는 수입니다. 말을 다시 선택해 주세요.', true); }
  }
  function compute(kind) {
    cancelJob(); busy = true; const id = requestId;
    render(); message(defaultMessage());
    const finish = (move, failed = false) => {
      if (id !== requestId) return;
      cancelJob();
      if (!move || !available.some(m => E.sameMove(m, move))) {
        // A worker may be unavailable under restrictive browser policies.
        move = available[0]; failed = true;
      }
      if (!move) { render(); message('둘 수 있는 수가 없습니다. 새 대국을 시작하세요.', true); return; }
      if (kind === 'ai') {
        commit(move);
        if (failed && !state.result) message('컴퓨터 계산 연결이 끊겨 기본 합법 수로 진행했습니다. 이제 내 차례입니다.');
      } else {
        hint = move; selected = move.from || null; hand = move.drop || null;
        showGuide(move.drop || state.board[move.from[0]][move.from[1]].type); render();
        message(`${failed ? '가능한 한 수' : '추천 한 수'}: ${moveText(state, move)}. 표시된 칸을 눌러 두세요. 최선의 수를 보장하지는 않습니다.`);
      }
    };
    try {
      worker = new Worker('ai-worker.js');
      worker.onmessage = ({ data }) => { if (data.id === id) finish(data.move, Boolean(data.error)); };
      worker.onerror = () => finish(null, true);
      watchdog = setTimeout(() => finish(null, true), 6000);
      worker.postMessage({ id, state, level: kind === 'hint' ? 'intermediate' : level });
    } catch (_) { finish(null, true); }
  }
  function onSquare(to) {
    if (!canPlay() || $('promotion-dialog').open) return;
    const candidates = selectedMoves().filter(move => E.equal(move.to, to));
    if (candidates.length === 1) { commit(candidates[0]); return; }
    if (candidates.length > 1) {
      pendingPromotion = candidates;
      const type = state.board[selected[0]][selected[1]].type;
      $('promotion-copy').textContent = `${name(type)} → ${name('+' + type)}. 승격하지 않고 원래 움직임을 유지할 수도 있습니다.`;
      $('promotion-dialog').returnValue = ''; $('promotion-dialog').showModal(); return;
    }
    const token = state.board[to[0]][to[1]];
    if (token?.owner === 'player') {
      selected = E.equal(selected, to) ? null : to; hand = null; hint = null;
      showGuide(token.type); render();
      message(selected ? `${name(token.type)} 선택. ${selectedMoves().length ? '초록 칸으로 이동하세요.' : '지금은 이동할 수 없습니다. 왕수나 앞을 막은 말을 확인하세요.'}` : defaultMessage());
    } else message('초록 점이 있는 칸에만 둘 수 있어요. 다른 내 말을 선택해도 됩니다.', true);
  }
  $('promotion-dialog').addEventListener('close', () => {
    const value = $('promotion-dialog').returnValue;
    if (['yes', 'no'].includes(value)) {
      const move = pendingPromotion.find(m => m.promote === (value === 'yes'));
      pendingPromotion = []; if (move) commit(move);
    } else pendingPromotion = [];
  });
  function confirmAction(title, copy, action) {
    pendingConfirm = action; $('confirm-title').textContent = title; $('confirm-copy').textContent = copy;
    $('confirm-dialog').returnValue = ''; $('confirm-dialog').showModal();
  }
  $('confirm-dialog').addEventListener('close', () => {
    const action = pendingConfirm; pendingConfirm = null;
    if ($('confirm-dialog').returnValue === 'yes') action?.();
  });
  $('new-match').addEventListener('click', () => confirmAction('새 대국을 시작할까요?', '현재 대국과 기록이 새 판으로 바뀝니다. 튜토리얼 완료 기록은 유지됩니다.', () => {
    cancelJob(); state = E.initialState(); states = [state]; moves = []; clearSelection(); available = E.legalMoves(state);
    showGuide('P'); save(); render(); message(defaultMessage());
  }));
  $('resign').addEventListener('click', () => confirmAction('이번 대국을 마칠까요?', '기권하면 컴퓨터의 승리로 종료됩니다. 종료 후 무르기로 복습할 수 있습니다.', () => {
    cancelJob(); state = { ...state, result: { winner: 'opponent', reason: 'resign' } }; states[states.length - 1] = state;
    clearSelection(); available = []; save(); render(); message(defaultMessage());
  }));
  $('undo-move').addEventListener('click', () => {
    if (!moves.length) return;
    cancelJob();
    const remove = state.turn === 'player' ? 2 : 1;
    moves = moves.slice(0, Math.max(0, moves.length - remove)); states = states.slice(0, moves.length + 1);
    state = states.at(-1); clearSelection(); available = E.legalMoves(state); save(); render(); message('내 이전 차례로 돌아왔습니다. 다른 한 수를 생각해 보세요.');
  });
  $('hint-move').addEventListener('click', () => { if (canPlay()) compute('hint'); });
  $('ai-level').addEventListener('change', () => { level = $('ai-level').value; save(); render(); message('다음 컴퓨터 차례부터 선택한 난이도로 진행합니다.'); });
  window.addEventListener('pagehide', cancelJob);
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    render(); message(defaultMessage());
    if (!state.result && state.turn === 'opponent' && moves.length < 600) compute('ai');
  });
  render(); message(initialNotice || defaultMessage());
  if (!state.result && state.turn === 'opponent' && moves.length < 600) compute('ai');
})();
