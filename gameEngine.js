// 원카드 규칙 엔진. DOM을 전혀 모르고, 서버(server.js)에서 소켓 이벤트에 맞춰
// 이 Room 클래스의 메서드를 호출한다. 상태가 바뀔 때마다 onChange()를 불러서
// server.js가 방에 있는 각 소켓에게 개인화된 화면 정보를 다시 보내게 한다.

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const WIN_SCORE = 5;
const ATTACK_AMOUNT = { '2': 2, 'A': 3, JOKER_BW: 5, JOKER_COLOR: 7 };
const POINTS_BY_RANK = [2, 1, 0, -1];
const BANKRUPT_HAND_SIZE = 20;
const SEAT_COUNT = 4;

function isJoker(card) { return card.rank === 'JOKER_BW' || card.rank === 'JOKER_COLOR'; }
function isAttackCard(card) { return card.rank === '2' || card.rank === 'A' || isJoker(card); }
function isEffectCard(card) { return isAttackCard(card) || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' || card.rank === '7'; }
function attackKeyOf(card) {
  if (card.rank === 'JOKER_BW') return 'JOKER_BW';
  if (card.rank === 'JOKER_COLOR') return 'JOKER_COLOR';
  return card.rank;
}

function createDeck() {
  const deck = [];
  let n = 0;
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: `c${n++}`, suit, rank });
  deck.push({ id: `c${n++}`, suit: null, rank: 'JOKER_BW' });
  deck.push({ id: `c${n++}`, suit: null, rank: 'JOKER_COLOR' });
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class Room {
  constructor(code) {
    this.code = code;
    this.hostSocketId = null;
    this.status = 'lobby'; // 'lobby' | 'playing' | 'roundResult' | 'finalResult'
    this.generation = 0; // 라운드/방 리셋마다 증가시켜 지나간 setTimeout이 잘못 실행되는 걸 막음

    this.players = Array.from({ length: SEAT_COUNT }, (_, seat) => ({
      seat, socketId: null, name: null, isAI: false, everHuman: false,
      hand: [], declared: false, bankrupt: false,
    }));

    this.drawPile = [];
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.direction = 1;
    this.pendingAttack = { type: null, count: 0 };
    this.round = 1;
    this.roundStartIndex = 0;
    this.scores = [0, 0, 0, 0];
    this.designatedSuit = null;
    this.stagnantTurns = 0;
    this.pendingSuitChoice = null; // { seat, advance } - 7 낸 사람이 무늬 고르는 중
    this.roundResultInfo = null;
    this.finalResultInfo = null;
    this.log = [];

    this.onChange = () => {};
    this.onGameFinished = () => {};
  }

  logMsg(msg) {
    this.log.push(msg);
    if (this.log.length > 100) this.log.shift();
  }

  // ---------- 로비 ----------

  joinHuman(socketId, name) {
    if (this.status !== 'lobby') return { ok: false, error: '이미 시작된 방입니다.' };
    const openSeat = this.players.find(p => p.name === null);
    if (!openSeat) return { ok: false, error: '방이 가득 찼습니다.' };
    openSeat.socketId = socketId;
    openSeat.name = name;
    openSeat.isAI = false;
    openSeat.everHuman = true;
    if (!this.hostSocketId) this.hostSocketId = socketId;
    this.onChange();
    return { ok: true, seat: openSeat.seat };
  }

  seatOf(socketId) {
    return this.players.find(p => p.socketId === socketId) || null;
  }

  isHost(socketId) {
    return this.hostSocketId === socketId;
  }

  humanCount() {
    return this.players.filter(p => p.socketId).length;
  }

  // 로비 단계에서 나가면 자리를 완전히 비우고, 게임 중이면 그 자리를 AI로 넘긴다.
  leaveOrConvert(socketId) {
    const player = this.seatOf(socketId);
    if (!player) return;

    if (this.status === 'lobby') {
      player.socketId = null;
      player.name = null;
      player.isAI = false;
    } else {
      player.socketId = null;
      player.isAI = true;
      this.logMsg(`${player.name}: 연결이 끊겨 컴퓨터가 대신 플레이합니다.`);
      if (this.currentPlayerIndex === player.seat) this._maybeScheduleAI();
    }

    if (this.hostSocketId === socketId) {
      const nextHost = this.players.find(p => p.socketId);
      this.hostSocketId = nextHost ? nextHost.socketId : null;
    }
    this.onChange();
  }

  startGame(socketId) {
    if (!this.isHost(socketId)) return { ok: false, error: '방장만 시작할 수 있습니다.' };
    if (this.status !== 'lobby') return { ok: false, error: '이미 시작되었습니다.' };
    if (this.humanCount() === 0) return { ok: false, error: '최소 1명은 있어야 합니다.' };

    this.players.forEach((p, i) => {
      if (p.name === null) { p.name = `AI-${i + 1}`; p.isAI = true; }
    });

    this.round = 1;
    this.roundStartIndex = 0;
    this.scores = [0, 0, 0, 0];
    this.status = 'playing';
    this._dealNewRound();
    return { ok: true };
  }

  returnToLobby(socketId) {
    if (!this.isHost(socketId)) return { ok: false, error: '방장만 로비로 돌아갈 수 있습니다.' };
    this.generation += 1;
    this.status = 'lobby';
    this.players.forEach(p => {
      p.hand = [];
      p.declared = false;
      p.bankrupt = false;
      if (p.isAI) { p.name = null; p.isAI = false; p.everHuman = false; } // AI가 채웠던 자리는 다시 빈 자리로
    });
    this.roundResultInfo = null;
    this.finalResultInfo = null;
    this.log = [];
    this.onChange();
    return { ok: true };
  }

  // ---------- 카드 규칙 ----------

  topDiscard() { return this.discardPile[this.discardPile.length - 1]; }

  ensureDrawPile(need) {
    while (this.drawPile.length < need) {
      if (this.discardPile.length <= 1) break;
      const top = this.discardPile.pop();
      const rest = this.discardPile;
      this.discardPile = [top];
      this.drawPile.push(...shuffle(rest));
    }
  }

  drawCards(seat, count) {
    this.ensureDrawPile(count);
    const n = Math.min(count, this.drawPile.length);
    for (let i = 0; i < n; i++) this.players[seat].hand.push(this.drawPile.pop());
    return n;
  }

  noteShortage(requested, actual) {
    if (actual < requested) {
      this.logMsg(`  → 덱과 버림더미에 남은 카드가 없어서 ${requested - actual}장은 지급되지 못했습니다.`);
    }
  }

  topAllowsSuit(card, top) {
    if (top.rank === 'JOKER_BW') return card.suit === '♠' || card.suit === '♣';
    if (top.rank === 'JOKER_COLOR') return true;
    if (top.rank === '7' && this.designatedSuit) return card.suit === this.designatedSuit;
    return card.suit === top.suit;
  }

  isPlayable(card, top, pendingAttack) {
    if (pendingAttack.count > 0) {
      if (isJoker(card)) return true;
      if (isAttackCard(card) && (this.topAllowsSuit(card, top) || card.rank === top.rank)) return true;
      return false;
    }
    if (isJoker(card)) return true;
    return this.topAllowsSuit(card, top) || card.rank === top.rank;
  }

  legalCards(seat) {
    const hand = this.players[seat].hand;
    const top = this.topDiscard();
    return hand.filter(card => {
      if (!this.isPlayable(card, top, this.pendingAttack)) return false;
      if (hand.length === 1 && isAttackCard(card)) return false; // 마지막 카드로 공격 카드는 낼 수 없음
      return true;
    });
  }

  nextIndex(from, steps) {
    const n = this.players.length;
    let idx = from;
    let left = steps;
    let guard = 0;
    while (left > 0 && guard < 4 * n) {
      idx = (idx + this.direction + n) % n;
      guard += 1;
      if (!this.players[idx].bankrupt) left -= 1;
    }
    return idx;
  }

  activePlayers() {
    return this.players.filter(p => !p.bankrupt);
  }

  smallestHandIndex() {
    const pool = this.activePlayers().length ? this.activePlayers() : this.players;
    const best = pool.reduce((a, b) => (b.hand.length < a.hand.length ? b : a));
    return this.players.indexOf(best);
  }

  _dealNewRound() {
    const allCards = shuffle(createDeck());
    this.players.forEach(p => { p.hand = []; p.declared = false; p.bankrupt = false; });
    this.drawPile = allCards;
    this.discardPile = [];

    for (let i = 0; i < 5; i++) {
      for (const p of this.players) p.hand.push(this.drawPile.pop());
    }

    let first = this.drawPile.pop();
    const setAside = [];
    while (isEffectCard(first)) {
      setAside.push(first);
      first = this.drawPile.pop();
    }
    this.drawPile.unshift(...setAside);
    this.discardPile = [first];

    this.direction = 1;
    this.pendingAttack = { type: null, count: 0 };
    this.designatedSuit = null;
    this.pendingSuitChoice = null;
    this.currentPlayerIndex = this.roundStartIndex;
    this.stagnantTurns = 0;
    this.status = 'playing';
    this.generation += 1;

    this.logMsg(`--- ${this.round}라운드 시작 ---`);
    this.onChange();
    this._maybeScheduleAI();
  }

  // 파산 처리. 라운드가 끝났으면 true.
  checkBankruptcy(seat) {
    const player = this.players[seat];
    if (player.bankrupt || player.hand.length < BANKRUPT_HAND_SIZE) return false;

    player.bankrupt = true;
    this.logMsg(`${player.name}: 카드가 ${player.hand.length}장이 되어 파산! 이번 라운드에서 탈락합니다.`);

    this.drawPile.push(...player.hand);
    shuffle(this.drawPile);
    player.hand = [];

    const remaining = this.activePlayers();
    if (remaining.length <= 1) {
      const lastIndex = remaining.length === 1 ? this.players.indexOf(remaining[0]) : seat;
      this._endRound(lastIndex, 'lastStanding');
      return true;
    }
    return false;
  }

  // 사람/AI 공통 카드 내기. cardIds는 모두 같은 숫자여야 한다.
  playCards(socketId, cardIds) {
    const player = this.seatOf(socketId);
    if (!player) return { ok: false, error: '참가자가 아닙니다.' };
    if (this.status !== 'playing') return { ok: false, error: '지금은 게임 중이 아닙니다.' };
    if (this.pendingSuitChoice) return { ok: false, error: '무늬 선택을 기다리는 중입니다.' };
    if (this.currentPlayerIndex !== player.seat) return { ok: false, error: '당신의 차례가 아닙니다.' };

    const found = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
    if (found.length !== cardIds.length || found.length === 0) return { ok: false, error: '유효하지 않은 카드입니다.' };
    const rank = found[0].rank;
    if (!found.every(c => c.rank === rank)) return { ok: false, error: '같은 숫자끼리만 함께 낼 수 있습니다.' };

    const legal = this.legalCards(player.seat);
    if (!legal.some(c => c.id === found[0].id)) return { ok: false, error: '지금 낼 수 없는 카드입니다.' };

    this._applyPlay(player.seat, found);
    return { ok: true };
  }

  _applyPlay(seat, cards) {
    const player = this.players[seat];
    const rank = cards[0].rank;
    const n = cards.length;
    const handSizeBefore = player.hand.length;

    this.stagnantTurns = 0;

    cards.forEach(card => {
      const idx = player.hand.indexOf(card);
      player.hand.splice(idx, 1);
      this.discardPile.push(card);
    });
    this.designatedSuit = null;

    const label = rank === 'JOKER_BW' ? '흑백조커' : rank === 'JOKER_COLOR' ? '컬러조커' : rank + (cards[0].suit || '');
    this.logMsg(n === 1 ? `${player.name}: ${label} 냄` : `${player.name}: ${label} 등 같은 숫자 ${n}장 냄`);

    let advance = 1;

    if (isAttackCard(cards[0])) {
      const add = ATTACK_AMOUNT[attackKeyOf(cards[0])] * n;
      this.pendingAttack = { type: attackKeyOf(cards[0]), count: this.pendingAttack.count + add };
      this.logMsg(`→ 다음 사람이 ${this.pendingAttack.count}장을 받아야 합니다 (방어 가능)`);
    } else {
      if (rank === 'J') { advance = 1 + n; this.logMsg(`→ ${player.name}이(가) 다음 사람 ${n}명 턴을 스킵`); }
      else if (rank === 'Q') { if (n % 2 === 1) this.direction *= -1; this.logMsg('→ 진행 방향이 바뀝니다'); }
      else if (rank === 'K') { advance = 0; this.logMsg(`→ ${player.name} 한 번 더!`); }
      this.pendingAttack = { type: null, count: 0 };
    }

    if (handSizeBefore === n) {
      this._endRound(seat, 'emptied');
      return;
    }

    if (player.hand.length === 1) {
      player.declared = false;
      if (player.isAI) this._scheduleAIDeclare(player);
    }

    if (rank === '7') {
      this._beginSuitChoice(player, seat, advance);
      return;
    }

    this._finishTurn(seat, advance);
  }

  _beginSuitChoice(player, seat, advance) {
    if (player.isAI) {
      const counts = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };
      player.hand.forEach(c => { if (c.suit) counts[c.suit]++; });
      const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      this.designatedSuit = best;
      this.logMsg(`→ ${player.name}이(가) 무늬를 [${best}]로 지정`);
      this._finishTurn(seat, advance);
      return;
    }
    this.pendingSuitChoice = { seat, advance };
    this.onChange();
  }

  chooseSuit(socketId, suit) {
    const player = this.seatOf(socketId);
    if (!player || !this.pendingSuitChoice || this.pendingSuitChoice.seat !== player.seat) {
      return { ok: false, error: '지금은 무늬를 지정할 수 없습니다.' };
    }
    const { seat, advance } = this.pendingSuitChoice;
    this.designatedSuit = suit;
    this.logMsg(`→ ${player.name}: 무늬를 [${suit}]로 지정`);
    this.pendingSuitChoice = null;
    this._finishTurn(seat, advance);
    return { ok: true };
  }

  _finishTurn(seat, advance) {
    this.currentPlayerIndex = advance !== 0 ? this.nextIndex(seat, advance) : seat;
    this.onChange();
    this._maybeScheduleAI();
  }

  drawCard(socketId) {
    const player = this.seatOf(socketId);
    if (!player) return { ok: false, error: '참가자가 아닙니다.' };
    if (this.status !== 'playing' || this.pendingSuitChoice) return { ok: false, error: '지금은 뽑을 수 없습니다.' };
    if (this.currentPlayerIndex !== player.seat) return { ok: false, error: '당신의 차례가 아닙니다.' };
    this._drawForSeat(player.seat);
    return { ok: true };
  }

  _drawForSeat(seat) {
    const player = this.players[seat];
    let n;
    if (this.pendingAttack.count > 0) {
      const requested = this.pendingAttack.count;
      n = this.drawCards(seat, requested);
      this.logMsg(`${player.name}: 방어하지 못해 ${n}장 받음`);
      this.noteShortage(requested, n);
      this.pendingAttack = { type: null, count: 0 };
    } else {
      n = this.drawCards(seat, 1);
      this.logMsg(`${player.name}: 카드 ${n}장 뽑음`);
    }

    this.stagnantTurns = n === 0 ? this.stagnantTurns + 1 : 0;
    if (player.hand.length !== 1) player.declared = false;

    if (this.checkBankruptcy(seat)) return;

    if (this.stagnantTurns >= this.activePlayers().length) {
      this._endRound(this.smallestHandIndex(), 'deadlock');
      return;
    }

    this._finishTurn(seat, 1);
  }

  declareOneCard(socketId) {
    const player = this.seatOf(socketId);
    if (!player) return { ok: false, error: '참가자가 아닙니다.' };
    if (player.hand.length !== 1) return { ok: false, error: '지금은 선언할 수 없습니다.' };
    player.declared = true;
    this.logMsg(`${player.name}: 원카드!`);
    this.onChange();
    return { ok: true };
  }

  callOut(socketId, targetSeat) {
    const caller = this.seatOf(socketId);
    const target = this.players[targetSeat];
    if (!caller) return { ok: false, error: '참가자가 아닙니다.' };
    if (!target || target.bankrupt || target.hand.length !== 1 || target.declared) {
      return { ok: false, error: '지금은 콜 할 수 없습니다.' };
    }
    const n = this.drawCards(targetSeat, 2);
    target.declared = true;
    this.logMsg(`${caller.name}: "원카드 선언 안 했잖아!" ${target.name}에게 콜! ${n}장 받음`);
    this.noteShortage(2, n);
    if (this.checkBankruptcy(targetSeat)) return { ok: true };
    this.onChange();
    return { ok: true };
  }

  _scheduleAIDeclare(player) {
    const gen = this.generation;
    setTimeout(() => {
      if (this.generation !== gen || this.status !== 'playing') return;
      if (player.hand.length === 1 && !player.declared) {
        player.declared = true;
        this.logMsg(`${player.name}: 원카드!`);
        this.onChange();
      }
    }, 1500);
  }

  // 게임에 참여한 AI 좌석이 다른 사람이 원카드 선언을 깜빡한 걸 잡아낼 기회를 준다.
  // 라운드가 끝났으면 true.
  _checkWatchfulness(aiSeat) {
    for (const p of this.players) {
      if (p.seat === aiSeat) continue;
      if (p.hand.length === 1 && !p.declared && Math.random() < 0.5) {
        const n = this.drawCards(p.seat, 2);
        p.declared = false;
        this.logMsg(`${this.players[aiSeat].name}이(가) "원카드 선언 안 했잖아요!" 하며 콜! ${p.name}에게 ${n}장 받음`);
        this.noteShortage(2, n);
        if (this.checkBankruptcy(p.seat)) return true;
      }
    }
    return false;
  }

  _maybeScheduleAI() {
    if (this.status !== 'playing' || this.pendingSuitChoice) return;
    const player = this.players[this.currentPlayerIndex];
    if (!player.isAI) return;
    const gen = this.generation;
    setTimeout(() => {
      if (this.generation !== gen || this.status !== 'playing') return;
      this._aiTakeTurn();
    }, 1600);
  }

  _aiTakeTurn() {
    if (this._checkWatchfulness(this.currentPlayerIndex)) return;

    const seat = this.currentPlayerIndex;
    const player = this.players[seat];
    const legal = this.legalCards(seat);

    if (legal.length === 0) { this._drawForSeat(seat); return; }

    let choice;
    if (this.pendingAttack.count > 0) {
      choice = legal[0];
    } else {
      choice = legal[Math.floor(Math.random() * legal.length)];
    }
    const sameRankCards = player.hand.filter(c => c.rank === choice.rank);
    this._applyPlay(seat, sameRankCards);
  }

  _endRound(finisherSeat, reason) {
    const order = this.players
      .map((p, idx) => ({ idx, size: p.hand.length, bankrupt: p.bankrupt }))
      .sort((a, b) => {
        if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
        return a.size - b.size;
      });

    order.forEach((o, rank) => {
      const points = POINTS_BY_RANK[rank] ?? 0;
      this.scores[o.idx] += points;
    });

    this.status = 'roundResult';
    this.roundResultInfo = {
      round: this.round,
      reason,
      finisherName: this.players[finisherSeat].name,
      order: order.map((o, rank) => ({
        rank: rank + 1,
        seat: o.idx,
        name: this.players[o.idx].name,
        bankrupt: o.bankrupt,
        size: o.bankrupt ? null : o.size,
        points: POINTS_BY_RANK[rank] ?? 0,
      })),
      gameOver: this.scores.some(s => s >= WIN_SCORE),
    };
    this.onChange();
  }

  nextRound(socketId) {
    if (!this.isHost(socketId)) return { ok: false, error: '방장만 다음 라운드를 진행할 수 있습니다.' };
    if (this.status !== 'roundResult') return { ok: false, error: '지금은 다음 라운드로 넘어갈 수 없습니다.' };

    if (this.roundResultInfo.gameOver) {
      this._showFinalResult();
    } else {
      this.round += 1;
      this.roundStartIndex = (this.roundStartIndex + 1) % this.players.length;
      this._dealNewRound();
    }
    return { ok: true };
  }

  _showFinalResult() {
    const order = this.players
      .map((p, idx) => ({ idx, score: this.scores[idx] }))
      .sort((a, b) => b.score - a.score);

    this.status = 'finalResult';
    this.finalResultInfo = {
      winnerName: this.players[order[0].idx].name,
      order: order.map((o, rank) => ({ rank: rank + 1, seat: o.idx, name: this.players[o.idx].name, score: this.scores[o.idx] })),
    };

    const resultsForDB = order.map((o, rank) => ({
      name: this.players[o.idx].name,
      isAI: this.players[o.idx].isAI,
      score: this.scores[o.idx],
      rank: rank + 1,
    }));
    this.onGameFinished(resultsForDB);
    this.onChange();
  }

  // ---------- 화면에 보낼 뷰 ----------

  getLobbyView(socketId) {
    return {
      status: 'lobby',
      code: this.code,
      isHost: this.isHost(socketId),
      players: this.players.map(p => ({ seat: p.seat, name: p.name, connected: !!p.socketId })),
    };
  }

  getPersonalizedView(socketId) {
    if (this.status === 'lobby') return this.getLobbyView(socketId);

    const viewer = this.seatOf(socketId);
    const yourSeat = viewer ? viewer.seat : null;
    const top = this.topDiscard();

    return {
      status: this.status,
      code: this.code,
      isHost: this.isHost(socketId),
      yourSeat,
      round: this.round,
      scores: this.scores,
      direction: this.direction,
      currentSeat: this.currentPlayerIndex,
      pendingAttack: this.pendingAttack,
      designatedSuit: this.designatedSuit,
      drawPileCount: this.drawPile.length,
      discardTop: top ? { rank: top.rank, suit: top.suit } : null,
      pendingSuitChoice: this.pendingSuitChoice
        ? { seat: this.pendingSuitChoice.seat, name: this.players[this.pendingSuitChoice.seat].name }
        : null,
      players: this.players.map(p => ({
        seat: p.seat,
        name: p.name,
        isAI: p.isAI,
        connected: !!p.socketId || (p.isAI && !p.everHuman),
        bankrupt: p.bankrupt,
        declared: p.declared,
        handCount: p.hand.length,
        hand: p.seat === yourSeat ? p.hand : undefined,
        legalCardIds: p.seat === yourSeat ? this.legalCards(p.seat).map(c => c.id) : undefined,
      })),
      log: this.log.slice(-40),
      roundResult: this.roundResultInfo,
      finalResult: this.finalResultInfo,
    };
  }
}

module.exports = { Room };
