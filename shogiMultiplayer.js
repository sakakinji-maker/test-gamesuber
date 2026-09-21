'use strict';
const { randomBytes, randomInt } = require('node:crypto');
const E = require('./public/shogi/engine');

function attachShogi(io, { now = Date.now, graceMs = 90000, lobbyTtlMs = 1800000, sweepMs = 1000 } = {}) {
  const nsp = io.of('/shogi');
  const rooms = new Map();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const fail = (error, code = 'INVALID') => ({ ok: false, error, code });
  const nameOf = value => typeof value === 'string' ? value.trim().slice(0, 12) : '';
  const codeOf = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
  function code() {
    let value;
    do { value = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(value));
    return value;
  }
  function summary() {
    return [...rooms.values()].filter(r => r.status === 'waiting' && r.players.length === 1 && r.players[0].socketId)
      .slice(0, 100).map(r => ({ code: r.code, name: r.players[0].name, createdAt: r.createdAt }));
  }
  function view(room, player) {
    const s = room.state;
    return { code: room.code, status: room.status, revision: room.revision, you: player.owner,
      isHost: room.players[0] === player, rematchReady: room.ready.includes(player.token),
      rematchCount: room.ready.length,
      players: room.players.map(p => ({ name: p.name, owner: p.owner, connected: Boolean(p.socketId),
        reconnectUntil: p.socketId ? null : p.disconnectedAt + graceMs })),
      state: s ? { board: s.board, hands: s.hands, turn: s.turn, ply: s.ply,
        result: s.result, lastMove: s.lastMove, positions: [] } : null,
      records: room.records.slice(-100) };
  }
  function broadcast(room) {
    for (const p of room.players) if (p.socketId) nsp.sockets.get(p.socketId)?.emit('view', view(room, p));
  }
  function changed(room) { room.revision++; room.touchedAt = now(); broadcast(room); nsp.emit('rooms', summary()); }
  function end(room, winner, reason) {
    room.status = 'finished'; room.ready = [];
    room.state = { ...room.state, result: { winner, reason } };
  }
  function remove(room, player, reason) {
    if (room.status === 'playing') end(room, E.other(player.owner), reason);
    room.ready = room.ready.filter(t => t !== player.token);
    room.players = room.players.filter(p => p !== player);
    if (!room.players.length) rooms.delete(room.code);
    else {
      if (room.status === 'waiting') room.players[0].owner = 'player';
      changed(room);
    }
    nsp.emit('rooms', summary());
  }
  function closeRoom(room) {
    for (const p of room.players) if (p.socketId) {
      const socket = nsp.sockets.get(p.socketId);
      if (socket) { socket.data.shogiCode = null; socket.emit('roomClosed', '대기 시간이 30분을 넘어 방이 닫혔어요. 새 방을 만들어 주세요.'); }
    }
    rooms.delete(room.code); nsp.emit('rooms', summary());
  }
  function sweep() {
    for (const room of rooms.values()) {
      for (const p of [...room.players]) {
        if (!p.socketId && now() >= p.disconnectedAt + graceMs) remove(room, p, 'disconnect');
      }
      if (rooms.has(room.code) && room.status === 'waiting' && now() - room.touchedAt >= lobbyTtlMs) closeRoom(room);
    }
  }
  const timer = setInterval(sweep, sweepMs); timer.unref();
  function seated(socket) {
    const room = rooms.get(socket.data.shogiCode);
    const player = room?.players.find(p => p.socketId === socket.id);
    return player ? { room, player } : null;
  }
  function bind(socket, room, player) {
    player.socketId = socket.id; player.disconnectedAt = null;
    socket.data.shogiCode = room.code;
    socket.emit('session', { code: room.code, token: player.token, name: player.name });
    changed(room);
    return { ok: true };
  }
  function validateMove(m) {
    const square = p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isInteger(n) && n >= 0 && n < 9);
    if (!m || typeof m !== 'object' || !square(m.to)) return null;
    if (m.drop) return E.TYPES.includes(m.drop) && !m.from && !m.promote ? { drop: m.drop, to: m.to } : null;
    return square(m.from) && typeof m.promote === 'boolean' ? { from: m.from, to: m.to, promote: m.promote } : null;
  }
  const coord = ([r,c]) => `${9-c}${'一二三四五六七八九'[r]}`;
  nsp.on('connection', socket => {
    let calls = 0, windowStart = now();
    socket.emit('rooms', summary());
    function handle(event, fn) {
      socket.on(event, (payload, ack) => {
        const respond = value => { if (typeof ack === 'function') ack(value); };
        if (now() - windowStart >= 10000) { calls = 0; windowStart = now(); }
        if (++calls > 50) return respond(fail('요청이 너무 빨라요. 잠시 뒤 다시 시도하세요.'));
        sweep();
        const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        try { respond(fn(data)); }
        catch (_) { respond(fail('요청을 처리하지 못했어요. 방 상태를 새로 확인해 주세요.')); }
      });
    }
    function inRoom(fn, expectedRevision = false) {
      return data => {
        const seat = seated(socket);
        if (!seat) return fail('방을 찾을 수 없어요. 다시 입장해 주세요.', 'ROOM_GONE');
        if (expectedRevision && data.revision !== seat.room.revision) {
          socket.emit('view', view(seat.room, seat.player));
          return fail('판이 갱신됐어요. 현재 상태를 확인하고 다시 선택하세요.', 'STALE');
        }
        return fn(seat.room, seat.player, data);
      };
    }
    handle('list', () => { socket.emit('rooms', summary()); return { ok: true }; });
    handle('create', data => {
      if (seated(socket)) return fail('현재 방에서 먼저 나가 주세요.');
      const name = nameOf(data.name);
      if (!name) return fail('닉네임을 입력해 주세요.');
      if (rooms.size >= 200) return fail('지금은 방이 많아요. 대기 중인 방에 입장해 주세요.');
      const room = { code: code(), createdAt: now(), touchedAt: now(), revision: 0,
        status: 'waiting', state: null, records: [], ready: [], players: [] };
      const player = { name, owner: 'player', token: randomBytes(32).toString('hex') };
      room.players.push(player); rooms.set(room.code, room);
      return bind(socket, room, player);
    });
    handle('join', data => {
      if (seated(socket)) return fail('현재 방에서 먼저 나가 주세요.');
      const room = rooms.get(codeOf(data.code)), name = nameOf(data.name);
      if (!room) return fail('존재하지 않거나 닫힌 방이에요.', 'ROOM_GONE');
      if (!name) return fail('닉네임을 입력해 주세요.');
      if (room.status !== 'waiting' || room.players.length >= 2) return fail('입장할 자리가 없거나 이미 시작한 방이에요.');
      const player = { name, owner: 'opponent', token: randomBytes(32).toString('hex') };
      room.players.push(player);
      return bind(socket, room, player);
    });
    handle('resume', data => {
      if (seated(socket)) return fail('이미 방에 연결되어 있어요.');
      const room = rooms.get(codeOf(data.code));
      const player = typeof data.token === 'string' && room?.players.find(p => p.token === data.token);
      if (!player) return fail('복귀할 방이 없거나 복귀 시간이 지났어요. 새 방에 입장해 주세요.', 'ROOM_GONE');
      const previous = nsp.sockets.get(player.socketId);
      // Clear the old membership first so its disconnect cannot pause the new session.
      if (previous) { previous.data.shogiCode = null; previous.emit('replaced'); previous.disconnect(true); }
      return bind(socket, room, player);
    });
    handle('sync', () => {
      const seat = seated(socket);
      if (seat) { socket.emit('session', { code: seat.room.code, token: seat.player.token, name: seat.player.name }); socket.emit('view', view(seat.room, seat.player)); }
      return { ok: true, inRoom: Boolean(seat) };
    });
    handle('start', inRoom((room, player) => {
      if (room.status !== 'waiting') return fail('이미 시작한 대국이에요.');
      if (room.players[0] !== player) return fail('방장만 대국을 시작할 수 있어요.');
      if (room.players.length !== 2 || room.players.some(p => !p.socketId)) return fail('두 사람이 모두 연결되어야 시작할 수 있어요.');
      room.state = E.initialState(); room.status = 'playing'; room.records = []; room.ready = [];
      changed(room); return { ok: true };
    }, true));
    handle('move', inRoom((room, player, data) => {
      if (room.status !== 'playing') return fail('진행 중인 대국이 아니에요.');
      if (room.players.some(p => !p.socketId)) return fail('상대의 재접속을 기다리고 있어요.');
      if (room.state.turn !== player.owner) return fail('상대 차례예요.');
      const move = validateMove(data.move);
      if (!move) return fail('올바른 이동 정보가 아니에요.');
      const before = room.state;
      let next;
      try { next = E.play(before, move); } catch (_) { return fail('둘 수 없는 수예요. 왕수와 이동 규칙을 확인해 주세요.'); }
      const type = move.drop || before.board[move.from[0]][move.from[1]].type;
      room.records.push({ ply: next.ply, owner: player.owner,
        text: `${E.PIECES[type][1]} ${move.drop ? '투입' : coord(move.from)} → ${coord(move.to)}${move.promote ? ' 승격' : ''}` });
      room.state = next;
      if (next.result) room.status = 'finished';
      else if (next.ply >= 600) end(room, null, 'move-limit');
      changed(room); return { ok: true };
    }, true));
    handle('resign', inRoom((room, player) => {
      if (room.status !== 'playing') return fail('진행 중인 대국이 아니에요.');
      end(room, E.other(player.owner), 'resign'); changed(room); return { ok: true };
    }, true));
    handle('rematch', inRoom((room, player) => {
      if (room.status !== 'finished' || room.players.length !== 2 || room.players.some(p => !p.socketId)) return fail('두 사람이 모두 연결된 종료 대국에서 다시 시작할 수 있어요.');
      if (!room.ready.includes(player.token)) room.ready.push(player.token);
      if (room.ready.length === 2) {
        room.state = E.initialState(); room.records = []; room.ready = []; room.status = 'playing';
      }
      changed(room); return { ok: true };
    }, true));
    handle('leave', inRoom((room, player) => {
      socket.data.shogiCode = null; remove(room, player, 'leave');
      socket.emit('left'); return { ok: true };
    }));
    socket.on('disconnect', () => {
      const seat = seated(socket);
      if (!seat) return;
      seat.player.socketId = null; seat.player.disconnectedAt = now();
      changed(seat.room);
    });
  });
  return { rooms, sweep, close: () => clearInterval(timer) };
}
module.exports = { attachShogi };
