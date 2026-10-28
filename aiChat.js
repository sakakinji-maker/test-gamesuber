// ---------- AI 도우미 (Claude API) ----------
// API 키는 서버 환경변수 ANTHROPIC_API_KEY 에만 둔다. 브라우저로는 절대 내려보내지 않음.

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 20;       // 대화 기록은 최근 20개만 보냄
const MAX_CHARS = 1000;        // 메시지 하나당 글자 수 제한
const RATE_LIMIT = 20;         // IP 하나당
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10분에 20번까지

const GAMES = {
  home: '게임 포트폴리오 홈페이지 (여러 게임으로 들어가는 메인 화면)',
  onecard: '원카드 (트럼프 카드 게임, AI 또는 친구와 온라인 멀티플레이)',
  survival: '핵전쟁 서바이벌 (드론/폭탄 무기로 살아남는 액션 게임, 랭킹 있음)',
  ecodex: '대한민국 생태계교란종 잡기 (생태계교란종을 배우며 잡는 게임)',
  shogi: '한 수씩 배우는 쇼기 (일본 장기 강의, AI 연습, 온라인 2인 대국)',
  baduk: '한 수씩 배우는 바둑 (바둑 강의, AI 연습, 온라인 대국)',
  unfinished: '10년 뒤에 나를 찾아줘 (스토리 게임)',
};

const SYSTEM_PROMPT = [
  '너는 웹 게임 사이트의 "AI 도우미"야. 방문자가 게임 규칙, 조작법, 전략, 힌트를 물어보면 도와줘.',
  '항상 한국어로, 짧고 친절하게 답해 (보통 3~6문장). 필요하면 짧은 목록을 써도 좋아.',
  '너는 현재 게임 화면이나 판의 상태를 볼 수 없어. 판 상황에 대한 질문은 사용자가 설명해 준 내용을 바탕으로 답하고, 모르는 건 지어내지 마.',
  '게임과 상관없는 질문에도 가볍게 답할 수 있지만, 대화는 게임을 즐기는 쪽으로 이끌어 줘.',
].join('\n');

let client = null;
function getClient() {
  if (!client) client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수를 자동으로 읽음
  return client;
}

// 아주 단순한 IP별 요청 제한 (배포했을 때 API 요금 폭탄 방지)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

// 브라우저가 보낸 대화 기록을 검사해서 API 형식으로 정리
function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const messages = raw
    .slice(-MAX_MESSAGES)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .filter(m => m.content);
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  return messages;
}

async function handleAiChat(req, res, readBody, sendJSON) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (rateLimited(ip)) {
    return sendJSON(res, 429, { ok: false, error: '질문이 너무 많아요. 몇 분 뒤에 다시 시도해 주세요.' });
  }

  let body;
  try { body = JSON.parse(await readBody(req)); } catch { body = null; }
  const messages = cleanMessages(body?.messages);
  if (!messages) return sendJSON(res, 400, { ok: false, error: '질문 내용이 비어 있어요.' });

  const game = Object.hasOwn(GAMES, body.game) ? body.game : 'home';
  const system = `${SYSTEM_PROMPT}\n\n지금 사용자가 보고 있는 페이지: ${GAMES[game]}`;

  // 첫 글자가 도착하기 전에 실패하면 JSON 오류로, 그 뒤에 실패하면 본문 끝에 안내를 붙임
  let started = false;
  const begin = () => {
    if (started) return;
    started = true;
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  };

  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' }, // 채팅용: 빠르고 저렴하게
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // 안전 필터에 걸리면 서버가 알아서 다른 모델로 이어서 답함
      system,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        begin();
        res.write(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      begin();
      res.write('\n\n(이 질문에는 답하기 어려워요. 다른 질문을 해 주세요.)');
    } else if (final.stop_reason === 'max_tokens') {
      begin();
      res.write('\n\n(답변이 길어서 중간에 끊겼어요.)');
    }
    begin();
    res.end();
  } catch (e) {
    console.error('[AI 도우미] 오류:', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e.message);
    const msg = e instanceof Anthropic.AuthenticationError
      ? 'AI API 키가 올바르지 않아요. 서버 관리자에게 알려 주세요.'
      : e instanceof Anthropic.RateLimitError
        ? 'AI가 지금 바빠요. 잠시 뒤에 다시 시도해 주세요.'
        : e instanceof Anthropic.APIError
          ? 'AI 응답 중 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.'
          : 'AI 도우미가 아직 연결되지 않았어요. (서버에 ANTHROPIC_API_KEY 설정 필요)';
    if (!started) return sendJSON(res, 503, { ok: false, error: msg });
    res.end(`\n\n(${msg})`);
  }
}

module.exports = { handleAiChat };
