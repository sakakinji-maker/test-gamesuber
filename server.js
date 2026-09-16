const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { Server } = require('socket.io');
const { Room } = require('./gameEngine');

const ROOT = __dirname;
const PUBLIC_ROOT = path.join(ROOT, 'public'); // 실제로 브라우저에 내려주는 파일은 이 폴더 안에서만
const DB_PATH = path.join(ROOT, 'game-records.db');
const PORT = 3000;

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    played_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    is_ai INTEGER NOT NULL,
    final_score INTEGER NOT NULL,
    final_rank INTEGER NOT NULL
  );
`);

const insertGame = db.prepare('INSERT INTO games (played_at) VALUES (?)');
const insertPlayer = db.prepare(
  'INSERT INTO game_players (game_id, player_name, is_ai, final_score, final_rank) VALUES (?, ?, ?, ?, ?)'
);

function recordGameResult(players) {
  const gameId = insertGame.run(new Date().toISOString()).lastInsertRowid;
  for (const p of players) insertPlayer.run(gameId, p.name, p.isAI ? 1 : 0, p.score, p.rank);
  return gameId;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  else if (urlPath === '/unfinished' || urlPath === '/unfinished/') urlPath = '/unfinished/index.html';
  else if (urlPath === '/onecard' || urlPath === '/onecard/') urlPath = '/onecard/index.html';
  else if (urlPath === '/survival' || urlPath === '/survival/') urlPath = '/survival/index.html';
  else if (urlPath === '/ecodex' || urlPath === '/ecodex/') urlPath = '/ecodex/index.html';

  const filePath = path.join(PUBLIC_ROOT, decodeURIComponent(urlPath));
  if (!filePath.startsWith(PUBLIC_ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/games' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const gameId = recordGameResult(body.players);
      sendJSON(res, 200, { ok: true, gameId });
    } catch (e) {
      sendJSON(res, 400, { ok: false, error: String(e) });
    }
    return;
  }

  if (req.url === '/api/games' && req.method === 'GET') {
    const games = db.prepare('SELECT id, played_at FROM games ORDER BY id DESC LIMIT 20').all();
    const playersOf = db.prepare(
      'SELECT player_name, is_ai, final_score, final_rank FROM game_players WHERE game_id = ? ORDER BY final_rank ASC'
    );
    sendJSON(res, 200, games.map(g => ({ id: g.id, playedAt: g.played_at, players: playersOf.all(g.id) })));
    return;
  }

  if (req.url === '/api/leaderboard' && req.method === 'GET') {
    const rows = db.prepare(`
      SELECT player_name,
             COUNT(*) AS games_played,
             SUM(final_score) AS total_score,
             SUM(CASE WHEN final_rank = 1 THEN 1 ELSE 0 END) AS wins
      FROM game_players
      GROUP BY player_name
      ORDER BY total_score DESC
    `).all();
    sendJSON(res, 200, rows);
    return;
  }

  serveStatic(req, res);
});

// ---------- 실시간 멀티플레이 (Socket.IO) ----------

const io = new Server(server);
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O/1/I 처럼 헷갈리는 글자는 뺌

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function broadcastRoom(room) {
  for (const p of room.players) {
    if (!p.socketId) continue;
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) sock.emit('state', room.getPersonalizedView(p.socketId));
  }
}

function createRoom() {
  const code = generateRoomCode();
  const room = new Room(code);
  room.onChange = () => broadcastRoom(room);
  room.onGameFinished = (players) => recordGameResult(players);
  rooms.set(code, room);
  return room;
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname } = {}, cb) => {
    const name = String(nickname || '').trim().slice(0, 10);
    if (!name) return cb?.({ ok: false, error: '닉네임을 입력해주세요.' });

    const room = createRoom();
    const result = room.joinHuman(socket.id, name);
    if (!result.ok) return cb?.(result);

    socket.data.roomCode = room.code;
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
  });

  socket.on('joinRoom', ({ code, nickname } = {}, cb) => {
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return cb?.({ ok: false, error: '존재하지 않는 방 코드입니다.' });

    const name = String(nickname || '').trim().slice(0, 10);
    if (!name) return cb?.({ ok: false, error: '닉네임을 입력해주세요.' });

    const result = room.joinHuman(socket.id, name);
    if (!result.ok) return cb?.(result);

    socket.data.roomCode = room.code;
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
  });

  function withRoom(handler) {
    return (payload, cb) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return cb?.({ ok: false, error: '방을 찾을 수 없습니다.' });
      cb?.(handler(room, payload || {}));
    };
  }

  socket.on('startGame', withRoom((room) => room.startGame(socket.id)));
  socket.on('playCards', withRoom((room, { cardIds }) => room.playCards(socket.id, cardIds || [])));
  socket.on('drawCard', withRoom((room) => room.drawCard(socket.id)));
  socket.on('declareOneCard', withRoom((room) => room.declareOneCard(socket.id)));
  socket.on('callOut', withRoom((room, { targetSeat }) => room.callOut(socket.id, targetSeat)));
  socket.on('chooseSuit', withRoom((room, { suit }) => room.chooseSuit(socket.id, suit)));
  socket.on('nextRound', withRoom((room) => room.nextRound(socket.id)));
  socket.on('returnToLobby', withRoom((room) => room.returnToLobby(socket.id)));

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    room.leaveOrConvert(socket.id);
    if (room.status === 'lobby' && room.humanCount() === 0) rooms.delete(room.code);
  });
});

server.listen(PORT, () => {
  console.log(`원카드 서버 실행 중: http://localhost:${PORT}`);
  console.log(`DB 파일 위치: ${DB_PATH}`);
});
