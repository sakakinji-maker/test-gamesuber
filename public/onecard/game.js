const socket = io();

let currentView = null;
let selectedIds = []; // 지금 선택 중인 내 손패 카드 id들 (같은 숫자만 함께 선택 가능)
let myNickname = '';

// ---------- 카드 표시 (순수 렌더링 헬퍼, 서버 상태와 무관) ----------

function cardLabel(card) {
  if (card.rank === 'JOKER_BW') return '흑백조커';
  if (card.rank === 'JOKER_COLOR') return '컬러조커';
  return card.rank + card.suit;
}

function cardFaceHTML(card) {
  if (card.rank === 'JOKER_BW') return '<span class="joker-face">🃏</span><span class="joker-tag">흑백</span>';
  if (card.rank === 'JOKER_COLOR') return '<span class="joker-face">🃏</span><span class="joker-tag">컬러</span>';
  return cardLabel(card);
}

function cardColorClass(card) {
  if (card.rank === 'JOKER_BW') return 'joker-bw';
  if (card.rank === 'JOKER_COLOR') return 'joker-color';
  return (card.suit === '♥' || card.suit === '♦') ? 'red' : '';
}

function miniHandHTML(count) {
  const MAX_SHOWN = 10;
  const shown = Math.min(count, MAX_SHOWN);
  let html = '<div class="mini-hand">';
  for (let i = 0; i < shown; i++) html += '<div class="mini-card"></div>';
  if (count > MAX_SHOWN) html += `<span class="mini-more">+${count - MAX_SHOWN}</span>`;
  html += '</div>';
  return html;
}

function showScreen(id) {
  ['nickname-screen', 'lobby-entry-screen', 'lobby-room-screen', 'game-screen'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

// ---------- 닉네임 ----------

const NICKNAME_STORAGE_KEY = 'onecard_nickname';

function enterWithNickname() {
  const input = document.getElementById('nickname-input');
  const nickname = input.value.trim();
  const errorEl = document.getElementById('nickname-error');
  if (!nickname) {
    errorEl.classList.remove('hidden');
    return;
  }
  errorEl.classList.add('hidden');
  localStorage.setItem(NICKNAME_STORAGE_KEY, nickname); // 다음에 올 때 입력칸을 미리 채워주기 위한 용도일 뿐, 로그인은 아님
  myNickname = nickname;
  document.getElementById('welcome-text').textContent = `${nickname}님, 환영합니다!`;
  showScreen('lobby-entry-screen');
}

const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
if (savedNickname) document.getElementById('nickname-input').value = savedNickname;

document.getElementById('enter-btn').addEventListener('click', enterWithNickname);
document.getElementById('nickname-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') enterWithNickname();
});

document.getElementById('change-nickname-btn').addEventListener('click', () => {
  showScreen('nickname-screen');
});

// ---------- 로비 (방 만들기 / 참가하기) ----------

function showLobbyEntryError(message) {
  const el = document.getElementById('lobby-entry-error');
  el.textContent = message;
  el.classList.remove('hidden');
}

document.getElementById('create-room-btn').addEventListener('click', () => {
  socket.emit('createRoom', { nickname: myNickname }, (res) => {
    if (!res.ok) showLobbyEntryError(res.error);
  });
});

function joinRoom() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (!code) { showLobbyEntryError('방 코드를 입력해주세요.'); return; }
  socket.emit('joinRoom', { code, nickname: myNickname }, (res) => {
    if (!res.ok) showLobbyEntryError(res.error);
  });
}

document.getElementById('join-room-btn').addEventListener('click', joinRoom);
document.getElementById('join-code-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinRoom();
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  socket.emit('startGame', {}, (res) => {
    if (!res.ok) alert(res.error);
  });
});

function renderLobby(view) {
  document.getElementById('room-code-display').textContent = view.code;
  document.getElementById('lobby-seats').innerHTML = view.players.map(p => {
    if (!p.name) return `<div class="lobby-seat empty">자리 ${p.seat + 1} - 비어있음 (시작하면 AI가 채웁니다)</div>`;
    return `<div class="lobby-seat ${p.connected ? '' : 'disconnected'}">${p.name}${p.connected ? '' : ' (연결 끊김)'}</div>`;
  }).join('');
  document.getElementById('start-game-btn').classList.toggle('hidden', !view.isHost);
  document.getElementById('lobby-wait-text').classList.toggle('hidden', view.isHost);
}

// ---------- 전적 보기 (REST API, 멀티플레이와 무관하게 동작) ----------

async function loadHistory() {
  const leaderboardEl = document.getElementById('leaderboard-body');
  const recentEl = document.getElementById('recent-games-body');
  try {
    const [leaderboard, games] = await Promise.all([
      fetch('/api/leaderboard').then(r => r.json()),
      fetch('/api/games').then(r => r.json()),
    ]);

    leaderboardEl.innerHTML = leaderboard.length
      ? '<table><tr><th>플레이어</th><th>게임 수</th><th>총점</th><th>1등 횟수</th></tr>' +
        leaderboard.map(r => `<tr><td>${r.player_name}</td><td>${r.games_played}</td><td>${r.total_score}</td><td>${r.wins}</td></tr>`).join('') +
        '</table>'
      : '<p>아직 기록이 없습니다.</p>';

    recentEl.innerHTML = games.length
      ? games.map(g => {
          const rows = g.players.map(p => `${p.final_rank}등 ${p.player_name}(${p.final_score}점)`).join(' · ');
          return `<p>${new Date(g.playedAt).toLocaleString()}<br>${rows}</p>`;
        }).join('')
      : '<p>아직 기록이 없습니다.</p>';
  } catch (e) {
    leaderboardEl.innerHTML = '<p>서버 연결에 문제가 있습니다.</p>';
    recentEl.innerHTML = '';
  }
}

document.getElementById('history-btn').addEventListener('click', () => {
  loadHistory();
  document.getElementById('history-screen').classList.remove('hidden');
});
document.getElementById('close-history-btn').addEventListener('click', () => {
  document.getElementById('history-screen').classList.add('hidden');
});

// ---------- 게임 화면 ----------

// 항상 "내 자리"가 하단(슬롯 0)에 오도록 절대 좌석 번호를 화면 슬롯으로 바꾼다.
function toDisplaySlots(view) {
  const bySlot = new Array(4);
  view.players.forEach(p => { bySlot[(p.seat - view.yourSeat + 4) % 4] = p; });
  return bySlot;
}

function renderGame(view) {
  const bySlot = toDisplaySlots(view);
  const me = view.players.find(p => p.seat === view.yourSeat);
  const myTurn = view.status === 'playing' && !view.pendingSuitChoice && view.currentSeat === view.yourSeat;
  if (!myTurn) selectedIds = [];

  document.getElementById('scoreboard').innerHTML = view.players
    .map(p => `<span>${p.name}: ${view.scores[p.seat]}점</span>`)
    .join('');

  if (view.discardTop) {
    const top = view.discardTop;
    const suitNote = (top.rank === '7' && view.designatedSuit) ? `<br><small>지정 무늬: ${view.designatedSuit}</small>` : '';
    document.getElementById('discard-pile').innerHTML =
      `<div class="card ${cardColorClass(top)}">${cardFaceHTML(top)}${suitNote}</div>`;
  }
  document.getElementById('draw-count').textContent = `덱 ${view.drawPileCount}장 남음`;
  document.getElementById('pending-attack').textContent =
    view.pendingAttack.count > 0 ? `대기 중인 공격: ${view.pendingAttack.count}장` : '';

  [1, 2, 3].forEach(slot => {
    const p = bySlot[slot];
    const seatEl = document.getElementById(`seat-${slot}`);
    seatEl.classList.toggle('active-turn', p.seat === view.currentSeat);
    seatEl.classList.toggle('bankrupt', p.bankrupt);
    const status = p.bankrupt ? '파산'
      : !p.connected ? '연결 끊김 (AI 대행)'
      : `남은 카드: ${p.handCount}장${p.declared && p.handCount === 1 ? ' · 원카드!' : ''}`;
    const mini = p.bankrupt ? '' : miniHandHTML(p.handCount);
    const callable = !p.bankrupt && p.handCount === 1 && !p.declared;
    const callBtn = callable ? `<button class="call-btn" data-target="${p.seat}">콜! (선언 안 함)</button>` : '';
    seatEl.innerHTML = `<div class="seat-name">${p.name} ${p.seat === view.currentSeat ? '▶ 차례' : ''}<br>${status}</div>${mini}${callBtn}`;
  });

  document.querySelectorAll('.call-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      socket.emit('callOut', { targetSeat: Number(btn.dataset.target) }, (res) => {
        if (!res.ok) alert(res.error);
      });
    });
  });

  document.getElementById('seat-0').classList.toggle('active-turn', view.currentSeat === view.yourSeat);
  document.getElementById('my-hand-label').textContent = `내 카드: ${me.handCount}장`;
  document.getElementById('your-turn-banner').classList.toggle('hidden', !myTurn);

  const legalIds = me.legalCardIds || [];
  document.getElementById('hand-0').innerHTML = (me.hand || []).map(card => {
    const selected = selectedIds.includes(card.id);
    const clickable = myTurn && (legalIds.includes(card.id) || selected ||
      (selectedIds.length > 0 && card.rank === (me.hand.find(c => c.id === selectedIds[0]) || {}).rank));
    return `<div class="card ${cardColorClass(card)} ${clickable ? '' : 'disabled'} ${selected ? 'selected' : ''}" data-id="${card.id}">${cardFaceHTML(card)}</div>`;
  }).join('');

  document.querySelectorAll('#hand-0 .card').forEach(el => {
    el.addEventListener('click', () => onHandCardClick(el.dataset.id, myTurn));
  });

  document.getElementById('play-selected-btn').classList.toggle('hidden', selectedIds.length === 0);
  const canDeclare = me.handCount === 1 && !me.declared;
  document.getElementById('declare-btn').classList.toggle('hidden', !canDeclare);

  const currentPlayer = view.players.find(p => p.seat === view.currentSeat);
  document.getElementById('turn-indicator').textContent =
    `현재 차례: ${currentPlayer ? currentPlayer.name : ''} / 라운드 ${view.round} / ${view.direction === 1 ? '시계방향' : '반시계방향'}`;

  document.getElementById('log').innerHTML = view.log.map(m => `<div>${m}</div>`).join('');
  document.getElementById('log').scrollTop = document.getElementById('log').scrollHeight;

  const waitingForMySuit = view.pendingSuitChoice && view.pendingSuitChoice.seat === view.yourSeat;
  document.getElementById('suit-picker').classList.toggle('hidden', !waitingForMySuit);
  const waitingBanner = document.getElementById('waiting-suit-banner');
  if (view.pendingSuitChoice && !waitingForMySuit) {
    waitingBanner.textContent = `${view.pendingSuitChoice.name}님이 무늬를 고르는 중...`;
    waitingBanner.classList.remove('hidden');
  } else {
    waitingBanner.classList.add('hidden');
  }
}

function onHandCardClick(cardId, myTurn) {
  if (!myTurn) return;
  const me = currentView.players.find(p => p.seat === currentView.yourSeat);
  const hand = me.hand || [];
  const legalIds = me.legalCardIds || [];
  const card = hand.find(c => c.id === cardId);
  if (!card) return;

  if (selectedIds.includes(cardId)) {
    selectedIds = selectedIds.filter(id => id !== cardId);
    renderGame(currentView);
    return;
  }
  if (selectedIds.length > 0) {
    const firstCard = hand.find(c => c.id === selectedIds[0]);
    if (firstCard && firstCard.rank === card.rank) {
      selectedIds.push(cardId);
      renderGame(currentView);
      return;
    }
  }
  if (legalIds.includes(cardId)) {
    selectedIds = [cardId];
    renderGame(currentView);
  }
}

document.getElementById('play-selected-btn').addEventListener('click', () => {
  if (selectedIds.length === 0) return;
  const ids = selectedIds;
  selectedIds = [];
  socket.emit('playCards', { cardIds: ids }, (res) => {
    if (!res.ok) alert(res.error);
  });
});

document.getElementById('draw-pile').addEventListener('click', () => {
  socket.emit('drawCard', {}, (res) => {
    if (!res.ok) alert(res.error);
  });
});

document.getElementById('declare-btn').addEventListener('click', () => {
  socket.emit('declareOneCard', {}, (res) => {
    if (!res.ok) alert(res.error);
  });
});

document.querySelectorAll('#suit-picker button').forEach(btn => {
  btn.addEventListener('click', () => {
    socket.emit('chooseSuit', { suit: btn.dataset.suit }, (res) => {
      if (!res.ok) alert(res.error);
    });
  });
});

// ---------- 라운드/최종 결과 ----------

function renderRoundResult(view) {
  const r = view.roundResult;
  const headlines = {
    emptied: `${r.finisherName}이(가) 먼저 손패를 비웠습니다!`,
    lastStanding: `다른 사람들이 파산해서 ${r.finisherName}이(가) 이번 라운드를 마칩니다.`,
    deadlock: `덱과 버림더미의 카드가 모두 바닥나서 더 진행할 수 없어 라운드를 종료합니다. (카드가 가장 적은 ${r.finisherName} 기준)`,
  };
  let html = `<p>${headlines[r.reason]}</p><table><tr><th>순위</th><th>플레이어</th><th>남은 카드</th><th>획득 점수</th></tr>`;
  r.order.forEach(o => {
    const bankruptTag = o.bankrupt ? ' (파산)' : '';
    html += `<tr><td>${o.rank}등</td><td>${o.name}${bankruptTag}</td><td>${o.bankrupt ? '-' : o.size}</td><td>${o.points >= 0 ? '+' : ''}${o.points}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('round-result-title').textContent = `${r.round}라운드 결과`;
  document.getElementById('round-result-body').innerHTML = html;

  const nextBtn = document.getElementById('next-round-btn');
  nextBtn.textContent = r.gameOver ? '최종 결과 보기' : '다음 라운드';
  nextBtn.classList.toggle('hidden', !view.isHost);
  document.getElementById('round-result-wait').classList.toggle('hidden', view.isHost);
}

document.getElementById('next-round-btn').addEventListener('click', () => {
  socket.emit('nextRound', {}, (res) => {
    if (!res.ok) alert(res.error);
  });
});

function renderFinalResult(view) {
  const r = view.finalResult;
  let html = `<p>${r.winnerName}이(가) 5점을 먼저 달성해 승리했습니다!</p><table><tr><th>순위</th><th>플레이어</th><th>총점</th></tr>`;
  r.order.forEach(o => {
    html += `<tr><td>${o.rank}등</td><td>${o.name}</td><td>${o.score}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('final-result-body').innerHTML = html;

  document.getElementById('restart-btn').classList.toggle('hidden', !view.isHost);
  document.getElementById('final-result-wait').classList.toggle('hidden', view.isHost);
}

document.getElementById('restart-btn').addEventListener('click', () => {
  socket.emit('returnToLobby', {}, (res) => {
    if (!res.ok) alert(res.error);
  });
});

// ---------- 서버 상태 수신 ----------

socket.on('state', (view) => {
  currentView = view;

  if (view.status === 'lobby') {
    showScreen('lobby-room-screen');
    renderLobby(view);
    return;
  }

  showScreen('game-screen');
  renderGame(view);
  document.getElementById('round-result').classList.toggle('hidden', view.status !== 'roundResult');
  document.getElementById('final-result').classList.toggle('hidden', view.status !== 'finalResult');
  if (view.status === 'roundResult') renderRoundResult(view);
  if (view.status === 'finalResult') renderFinalResult(view);
});
