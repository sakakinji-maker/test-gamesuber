const CANVAS_W = 900;
const CANVAS_H = 600;
const WIN_TIME_SEC = 600;
const ELITE_START_SEC = 300;
const SCORES_KEY = 'survival_scores';

// 지구처럼 한 방향으로 계속 가면 반대쪽에서 다시 나오는 "둥근" 월드.
// 실제로는 좌표를 WORLD_SIZE 크기로 감아버리는 2D 도넛(torus) 형태로 구현한다.
const WORLD_SIZE = 5000;
const WORLD_HALF = WORLD_SIZE / 2;

// v를 [-WORLD_HALF, WORLD_HALF) 범위로 감는다 (좌표 자체를 정규화할 때 사용)
function wrapCoord(v) {
  return (((v + WORLD_HALF) % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE - WORLD_HALF;
}
// 두 좌표의 차이(a-b)를 월드가 감겨있다는 걸 고려해 "최단 거리"로 바꿔준다.
// 예: 월드 끝과 끝은 숫자상 멀어 보여도 실제로는 바로 옆이므로, 이 함수로 보정해야
// 몬스터 추적/조준/충돌 판정이 이음매 근처에서도 정상 동작한다.
function wrapDelta(d) {
  return wrapCoord(d);
}

const WEAPON_DEFS = {
  pistol:  { name: '권총',    icon: '🔫', baseDamage: 12, baseFireRate: 0.55, projectileSpeed: 420, count: 1, spread: 0 },
  smg:     { name: '기관단총', icon: '⚡', baseDamage: 6,  baseFireRate: 0.16, projectileSpeed: 500, count: 1, spread: 0 },
  shotgun: { name: '샷건',    icon: '💥', baseDamage: 9,  baseFireRate: 0.85, projectileSpeed: 380, count: 3, spread: 0.5 },
  drone:   { name: '드론',    icon: '🛸', baseDamage: 22, orbitRadius: 22, angularSpeed: 2.2 },
  bomb:    { name: '폭탄',    icon: '💣', baseDamage: 30, baseFireRate: 1.5, radius: 55, fuse: 0.6 },
};

const UPGRADE_DEFS = [
  { id: 'maxhp',    name: '최대 체력 증가', icon: '❤️', desc: '최대 체력 +20 및 즉시 회복', apply: (p) => { p.maxHp += 20; p.hp += 20; } },
  { id: 'speed',    name: '이동속도 증가', icon: '👟', desc: '이동속도 +15%', apply: (p) => { p.speed *= 1.15; } },
  { id: 'magnet',   name: '자석 범위 증가', icon: '🧲', desc: '경험치 획득 범위 증가', apply: (p) => { p.magnetRadius *= 1.3; } },
  { id: 'damage',   name: '전체 공격력 증가', icon: '💪', desc: '모든 무기 데미지 +20%', apply: (p) => { p.globalDamageMult *= 1.2; } },
  { id: 'firerate', name: '전체 공격속도 증가', icon: '⏱️', desc: '모든 무기 공격속도 +15%', apply: (p) => { p.globalRateMult *= 1.15; } },
  { id: 'smg', name: '기관단총', icon: '⚡', desc: '획득 또는 강화', weaponType: 'smg' },
  { id: 'shotgun', name: '샷건', icon: '💥', desc: '획득 또는 강화', weaponType: 'shotgun' },
  { id: 'drone', name: '드론', icon: '🛸', desc: '내 주위를 도는 드론 획득/강화 (레벨당 1대 추가)', weaponType: 'drone' },
  { id: 'bomb', name: '폭탄', icon: '💣', desc: '1.5초마다 발밑에 폭탄을 떨어뜨려 범위 피해', weaponType: 'bomb' },
];

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

let player, weapons, enemies, projectiles, xpOrbs, camera, bombs;
let elapsed, killCount, spawnTimer, pendingLevelUps, droneAngle;
let gameState = 'title'; // 'title' | 'playing' | 'levelup' | 'gameover' | 'win'
let lastTime = 0;

// 캐릭터는 월드 좌표(무한히 이동 가능)를 가지고, 화면에는 항상 카메라(=캐릭터 위치)
// 기준으로 상대 위치를 변환해서 그린다. 그래서 캐릭터가 항상 화면 중앙에 보인다.
function toScreenX(worldX) { return wrapDelta(worldX - camera.x) + CANVAS_W / 2; }
function toScreenY(worldY) { return wrapDelta(worldY - camera.y) + CANVAS_H / 2; }

function resetGame() {
  player = {
    x: 0, y: 0, radius: 14, speed: 180,
    hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 10,
    magnetRadius: 70, globalDamageMult: 1, globalRateMult: 1,
  };
  camera = { x: 0, y: 0 };
  weapons = [{ type: 'pistol', level: 1, cooldown: 0 }];
  enemies = [];
  projectiles = [];
  xpOrbs = [];
  bombs = [];
  elapsed = 0;
  killCount = 0;
  spawnTimer = 0.5;
  pendingLevelUps = 0;
  droneAngle = 0;
}

// 적을 처치했을 때 공통 처리 (투사체/드론/폭탄 모두 여기로 모음)
function killEnemy(index) {
  const e = enemies[index];
  xpOrbs.push({ x: e.x, y: e.y, value: e.elite ? 8 : 3, radius: 6 });
  enemies.splice(index, 1);
  killCount += 1;
}

function loadScores() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCORES_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveScores(scores) { localStorage.setItem(SCORES_KEY, JSON.stringify(scores)); }

// 이번 판 기록을 지금까지의 전적에 추가하고 점수순으로 랭킹을 매긴다.
// 반환값의 top은 상위 10위 목록, rank는 이번 기록이 전체에서 몇 위인지.
function recordScore(entry) {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  saveScores(scores);
  return { rank: scores.indexOf(entry) + 1, total: scores.length, top: scores.slice(0, 10), entry };
}

function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ---------- 입력/이동 ----------

function getMoveVector() {
  let dx = 0, dy = 0;
  if (keys['arrowup'] || keys['w']) dy -= 1;
  if (keys['arrowdown'] || keys['s']) dy += 1;
  if (keys['arrowleft'] || keys['a']) dx -= 1;
  if (keys['arrowright'] || keys['d']) dx += 1;
  if (dx !== 0 && dy !== 0) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
  return { dx, dy };
}

// ---------- 스폰 ----------

function currentSpawnInterval() {
  return Math.max(0.22, 1.1 - elapsed * 0.0025);
}

function spawnEnemy() {
  // 카메라가 항상 캐릭터를 따라다니므로, 스폰 위치도 캐릭터의 현재 월드 좌표를
  // 기준으로 화면 바로 바깥쪽 원 위에 잡는다.
  const spawnDist = Math.max(CANVAS_W, CANVAS_H) / 2 + 60;
  const angle = Math.random() * Math.PI * 2;
  const x = wrapCoord(player.x + Math.cos(angle) * spawnDist);
  const y = wrapCoord(player.y + Math.sin(angle) * spawnDist);

  const elite = elapsed > ELITE_START_SEC && Math.random() < 0.18;
  const scale = 1 + elapsed / 120;
  const hp = (elite ? 90 : 18) * scale;
  enemies.push({
    x, y,
    radius: elite ? 22 : 12,
    speed: (elite ? 55 : 70) + Math.random() * 20,
    hp, maxHp: hp,
    damage: (elite ? 18 : 8) * (1 + elapsed / 300),
    elite,
  });
}

// ---------- 무기 ----------

function findNearestEnemy(x, y) {
  let best = null, bestDist = Infinity;
  for (const e of enemies) {
    const ddx = wrapDelta(e.x - x), ddy = wrapDelta(e.y - y);
    const d = ddx * ddx + ddy * ddy;
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function tryFireWeapon(weapon, dt) {
  weapon.cooldown -= dt;
  if (weapon.cooldown > 0) return;

  const target = findNearestEnemy(player.x, player.y);
  if (!target) return;

  const def = WEAPON_DEFS[weapon.type];
  const effDamage = def.baseDamage * (1 + 0.3 * (weapon.level - 1)) * player.globalDamageMult;
  const effFireRate = Math.max(0.08, (def.baseFireRate * (1 - 0.08 * (weapon.level - 1))) / player.globalRateMult);
  const count = def.count + (weapon.type === 'shotgun' ? Math.floor((weapon.level - 1) / 2) : 0);
  const baseAngle = Math.atan2(wrapDelta(target.y - player.y), wrapDelta(target.x - player.x));

  for (let i = 0; i < count; i++) {
    const angle = count > 1 ? baseAngle - def.spread / 2 + (def.spread / (count - 1)) * i : baseAngle;
    projectiles.push({
      x: player.x, y: player.y,
      vx: Math.cos(angle) * def.projectileSpeed,
      vy: Math.sin(angle) * def.projectileSpeed,
      damage: effDamage, radius: 4,
    });
  }
  weapon.cooldown = effFireRate;
}

// 캐릭터 주위를 도는 드론. 무기 목록에 있으면 레벨만큼 대수가 늘어나고, 계속 회전하면서
// 닿아있는 동안 초당 데미지를 준다 (플레이어가 적과 부딪혔을 때 데미지 입는 방식과 동일하게
// dt에 비례해서 매 프레임 적용 — 스쳐 지나가는 순간에도 판정을 놓치지 않도록).
let dronePositions = [];
function updateDrones(dt) {
  dronePositions = [];
  const weapon = weapons.find((w) => w.type === 'drone');
  if (!weapon) return;

  const def = WEAPON_DEFS.drone;
  const count = weapon.level;
  droneAngle += def.angularSpeed * dt;
  const dps = def.baseDamage * (1 + 0.3 * (weapon.level - 1)) * player.globalDamageMult;

  for (let i = 0; i < count; i++) {
    const angle = droneAngle + (Math.PI * 2 / count) * i;
    const dx = player.x + Math.cos(angle) * def.orbitRadius;
    const dy = player.y + Math.sin(angle) * def.orbitRadius;
    dronePositions.push({ x: dx, y: dy });

    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (Math.hypot(wrapDelta(dx - e.x), wrapDelta(dy - e.y)) < 16 + e.radius) {
        e.hp -= dps * dt;
        if (e.hp <= 0) killEnemy(ei);
      }
    }
  }
}

// 다른 무기처럼 이동 여부와 상관없이 1.5초마다 발밑에 폭탄을 떨어뜨린다.
// 잠깐의 도화선(fuse) 후 터져서 범위 안의 적에게 피해를 준다.
function updateBombs(dt) {
  const weapon = weapons.find((w) => w.type === 'bomb');
  if (weapon) {
    weapon.cooldown -= dt;
    if (weapon.cooldown <= 0) {
      const def = WEAPON_DEFS.bomb;
      const damage = def.baseDamage * (1 + 0.3 * (weapon.level - 1)) * player.globalDamageMult;
      bombs.push({ x: player.x, y: player.y, timer: def.fuse, radius: def.radius, damage, phase: 'fuse', boomTimer: 0 });
      weapon.cooldown = Math.max(0.4, (def.baseFireRate * (1 - 0.08 * (weapon.level - 1))) / player.globalRateMult);
    }
  }

  for (let bi = bombs.length - 1; bi >= 0; bi--) {
    const b = bombs[bi];
    if (b.phase === 'fuse') {
      b.timer -= dt;
      if (b.timer <= 0) {
        b.phase = 'boom';
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          const e = enemies[ei];
          if (Math.hypot(wrapDelta(b.x - e.x), wrapDelta(b.y - e.y)) < b.radius + e.radius) {
            e.hp -= b.damage;
            if (e.hp <= 0) killEnemy(ei);
          }
        }
      }
    } else {
      b.boomTimer += dt;
      if (b.boomTimer > 0.3) bombs.splice(bi, 1);
    }
  }
}

// ---------- 업그레이드 ----------

function applyUpgrade(def) {
  if (def.weaponType) {
    const owned = weapons.find((w) => w.type === def.weaponType);
    if (owned) owned.level += 1;
    else weapons.push({ type: def.weaponType, level: 1, cooldown: 0 });
  } else {
    def.apply(player);
  }
}

function showLevelUpCards() {
  const shuffled = [...UPGRADE_DEFS].sort(() => Math.random() - 0.5).slice(0, 3);
  const container = document.getElementById('upgrade-cards');
  container.innerHTML = shuffled.map((def, i) => {
    let name = def.name;
    if (def.weaponType) {
      const owned = weapons.find((w) => w.type === def.weaponType);
      name = owned ? `${WEAPON_DEFS[def.weaponType].name} 강화 (Lv.${owned.level}→${owned.level + 1})` : `${WEAPON_DEFS[def.weaponType].name} 획득`;
    }
    return `<div class="upgrade-card" data-idx="${i}"><div class="icon">${def.icon}</div><div class="name">${name}</div><div class="desc">${def.desc}</div></div>`;
  }).join('');

  document.querySelectorAll('.upgrade-card').forEach((el) => {
    el.addEventListener('click', () => {
      applyUpgrade(shuffled[Number(el.dataset.idx)]);
      pendingLevelUps -= 1;
      if (pendingLevelUps > 0) showLevelUpCards();
      else resumeFromLevelUp();
    });
  });

  document.getElementById('levelup-screen').classList.remove('hidden');
}

function resumeFromLevelUp() {
  document.getElementById('levelup-screen').classList.add('hidden');
  gameState = 'playing';
  lastTime = performance.now();
}

// ---------- 업데이트 ----------

function update(dt) {
  elapsed += dt;

  const { dx, dy } = getMoveVector();
  player.x = wrapCoord(player.x + dx * player.speed * dt);
  player.y = wrapCoord(player.y + dy * player.speed * dt);

  // 카메라가 캐릭터를 부드럽게 따라가게 함 (완전히 딱 붙지 않고 살짝 지연되게).
  // 이음매(월드 끝) 근처에서도 최단 방향으로 자연스럽게 따라가도록 wrapDelta로 보정한다.
  camera.x = wrapCoord(camera.x + wrapDelta(player.x - camera.x) * Math.min(1, dt * 8));
  camera.y = wrapCoord(camera.y + wrapDelta(player.y - camera.y) * Math.min(1, dt * 8));

  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawnEnemy(); spawnTimer = currentSpawnInterval(); }

  for (const e of enemies) {
    const ex = wrapDelta(player.x - e.x), ey = wrapDelta(player.y - e.y);
    const dist = Math.hypot(ex, ey) || 1;
    e.x = wrapCoord(e.x + (ex / dist) * e.speed * dt);
    e.y = wrapCoord(e.y + (ey / dist) * e.speed * dt);

    if (dist < player.radius + e.radius) player.hp -= e.damage * dt;
  }

  for (const w of weapons) {
    if (w.type === 'drone' || w.type === 'bomb') continue;
    tryFireWeapon(w, dt);
  }
  updateDrones(dt);
  updateBombs(dt);

  for (let pi = projectiles.length - 1; pi >= 0; pi--) {
    const p = projectiles[pi];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (Math.hypot(wrapDelta(p.x - player.x), wrapDelta(p.y - player.y)) > Math.max(CANVAS_W, CANVAS_H)) { projectiles.splice(pi, 1); continue; }

    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (Math.hypot(wrapDelta(p.x - e.x), wrapDelta(p.y - e.y)) < p.radius + e.radius) {
        e.hp -= p.damage;
        projectiles.splice(pi, 1);
        if (e.hp <= 0) killEnemy(ei);
        break;
      }
    }
  }

  for (let oi = xpOrbs.length - 1; oi >= 0; oi--) {
    const o = xpOrbs[oi];
    const dx2 = wrapDelta(player.x - o.x), dy2 = wrapDelta(player.y - o.y);
    const dist = Math.hypot(dx2, dy2);
    if (dist < player.magnetRadius) {
      const d2 = dist || 1;
      o.x = wrapCoord(o.x + (dx2 / d2) * 260 * dt);
      o.y = wrapCoord(o.y + (dy2 / d2) * 260 * dt);
    }
    if (dist < player.radius + o.radius) {
      player.xp += o.value;
      xpOrbs.splice(oi, 1);
    }
  }

  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.floor(player.xpToNext * 1.25 + 5);
    pendingLevelUps += 1;
  }
  if (pendingLevelUps > 0) {
    gameState = 'levelup';
    showLevelUpCards();
    return;
  }

  if (player.hp <= 0) { endGame(false); return; }
  if (elapsed >= WIN_TIME_SEC) { endGame(true); return; }
}

// ---------- 렌더링 ----------

function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const size = 45;
  const offsetX = ((camera.x % size) + size) % size;
  const offsetY = ((camera.y % size) + size) % size;
  for (let x = -offsetX; x < CANVAS_W; x += size) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = -offsetY; y < CANVAS_H; y += size) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }
}

function emoji(char, x, y, size) {
  ctx.font = `${size}px sans-serif`;
  ctx.fillText(char, x, y);
}

function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawGrid();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const o of xpOrbs) emoji('💎', toScreenX(o.x), toScreenY(o.y), o.radius * 2.4);

  for (const e of enemies) {
    const sx = toScreenX(e.x), sy = toScreenY(e.y);
    emoji(e.elite ? '👹' : '🧟', sx, sy, e.radius * 2.4);
    if (e.hp < e.maxHp) {
      ctx.fillStyle = '#111';
      ctx.fillRect(sx - e.radius, sy - e.radius - 10, e.radius * 2, 4);
      ctx.fillStyle = '#e53935';
      ctx.fillRect(sx - e.radius, sy - e.radius - 10, e.radius * 2 * (e.hp / e.maxHp), 4);
    }
  }

  ctx.fillStyle = '#ffd54f';
  for (const p of projectiles) circle(toScreenX(p.x), toScreenY(p.y), p.radius);

  for (const b of bombs) {
    const sx = toScreenX(b.x), sy = toScreenY(b.y);
    if (b.phase === 'fuse') {
      emoji('💣', sx, sy, 22);
    } else {
      const t = b.boomTimer / 0.3;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.fillStyle = '#ff9800';
      circle(sx, sy, b.radius * t);
      ctx.globalAlpha = 1;
    }
  }

  for (const d of dronePositions) emoji('🛸', toScreenX(d.x), toScreenY(d.y), 22);

  emoji('🧍', toScreenX(player.x), toScreenY(player.y), player.radius * 2.6);

  updateHUD();
}

function updateHUD() {
  document.getElementById('hp-bar-inner').style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  document.getElementById('xp-bar-inner').style.width = `${(player.xp / player.xpToNext) * 100}%`;
  document.getElementById('hud-time').textContent = formatTime(elapsed);
  document.getElementById('hud-level').textContent = `Lv.${player.level}`;
  document.getElementById('hud-kills').textContent = `처치 ${killCount}`;
}

// ---------- 화면 전환 ----------

function showBestOnTitle() {
  const scores = loadScores();
  document.getElementById('best-record').textContent = scores.length
    ? `역대 1위: 점수 ${scores[0].score} (생존 ${formatTime(scores[0].time)} · 처치 ${scores[0].kills}마리) · 총 ${scores.length}판 플레이`
    : '아직 기록이 없습니다.';
}

function endGame(won) {
  gameState = won ? 'win' : 'gameover';
  const scoreNow = Math.floor(elapsed) + killCount;
  const record = { score: scoreNow, time: Math.floor(elapsed), kills: killCount, date: Date.now() };
  const { rank, total, top, entry } = recordScore(record);

  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('end-title').textContent = won ? '생존 성공!' : '게임 오버';
  document.getElementById('end-stats').textContent = `생존 시간 ${formatTime(elapsed)} · 처치 ${killCount}마리 · 점수 ${scoreNow}`;
  document.getElementById('end-best').textContent = rank === 1
    ? '🎉 역대 1위 달성!'
    : `이번 기록: 전체 ${total}판 중 ${rank}위`;

  const rows = top.map((s, i) => {
    const mine = s === entry;
    return `<tr class="${mine ? 'my-rank' : ''}"><td>${i + 1}위</td><td>${s.score}</td><td>${formatTime(s.time)}</td><td>${s.kills}마리</td></tr>`;
  }).join('');
  document.getElementById('end-rank-table').innerHTML =
    `<table><tr><th>순위</th><th>점수</th><th>생존시간</th><th>처치</th></tr>${rows}</table>`;

  document.getElementById('end-screen').classList.remove('hidden');
}

document.getElementById('start-btn').addEventListener('click', () => {
  resetGame();
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  gameState = 'playing';
  lastTime = performance.now();
});

document.getElementById('retry-btn').addEventListener('click', () => {
  document.getElementById('end-screen').classList.add('hidden');
  resetGame();
  document.getElementById('game-screen').classList.remove('hidden');
  gameState = 'playing';
  lastTime = performance.now();
  showBestOnTitle();
});

// ---------- 메인 루프 ----------

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  if (gameState === 'playing') {
    update(dt);
    if (gameState === 'playing') render();
  }
  requestAnimationFrame(loop);
}

showBestOnTitle();
requestAnimationFrame(loop);
