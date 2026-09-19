const PIECES = {
  K: { kanji: '王', name: '왕장' },
  R: { kanji: '飛', name: '비차' },
  B: { kanji: '角', name: '각행' },
  G: { kanji: '金', name: '금장' },
  S: { kanji: '銀', name: '은장' },
  N: { kanji: '桂', name: '계마' },
  L: { kanji: '香', name: '향차' },
  P: { kanji: '歩', name: '보병' },
  '+P': { kanji: 'と', name: '토킨' },
};

const piece = (type, owner, row, col) => ({ type, owner, row, col });

const DIFFICULTIES = [
  { id: 'rookie', label: '왕초보', code: 'FIRST STEPS' },
  { id: 'beginner', label: '초보', code: 'CORE RULES' },
  { id: 'intermediate', label: '중급', code: 'TACTICS' },
  { id: 'advanced', label: '고급', code: 'CHECKMATE' },
];

const LESSONS = [
  {
    kicker: 'WELCOME',
    title: '열두 개의 한 수가 기다리고 있습니다.',
    description: '왕초보부터 고급까지 난이도를 선택하고, 실제 보드에서 말을 움직이며 쇼기의 규칙과 전술을 익혀 보세요.',
    ruleIcon: '王', ruleTitle: '난이도별 학습',
    ruleText: '기본 이동부터 한 수 외통까지 열두 문제를 단계적으로 연습합니다.',
    mission: '준비가 되면 왕초보 첫 문제를 시작하세요.',
    pieces: [piece('K', 'opponent', 0, 4), piece('P', 'opponent', 2, 4), piece('P', 'player', 6, 4), piece('K', 'player', 8, 4)],
  },
  {
    difficulty: 'rookie', shortTitle: '보병 전진', kicker: '왕초보 01 · PAWN', title: '보병은 앞으로 한 칸 전진합니다.',
    description: '쇼기의 보병은 가장 단순하지만 전선을 만드는 중요한 말입니다. 뒤로 물러날 수 없으므로 한 수를 신중하게 선택해야 합니다.',
    ruleIcon: '歩', ruleTitle: '보병의 움직임', ruleText: '자신이 바라보는 방향으로 정확히 한 칸만 이동합니다.',
    mission: '보병을 선택한 뒤, 붉은 표시가 있는 앞 칸으로 이동하세요.',
    pieces: [piece('K', 'opponent', 0, 4), piece('P', 'player', 6, 4), piece('K', 'player', 8, 4)],
    hint: { from: [6, 4], to: [5, 4] },
    objective: { kind: 'move', from: [6, 4], to: [5, 4] },
  },
  {
    difficulty: 'rookie', shortTitle: '금장 이동', kicker: '왕초보 02 · GOLD', title: '금장은 빈틈을 지키는 수비의 중심입니다.',
    description: '금장은 앞쪽 세 방향과 좌우, 뒤쪽 한 칸으로 움직입니다. 왕 주변을 단단하게 지킬 때 특히 강합니다.',
    ruleIcon: '金', ruleTitle: '금장의 움직임', ruleText: '뒤쪽 대각선을 제외한 여섯 방향으로 한 칸 이동합니다.',
    mission: '금장을 선택하고 왼쪽 앞 대각선의 목표 칸으로 이동하세요.',
    pieces: [piece('K', 'opponent', 0, 4), piece('G', 'player', 6, 4), piece('K', 'player', 8, 4)],
    hint: { from: [6, 4], to: [5, 3] },
    objective: { kind: 'move', from: [6, 4], to: [5, 3] },
  },
  {
    difficulty: 'rookie', shortTitle: '말 잡기', kicker: '왕초보 03 · CAPTURE', title: '상대 말이 있는 칸으로 이동하면 말을 잡습니다.',
    description: '잡은 말은 사라지지 않고 나의 말받침으로 이동합니다. 이 규칙이 쇼기만의 역전 가능성을 만듭니다.',
    ruleIcon: '飛', ruleTitle: '비차와 포획', ruleText: '비차는 가로와 세로로 원하는 만큼 이동하며, 경로의 말을 뛰어넘을 수 없습니다.',
    mission: '비차로 앞쪽의 상대 보병을 잡아 말받침에 추가하세요.',
    pieces: [piece('K', 'opponent', 0, 7), piece('P', 'opponent', 4, 4), piece('R', 'player', 7, 4), piece('K', 'player', 8, 7)],
    hint: { from: [7, 4], to: [4, 4] },
    objective: { kind: 'capture', from: [7, 4], to: [4, 4], captured: 'P' },
  },
  {
    difficulty: 'beginner', shortTitle: '보병 승격', kicker: '초보 01 · PROMOTION', title: '적진에 들어가면 더 강한 말로 승격합니다.',
    description: '상대 진영의 마지막 세 줄은 승격 지역입니다. 보병이 승격하면 금장처럼 움직이는 토킨이 됩니다.',
    ruleIcon: 'と', ruleTitle: '보병의 승격', ruleText: '이번 연습에서는 승격 지역에 진입하는 순간 자동으로 토킨이 됩니다.',
    mission: '보병을 붉은 승격 지역으로 전진시켜 토킨으로 만드세요.',
    pieces: [piece('K', 'opponent', 0, 7), piece('P', 'player', 3, 4), piece('K', 'player', 8, 7)],
    hint: { from: [3, 4], to: [2, 4] },
    objective: { kind: 'promote', from: [3, 4], to: [2, 4] },
  },
  {
    difficulty: 'beginner', shortTitle: '말 놓기', kicker: '초보 02 · DROP', title: '잡은 말은 원하는 순간 다시 투입할 수 있습니다.',
    description: '말받침의 말은 자신의 차례에 빈 칸으로 내려놓을 수 있습니다. 공격과 수비의 흐름을 단번에 바꾸는 핵심 규칙입니다.',
    ruleIcon: '歩', ruleTitle: '말 놓기', ruleText: '말받침의 보병을 먼저 선택하고, 보드의 빈 목표 칸을 선택합니다.',
    mission: '나의 말받침에 있는 보병을 중앙의 목표 칸에 놓으세요.',
    pieces: [piece('K', 'opponent', 0, 4), piece('K', 'player', 8, 4)], playerHand: ['P'],
    hint: { hand: 'P', to: [4, 4] },
    objective: { kind: 'drop', piece: 'P', to: [4, 4] },
  },
  {
    difficulty: 'beginner', shortTitle: '왕수 만들기', kicker: '초보 03 · CHECK', title: '왕의 퇴로를 압박하면 왕수가 됩니다.',
    description: '다음 수에 상대 왕을 잡을 수 있는 상태를 왕수라고 합니다. 상대는 반드시 왕수를 피하는 수를 두어야 합니다.',
    ruleIcon: '王', ruleTitle: '왕수 만들기', ruleText: '비차를 왕과 같은 세로줄에 배치하면 멀리서 왕을 압박할 수 있습니다.',
    mission: '비차를 목표 칸으로 이동해 상대 왕에게 왕수를 거세요.',
    pieces: [piece('K', 'opponent', 1, 4), piece('R', 'player', 7, 2), piece('K', 'player', 8, 4)],
    hint: { from: [7, 2], to: [7, 4] },
    objective: { kind: 'check', from: [7, 2], to: [7, 4], targetOwner: 'opponent' },
  },
  {
    difficulty: 'intermediate', shortTitle: '각행 포획', kicker: '중급 01 · BISHOP', title: '각행은 대각선의 빈틈을 파고듭니다.',
    description: '각행은 대각선으로 원하는 만큼 이동합니다. 멀리 떨어진 상대 말도 경로가 비어 있다면 단숨에 잡을 수 있습니다.',
    ruleIcon: '角', ruleTitle: '각행의 움직임', ruleText: '네 대각선 방향으로 이동하지만 다른 말을 뛰어넘을 수 없습니다.',
    mission: '각행으로 대각선 끝의 상대 은장을 잡으세요.',
    pieces: [piece('K', 'opponent', 0, 7), piece('S', 'opponent', 4, 4), piece('B', 'player', 7, 1), piece('K', 'player', 8, 7)],
    hint: { from: [7, 1], to: [4, 4] },
    objective: { kind: 'capture', from: [7, 1], to: [4, 4], captured: 'S' },
  },
  {
    difficulty: 'intermediate', shortTitle: '계마 뛰기', kicker: '중급 02 · KNIGHT', title: '계마는 앞의 말을 뛰어넘습니다.',
    description: '계마는 쇼기에서 다른 말을 뛰어넘을 수 있는 유일한 말입니다. 막힌 진형에서도 예상 밖의 공격로를 만듭니다.',
    ruleIcon: '桂', ruleTitle: '계마의 움직임', ruleText: '앞으로 두 칸, 좌우로 한 칸 떨어진 두 곳 중 하나로 점프합니다.',
    mission: '앞을 막고 있는 보병을 뛰어넘어 왼쪽 목표 칸으로 이동하세요.',
    pieces: [piece('K', 'opponent', 0, 4), piece('P', 'player', 6, 3), piece('P', 'player', 6, 4), piece('P', 'player', 6, 5), piece('N', 'player', 7, 4), piece('K', 'player', 8, 7)],
    hint: { from: [7, 4], to: [5, 3] },
    objective: { kind: 'move', from: [7, 4], to: [5, 3] },
  },
  {
    difficulty: 'intermediate', shortTitle: '왕수 막기', kicker: '중급 03 · DEFENSE', title: '공격보다 먼저 왕수를 막아야 합니다.',
    description: '왕수가 걸리면 반드시 왕을 피하거나, 공격 말을 잡거나, 공격 경로를 막아야 합니다. 이번에는 금장으로 길을 막습니다.',
    ruleIcon: '金', ruleTitle: '공격 경로 막기', ruleText: '장거리 공격의 경로 사이에 내 말을 배치하면 왕수를 차단할 수 있습니다.',
    mission: '금장을 왕 앞의 목표 칸으로 옮겨 비차의 세로 공격을 막으세요.',
    pieces: [piece('R', 'opponent', 0, 4), piece('G', 'player', 7, 3), piece('K', 'player', 8, 4)],
    hint: { from: [7, 3], to: [7, 4] },
    objective: { kind: 'escape', from: [7, 3], to: [7, 4], targetOwner: 'player' },
  },
  {
    difficulty: 'advanced', shortTitle: '양갈래 공격', kicker: '고급 01 · FORK', title: '한 수로 두 목표를 동시에 압박합니다.',
    description: '각행을 중앙으로 전진시키면 상대 왕에게 왕수를 걸면서 반대 대각선의 비차까지 노릴 수 있습니다.',
    ruleIcon: '角', ruleTitle: '양갈래 공격', ruleText: '상대가 왕수를 피하는 동안 다른 중요 말을 잡을 기회를 만드는 전술입니다.',
    mission: '각행을 목표 칸으로 이동해 왕수와 비차 공격을 동시에 만드세요.',
    pieces: [piece('R', 'opponent', 1, 0), piece('K', 'opponent', 1, 6), piece('B', 'player', 6, 1), piece('K', 'player', 8, 4)],
    hint: { from: [6, 1], to: [4, 3] },
    objective: { kind: 'check', from: [6, 1], to: [4, 3], targetOwner: 'opponent' },
  },
  {
    difficulty: 'advanced', shortTitle: '길 열기 왕수', kicker: '고급 02 · DISCOVERED CHECK', title: '막고 있던 말을 움직여 비차의 길을 엽니다.',
    description: '직접 공격하지 않는 수가 더 강한 공격을 열기도 합니다. 은장을 비켜 세우면 뒤의 비차가 왕을 바라봅니다.',
    ruleIcon: '銀', ruleTitle: '발견 공격', ruleText: '공격선을 막던 내 말을 움직여 뒤쪽 장거리 말의 공격을 드러냅니다.',
    mission: '은장을 왼쪽 앞 목표 칸으로 이동해 비차의 왕수를 완성하세요.',
    pieces: [piece('K', 'opponent', 1, 4), piece('S', 'player', 6, 4), piece('R', 'player', 8, 4), piece('K', 'player', 8, 7)],
    hint: { from: [6, 4], to: [5, 3] },
    objective: { kind: 'check', from: [6, 4], to: [5, 3], targetOwner: 'opponent' },
  },
  {
    difficulty: 'advanced', shortTitle: '한 수 외통', kicker: '고급 03 · CHECKMATE', title: '도망갈 곳이 없는 한 수 외통을 완성하세요.',
    description: '향차 두 장이 좌우 탈출로를 막고 금장이 투입 지점을 지킵니다. 말받침의 비차로 마지막 한 수를 찾으세요.',
    ruleIcon: '詰', ruleTitle: '외통 만들기', ruleText: '왕수 뒤에 왕이 이동·포획·차단 어느 방법으로도 피할 수 없으면 승리합니다.',
    mission: '말받침의 비차를 왕 바로 앞 목표 칸에 놓아 외통을 완성하세요.',
    pieces: [piece('K', 'opponent', 0, 4), piece('L', 'player', 2, 3), piece('G', 'player', 2, 4), piece('L', 'player', 2, 5), piece('K', 'player', 8, 4)],
    playerHand: ['R'],
    hint: { hand: 'R', to: [1, 4] },
    objective: { kind: 'mate', piece: 'R', to: [1, 4], targetOwner: 'opponent' },
  },
];

function createBoard(pieces = []) {
  const board = Array.from({ length: 9 }, () => Array(9).fill(null));
  pieces.forEach((item) => { board[item.row][item.col] = { type: item.type, owner: item.owner }; });
  return board;
}

function inBounds(row, col) { return row >= 0 && row < 9 && col >= 0 && col < 9; }
function sameSquare(a, b) { return Boolean(a && b && a[0] === b[0] && a[1] === b[1]); }

function getLegalMoves(board, from) {
  const [row, col] = from;
  const active = board[row]?.[col];
  if (!active) return [];
  const direction = active.owner === 'player' ? -1 : 1;
  const moves = [];
  const addStep = (dr, dc) => {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (!inBounds(nextRow, nextCol)) return;
    if (!board[nextRow][nextCol] || board[nextRow][nextCol].owner !== active.owner) moves.push([nextRow, nextCol]);
  };
  const addRay = (dr, dc) => {
    for (let distance = 1; distance < 9; distance += 1) {
      const nextRow = row + dr * distance;
      const nextCol = col + dc * distance;
      if (!inBounds(nextRow, nextCol)) break;
      const target = board[nextRow][nextCol];
      if (!target) moves.push([nextRow, nextCol]);
      else {
        if (target.owner !== active.owner) moves.push([nextRow, nextCol]);
        break;
      }
    }
  };

  if (active.type === 'P') addStep(direction, 0);
  if (active.type === 'G' || active.type === '+P') {
    [[direction, -1], [direction, 0], [direction, 1], [0, -1], [0, 1], [-direction, 0]].forEach(([dr, dc]) => addStep(dr, dc));
  }
  if (active.type === 'S') {
    [[direction, -1], [direction, 0], [direction, 1], [-direction, -1], [-direction, 1]].forEach(([dr, dc]) => addStep(dr, dc));
  }
  if (active.type === 'N') [[direction * 2, -1], [direction * 2, 1]].forEach(([dr, dc]) => addStep(dr, dc));
  if (active.type === 'K') {
    for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) if (dr || dc) addStep(dr, dc);
  }
  if (active.type === 'R') [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => addRay(dr, dc));
  if (active.type === 'B') [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => addRay(dr, dc));
  if (active.type === 'L') addRay(direction, 0);
  return moves;
}

function isKingInCheck(board, owner) {
  let king = null;
  for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) {
    const current = board[row][col];
    if (current?.owner === owner && current.type === 'K') king = [row, col];
  }
  if (!king) return false;
  const attacker = owner === 'player' ? 'opponent' : 'player';
  for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) {
    if (board[row][col]?.owner === attacker && getLegalMoves(board, [row, col]).some((move) => sameSquare(move, king))) return true;
  }
  return false;
}

function isKingCheckmated(board, owner) {
  if (!isKingInCheck(board, owner)) return false;
  let king = null;
  for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) {
    if (board[row][col]?.owner === owner && board[row][col].type === 'K') king = [row, col];
  }
  if (!king) return false;
  return getLegalMoves(board, king).every(([nextRow, nextCol]) => {
    const nextBoard = board.map((line) => line.map((token) => token ? { ...token } : null));
    nextBoard[nextRow][nextCol] = nextBoard[king[0]][king[1]];
    nextBoard[king[0]][king[1]] = null;
    return isKingInCheck(nextBoard, owner);
  });
}

function promotePiece(type, row, owner = 'player') {
  const inPromotionZone = owner === 'player' ? row <= 2 : row >= 6;
  return type === 'P' && inPromotionZone ? '+P' : type;
}

const ui = typeof document === 'undefined' ? null : {
  board: document.getElementById('shogi-board'),
  levelGrid: document.getElementById('level-grid'),
  playerHand: document.getElementById('player-hand'), opponentHand: document.getElementById('opponent-hand'),
  progressLabel: document.getElementById('progress-label'), progressCount: document.getElementById('progress-count'), progressBar: document.getElementById('progress-bar'),
  kicker: document.getElementById('lesson-kicker'), title: document.getElementById('lesson-title'), description: document.getElementById('lesson-description'),
  ruleIcon: document.getElementById('rule-icon'), ruleTitle: document.getElementById('rule-title'), ruleText: document.getElementById('rule-text'),
  missionText: document.getElementById('mission-text'), feedback: document.getElementById('feedback'), feedbackIcon: document.getElementById('feedback-icon'), feedbackText: document.getElementById('feedback-text'),
  hintButton: document.getElementById('hint-button'), resetButton: document.getElementById('reset-button'), nextButton: document.getElementById('next-button'), soundButton: document.getElementById('sound-toggle'),
};

const TOTAL_CHALLENGES = LESSONS.length - 1;
const PROGRESS_KEY = 'shogi_tutorial_progress_v2';

function readCompletedLessons() {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]');
    return new Set(saved.filter((index) => Number.isInteger(index) && index > 0 && index < LESSONS.length));
  } catch (_) { return new Set(); }
}

function saveCompletedLessons(completedLessons) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completedLessons])); } catch (_) { /* 저장이 막혀도 플레이는 계속한다. */ }
}

let lessonIndex = 0;
let board = createBoard(LESSONS[0].pieces);
let playerHand = [];
let selectedSquare = null;
let selectedHand = null;
let legalMoves = [];
let completed = false;
let hintVisible = false;
let soundEnabled = true;
let resetTimer = null;
const completedLessons = readCompletedLessons();

function pieceName(value) { return PIECES[value]?.name || '말'; }
function coordLabel(row, col) { return `${9 - col}${['一', '二', '三', '四', '五', '六', '七', '八', '九'][row]}`; }

function setFeedback(message, tone = '') {
  if (!ui) return;
  ui.feedback.className = `feedback ${tone}`.trim();
  ui.feedbackIcon.textContent = tone === 'success' ? '✓' : tone === 'error' ? '!' : '✦';
  ui.feedbackText.textContent = message;
}

function playTone(kind = 'select') {
  if (!soundEnabled || typeof window === 'undefined' || !window.AudioContext) return;
  const context = new window.AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const settings = { select: [320, .045], move: [440, .06], success: [660, .13], error: [180, .1] }[kind] || [320, .05];
  oscillator.frequency.value = settings[0];
  oscillator.type = kind === 'success' ? 'sine' : 'triangle';
  gain.gain.setValueAtTime(.045, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + settings[1]);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + settings[1]);
  oscillator.addEventListener('ended', () => context.close());
}

function renderBoard() {
  if (!ui) return;
  const lesson = LESSONS[lessonIndex];
  ui.board.replaceChildren();
  for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) {
    const square = document.createElement('button');
    const active = board[row][col];
    const legal = legalMoves.some((move) => sameSquare(move, [row, col]));
    square.type = 'button';
    square.className = 'square';
    square.dataset.row = String(row);
    square.dataset.col = String(col);
    square.setAttribute('role', 'gridcell');
    square.setAttribute('aria-label', `${coordLabel(row, col)} ${active ? `${active.owner === 'player' ? '내' : '상대'} ${pieceName(active.type)}` : '빈 칸'}`);
    if (row <= 2) square.classList.add('promotion-zone');
    if (sameSquare(lesson.hint?.to, [row, col])) square.classList.add('target');
    if (hintVisible && (sameSquare(lesson.hint?.from, [row, col]) || sameSquare(lesson.hint?.to, [row, col]))) square.classList.add('hint');
    if (legal) square.classList.add('legal');
    if (legal && active?.owner === 'opponent') square.classList.add('capture');

    if (active) {
      const token = document.createElement('span');
      token.className = `piece ${active.owner}${active.type.startsWith('+') ? ' promoted' : ''}${sameSquare(selectedSquare, [row, col]) ? ' selected' : ''}`;
      token.textContent = PIECES[active.type].kanji;
      const badge = document.createElement('small');
      badge.className = 'piece-badge';
      badge.textContent = active.owner === 'player' ? '나' : '상대';
      square.append(token, badge);
    }
    square.addEventListener('click', () => onSquareClick(row, col));
    ui.board.append(square);
  }
}

function renderHands() {
  if (!ui) return;
  ui.opponentHand.replaceChildren();
  ui.playerHand.replaceChildren();
  if (!playerHand.length) {
    const empty = document.createElement('small');
    empty.textContent = '잡은 말이 여기에 놓입니다.';
    ui.playerHand.append(empty);
  } else {
    playerHand.forEach((type, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `hand-piece${selectedHand === index ? ' selected' : ''}`;
      button.textContent = PIECES[type].kanji;
      button.setAttribute('aria-label', `말받침의 ${pieceName(type)} 선택`);
      button.addEventListener('click', () => {
        if (completed) return;
        selectedHand = selectedHand === index ? null : index;
        selectedSquare = null;
        legalMoves = [];
        setFeedback(selectedHand === null ? '말 선택을 취소했습니다.' : `${pieceName(type)}을 놓을 빈 칸을 선택하세요.`);
        playTone('select');
        render();
      });
      ui.playerHand.append(button);
    });
  }
}

function renderLevelMap() {
  if (!ui?.levelGrid) return;
  ui.levelGrid.replaceChildren();
  DIFFICULTIES.forEach((difficulty) => {
    const group = document.createElement('article');
    group.className = 'difficulty-group';
    group.dataset.difficulty = difficulty.id;
    const label = document.createElement('div');
    label.className = 'difficulty-label';
    const title = document.createElement('strong');
    title.textContent = difficulty.label;
    const code = document.createElement('span');
    code.textContent = difficulty.code;
    label.append(title, code);
    const list = document.createElement('div');
    list.className = 'level-list';
    LESSONS.forEach((lesson, index) => {
      if (lesson.difficulty !== difficulty.id) return;
      const order = LESSONS.slice(1, index + 1).filter((item) => item.difficulty === difficulty.id).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `level-button${lessonIndex === index ? ' active' : ''}${completedLessons.has(index) ? ' completed' : ''}`;
      button.setAttribute('aria-pressed', String(lessonIndex === index));
      button.setAttribute('aria-label', `${difficulty.label} ${order}, ${lesson.shortTitle}${completedLessons.has(index) ? ', 완료' : ''}`);
      const number = document.createElement('span');
      number.className = 'level-number';
      number.textContent = String(order).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'level-name';
      name.textContent = lesson.shortTitle;
      const check = document.createElement('span');
      check.className = 'level-check';
      check.textContent = completedLessons.has(index) ? '✓' : '·';
      button.append(number, name, check);
      button.addEventListener('click', () => {
        loadLesson(index);
        document.getElementById('tutorial')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      list.append(button);
    });
    group.append(label, list);
    ui.levelGrid.append(group);
  });
}

function renderLesson() {
  if (!ui) return;
  const lesson = LESSONS[lessonIndex];
  const difficulty = DIFFICULTIES.find((item) => item.id === lesson.difficulty);
  const order = difficulty ? LESSONS.slice(1, lessonIndex + 1).filter((item) => item.difficulty === lesson.difficulty).length : 0;
  ui.progressLabel.textContent = lessonIndex === 0 ? '준비' : completed ? '문제 완료' : `${difficulty.label} ${order} / 3`;
  ui.progressCount.textContent = `${completedLessons.size} / ${TOTAL_CHALLENGES}`;
  ui.progressBar.style.width = `${(completedLessons.size / TOTAL_CHALLENGES) * 100}%`;
  ui.kicker.textContent = lesson.kicker;
  ui.title.textContent = lesson.title;
  ui.description.textContent = lesson.description;
  ui.ruleIcon.textContent = lesson.ruleIcon;
  ui.ruleTitle.textContent = lesson.ruleTitle;
  ui.ruleText.textContent = lesson.ruleText;
  ui.missionText.textContent = lesson.mission;
  ui.hintButton.disabled = lessonIndex === 0 || completed;
  ui.resetButton.disabled = lessonIndex === 0;
  ui.nextButton.disabled = lessonIndex > 0 && !completed;
  if (lessonIndex === 0) ui.nextButton.innerHTML = '왕초보 시작 <span>→</span>';
  else if (lessonIndex === LESSONS.length - 1 && completed) ui.nextButton.innerHTML = '난이도 목록으로 <span>↑</span>';
  else ui.nextButton.innerHTML = `다음 단계 <span>→</span>`;
}

function render() { renderLevelMap(); renderLesson(); renderBoard(); renderHands(); }

function loadLesson(index) {
  clearTimeout(resetTimer);
  lessonIndex = index;
  const lesson = LESSONS[lessonIndex];
  board = createBoard(lesson.pieces);
  playerHand = [...(lesson.playerHand || [])];
  selectedSquare = null;
  selectedHand = null;
  legalMoves = [];
  completed = false;
  hintVisible = false;
  setFeedback(lessonIndex === 0 ? '선택한 말의 이동 가능한 칸이 표시됩니다.' : '내 말을 선택해 시작하세요.');
  render();
}

function objectiveCompleted(action) {
  const objective = LESSONS[lessonIndex].objective;
  if (!objective) return false;
  if (objective.from && !sameSquare(action.from, objective.from)) return false;
  if (!sameSquare(action.to, objective.to)) return false;
  if (objective.kind === 'capture') return action.captured === objective.captured;
  if (objective.kind === 'promote') return action.promoted === true;
  if (objective.kind === 'drop') return action.kind === 'drop' && action.piece === objective.piece;
  if (objective.kind === 'check') return isKingInCheck(board, objective.targetOwner);
  if (objective.kind === 'escape') return action.kind === 'move' && !isKingInCheck(board, objective.targetOwner);
  if (objective.kind === 'mate') return action.kind === 'drop' && action.piece === objective.piece && isKingCheckmated(board, objective.targetOwner);
  return action.kind === 'move';
}

function finishAction(action) {
  selectedSquare = null;
  selectedHand = null;
  legalMoves = [];
  if (objectiveCompleted(action)) {
    completed = true;
    completedLessons.add(lessonIndex);
    saveCompletedLessons(completedLessons);
    const message = lessonIndex === LESSONS.length - 1
      ? '완벽합니다! 고급 한 수 외통까지 해결했어요. 완료한 다른 문제도 언제든 다시 풀 수 있습니다.'
      : '정확한 한 수입니다. 규칙을 이해했어요!';
    setFeedback(message, 'success');
    playTone('success');
  } else {
    setFeedback('움직임은 가능하지만 이번 단계의 목표와 달라요. 잠시 후 다시 시작합니다.', 'error');
    playTone('error');
    resetTimer = setTimeout(() => loadLesson(lessonIndex), 900);
  }
  render();
}

function movePiece(from, to) {
  const moving = board[from[0]][from[1]];
  const target = board[to[0]][to[1]];
  const originalType = moving.type;
  board[from[0]][from[1]] = null;
  if (target) playerHand.push(target.type.replace('+', ''));
  const promotedType = LESSONS[lessonIndex].objective?.kind === 'promote' ? promotePiece(moving.type, to[0], moving.owner) : moving.type;
  board[to[0]][to[1]] = { ...moving, type: promotedType };
  finishAction({ kind: 'move', from, to, captured: target?.type.replace('+', '') || null, promoted: originalType !== promotedType });
}

function dropPiece(row, col) {
  if (board[row][col]) {
    setFeedback('말은 비어 있는 칸에만 놓을 수 있습니다.', 'error');
    playTone('error');
    return;
  }
  const type = playerHand[selectedHand];
  playerHand.splice(selectedHand, 1);
  board[row][col] = { type, owner: 'player' };
  finishAction({ kind: 'drop', piece: type, to: [row, col] });
}

function onSquareClick(row, col) {
  if (lessonIndex === 0 || completed) return;
  if (selectedHand !== null) {
    dropPiece(row, col);
    render();
    return;
  }
  const clicked = board[row][col];
  if (selectedSquare && legalMoves.some((move) => sameSquare(move, [row, col]))) {
    const from = [...selectedSquare];
    movePiece(from, [row, col]);
    return;
  }
  if (clicked?.owner === 'player') {
    selectedSquare = [row, col];
    legalMoves = getLegalMoves(board, selectedSquare);
    setFeedback(`${pieceName(clicked.type)} 선택 · 이동할 칸을 고르세요.`);
    playTone('select');
  } else {
    selectedSquare = null;
    legalMoves = [];
    setFeedback('먼저 나의 말을 선택하세요. 작은 ‘나’ 표시가 붙어 있습니다.');
  }
  render();
}

function showHint() {
  const hint = LESSONS[lessonIndex].hint;
  if (!hint) return;
  hintVisible = true;
  if (hint.hand) {
    selectedHand = playerHand.findIndex((type) => type === hint.hand);
    setFeedback(`말받침의 ${pieceName(hint.hand)}과 ${coordLabel(...hint.to)} 칸을 확인하세요.`);
  } else {
    setFeedback(`${coordLabel(...hint.from)}의 말을 선택해 ${coordLabel(...hint.to)}로 이동하세요.`);
  }
  render();
}

if (ui) {
  ui.nextButton.addEventListener('click', () => {
    if (lessonIndex === 0) loadLesson(1);
    else if (completed && lessonIndex < LESSONS.length - 1) loadLesson(lessonIndex + 1);
    else if (completed) {
      loadLesson(0);
      document.getElementById('difficulty-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  ui.hintButton.addEventListener('click', showHint);
  ui.resetButton.addEventListener('click', () => loadLesson(lessonIndex));
  ui.soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    ui.soundButton.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    ui.soundButton.setAttribute('aria-pressed', String(soundEnabled));
    ui.soundButton.setAttribute('aria-label', soundEnabled ? '효과음 끄기' : '효과음 켜기');
    if (soundEnabled) playTone('select');
  });
  render();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PIECES, DIFFICULTIES, LESSONS, createBoard, getLegalMoves, isKingInCheck, isKingCheckmated, promotePiece, sameSquare };
}
