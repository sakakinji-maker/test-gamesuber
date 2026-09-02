const GAMES = [
  {
    id: 'onecard',
    title: '원카드',
    genre: '카드 게임',
    description: '2~4인 온라인 멀티플레이 카드 게임. 사람이 부족하면 AI가 채워줘요.',
    path: '/onecard/',
  },
  {
    id: 'survival',
    title: '핵전쟁 서바이벌',
    genre: '액션 서바이벌',
    description: '핵전쟁 이후 디스토피아에서 몰려오는 몬스터 속에 최대한 오래 살아남는 게임.',
    path: '/survival/',
  },
];

function renderGames(list) {
  const el = document.getElementById('game-list');
  if (list.length === 0) {
    el.innerHTML = '<div class="no-result">검색 결과가 없습니다.</div>';
    return;
  }
  el.innerHTML = list.map(g => `
    <div class="game-card" data-path="${g.path}">
      <h2>${g.title}</h2>
      <p>${g.description}</p>
      <span class="genre">${g.genre}</span>
    </div>
  `).join('');

  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => { location.href = card.dataset.path; });
  });
}

document.getElementById('game-search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = GAMES.filter(g =>
    g.title.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q)
  );
  renderGames(filtered);
});

renderGames(GAMES);

// ---------- 오늘의 날짜(달력) / 날씨(그림) ----------

function renderCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  const today = date.getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=일요일
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `<div class="cal-header">${year}년 ${month + 1}월</div><div class="cal-grid">`;
  ['일', '월', '화', '수', '목', '금', '토'].forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    html += `<div class="cal-cell ${d === today ? 'today' : ''}">${d}</div>`;
  }
  html += '</div>';
  document.getElementById('calendar-card').innerHTML = html;
}

const WEATHER_INFO = {
  0: { icon: '☀️', text: '맑음' }, 1: { icon: '🌤️', text: '대체로 맑음' },
  2: { icon: '⛅', text: '구름 조금' }, 3: { icon: '☁️', text: '흐림' },
  45: { icon: '🌫️', text: '안개' }, 48: { icon: '🌫️', text: '서리 안개' },
  51: { icon: '🌦️', text: '약한 이슬비' }, 53: { icon: '🌦️', text: '이슬비' }, 55: { icon: '🌧️', text: '강한 이슬비' },
  61: { icon: '🌧️', text: '약한 비' }, 63: { icon: '🌧️', text: '비' }, 65: { icon: '🌧️', text: '강한 비' },
  71: { icon: '🌨️', text: '약한 눈' }, 73: { icon: '🌨️', text: '눈' }, 75: { icon: '❄️', text: '많은 눈' }, 77: { icon: '❄️', text: '진눈깨비' },
  80: { icon: '🌦️', text: '약한 소나기' }, 81: { icon: '🌧️', text: '소나기' }, 82: { icon: '⛈️', text: '강한 소나기' },
  95: { icon: '⛈️', text: '뇌우' }, 96: { icon: '⛈️', text: '우박 동반 뇌우' }, 99: { icon: '⛈️', text: '강한 우박 동반 뇌우' },
};

function describeWeather(code) {
  return WEATHER_INFO[code] || { icon: '❓', text: '알 수 없음' };
}

function showWeather(lat, lon, label) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
  fetch(url)
    .then(r => r.json())
    .then(data => {
      const c = data.current;
      const info = describeWeather(c.weather_code);
      document.getElementById('weather-icon').textContent = info.icon;
      document.getElementById('weather-text').innerHTML =
        `${label}<br>${info.text} · ${Math.round(c.temperature_2m)}°C`;
    })
    .catch(() => {
      document.getElementById('weather-icon').textContent = '❓';
      document.getElementById('weather-text').textContent = '날씨 정보를 가져올 수 없습니다.';
    });
}

function loadDateAndWeather() {
  const now = new Date();
  renderCalendar(now);

  const SEOUL = { lat: 37.5665, lon: 126.9780 };
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => showWeather(pos.coords.latitude, pos.coords.longitude, '현재 위치'),
      () => showWeather(SEOUL.lat, SEOUL.lon, '서울'),
      { timeout: 5000 }
    );
  } else {
    showWeather(SEOUL.lat, SEOUL.lon, '서울');
  }
}

loadDateAndWeather();
