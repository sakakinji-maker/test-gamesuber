const GAMES = [
  {
    id: 'unfinished', category: 'story', title: '10년 뒤에 나를 찾아줘', genre: 'MYSTERY · STORY',
    description: '졸업 후 발견한 한 장의 쪽지. 옛 친구와 학교의 기억을 따라가는 15챕터 미스터리 스토리.',
    path: '/unfinished/', symbol: '✎', accent: '#ff786e', label: 'NARRATIVE GAME', status: 'Playable · 15 Chapters',
    tech: ['JAVASCRIPT', 'STORY DESIGN', '2D ART'],
  },
  {
    id: 'onecard', category: 'multiplayer', title: '원카드', genre: 'CARD · MULTIPLAYER',
    description: '친구 또는 AI와 즐기는 2~4인 온라인 카드 게임. 실시간 방 생성과 턴 기반 플레이를 구현했습니다.',
    path: '/onecard/', symbol: '♠', accent: '#c7ff4a', label: 'ONLINE GAME', status: 'Playable · 2–4 Players',
    tech: ['SOCKET.IO', 'NODE.JS', 'GAME RULES'],
  },
  {
    id: 'survival', category: 'action', title: '핵전쟁 서바이벌', genre: 'ACTION · SURVIVAL',
    description: '핵전쟁 이후의 폐허에서 몰려오는 적을 피하고 처치하며 생존 시간을 갱신하는 액션 게임.',
    path: '/survival/', symbol: '☢', accent: '#ffb020', label: 'SURVIVAL GAME', status: 'Playable · Single Player',
    tech: ['CANVAS', 'JAVASCRIPT', 'COMBAT'],
  },
  {
    id: 'ecodex', category: 'rpg', title: '대한민국 생태계교란종 잡기', genre: 'COLLECTION · RPG',
    description: '필드를 탐사하고 생태계교란종을 약화해 포획하며 생물 도감을 완성하는 교육형 턴제 RPG.',
    path: '/ecodex/', symbol: '⌁', accent: '#56d6b1', label: 'ECO ADVENTURE', status: 'Playable · Turn Based',
    tech: ['RPG SYSTEM', 'COLLECTION', 'PIXEL ART'],
  },
  {
    id: 'shogi', category: 'strategy', title: '한 수씩 배우는 쇼기', genre: 'BOARD · STRATEGY',
    description: '12문제와 전법 수업으로 익히는 쇼기. 컴퓨터와 연습하거나 방을 만들어 친구와 실시간 대국하세요.',
    path: '/shogi/', symbol: '王', accent: '#e8b45a', label: 'BOARD GAME', status: 'Tutorial · AI · Multiplayer',
    tech: ['RULE DESIGN', 'TUTORIAL UX', 'JAVASCRIPT'],
  },
];

const gameList = document.getElementById('game-list');
const searchInput = document.getElementById('game-search');
const filterButtons = [...document.querySelectorAll('.filter-button')];
let activeFilter = 'all';

function renderGames() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = GAMES.filter((game) => {
    const matchesFilter = activeFilter === 'all' || game.category === activeFilter;
    const searchable = `${game.title} ${game.genre} ${game.description}`.toLowerCase();
    return matchesFilter && searchable.includes(query);
  });

  if (!filtered.length) {
    gameList.innerHTML = '<div class="no-result">조건에 맞는 프로젝트가 없습니다.<br>다른 검색어나 장르를 선택해 주세요.</div>';
    return;
  }

  gameList.innerHTML = filtered.map((game) => {
    const number = String(GAMES.indexOf(game) + 1).padStart(2, '0');
    return `
      <a class="game-card" href="${game.path}" style="--accent:${game.accent}" aria-label="${game.title} 플레이하기">
        <div class="card-art" data-index="PROJECT ${number}">
          <span class="card-art-symbol" aria-hidden="true">${game.symbol}</span>
          <span class="art-label">${game.label}</span>
        </div>
        <div class="card-content">
          <div class="card-topline">
            <span class="card-genre">${game.genre}</span>
            <span class="card-status">${game.status}</span>
          </div>
          <div class="card-title-row">
            <h3>${game.title}</h3>
            <span class="project-arrow" aria-hidden="true">↗</span>
          </div>
          <p class="card-description">${game.description}</p>
          <ul class="tech-list" aria-label="사용 기술">
            ${game.tech.map((item) => `<li>#${item}</li>`).join('')}
          </ul>
        </div>
      </a>`;
  }).join('');
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    renderGames();
  });
});

searchInput.addEventListener('input', renderGames);
renderGames();
