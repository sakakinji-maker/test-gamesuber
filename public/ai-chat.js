// AI 도우미 채팅 위젯 - 페이지에 <script src="/ai-chat.js" defer></script> 한 줄만 넣으면 됨
(() => {
  const game = location.pathname.split('/')[1] || 'home';
  const history = []; // { role: 'user' | 'assistant', content }

  const style = document.createElement('style');
  style.textContent = `
    #aic-btn { position: fixed; right: 18px; bottom: 18px; z-index: 9999; border: 0; border-radius: 999px;
      padding: 12px 18px; font: 600 14px system-ui, sans-serif; color: #fff; background: #4f46e5;
      box-shadow: 0 6px 18px rgba(0,0,0,.25); cursor: pointer; }
    #aic-panel { position: fixed; right: 18px; bottom: 74px; z-index: 9999; width: min(360px, calc(100vw - 36px));
      height: min(480px, calc(100vh - 110px)); display: flex; flex-direction: column; background: #fff; color: #111;
      border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.3); overflow: hidden; font: 14px/1.5 system-ui, sans-serif; }
    #aic-panel header { padding: 10px 14px; background: #4f46e5; color: #fff; font-weight: 600;
      display: flex; justify-content: space-between; align-items: center; }
    #aic-panel header button { background: none; border: 0; color: #fff; font-size: 18px; cursor: pointer; }
    #aic-log { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #f6f6fb; }
    .aic-msg { max-width: 85%; padding: 8px 11px; border-radius: 12px; white-space: pre-wrap; word-break: break-word; }
    .aic-user { align-self: flex-end; background: #4f46e5; color: #fff; }
    .aic-bot { align-self: flex-start; background: #fff; border: 1px solid #e3e3ee; }
    .aic-err { color: #b91c1c; }
    #aic-form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid #e3e3ee; background: #fff; }
    #aic-input { flex: 1; resize: none; border: 1px solid #ccc; border-radius: 8px; padding: 7px 9px; font: inherit; color: #111; background: #fff; }
    #aic-form button { border: 0; border-radius: 8px; padding: 0 14px; background: #4f46e5; color: #fff; font-weight: 600; cursor: pointer; }
    #aic-form button:disabled { opacity: .5; cursor: default; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'aic-btn';
  btn.textContent = '🤖 AI 도우미';

  const panel = document.createElement('div');
  panel.id = 'aic-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <header><span>AI 도우미</span><button type="button" aria-label="닫기">✕</button></header>
    <div id="aic-log"></div>
    <form id="aic-form">
      <textarea id="aic-input" rows="2" maxlength="1000" placeholder="규칙, 전략, 힌트를 물어보세요"></textarea>
      <button type="submit">보내기</button>
    </form>`;

  document.body.append(btn, panel);

  const log = panel.querySelector('#aic-log');
  const form = panel.querySelector('#aic-form');
  const input = panel.querySelector('#aic-input');
  const sendBtn = form.querySelector('button');

  // 채팅창에서 누른 키가 게임 조작(WASD, 스페이스 등)으로 새지 않게 막음
  for (const type of ['keydown', 'keyup', 'keypress']) {
    panel.addEventListener(type, e => e.stopPropagation());
  }

  function addMsg(text, cls) {
    const div = document.createElement('div');
    div.className = `aic-msg ${cls}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  addMsg('안녕하세요! 이 게임의 규칙이나 전략, 막히는 부분을 물어보세요.', 'aic-bot');

  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });
  panel.querySelector('header button').addEventListener('click', () => { panel.hidden = true; });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = '';
    sendBtn.disabled = true;
    addMsg(text, 'aic-user');
    history.push({ role: 'user', content: text });

    const bubble = addMsg('…', 'aic-bot');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, messages: history }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `서버 오류 (${res.status})`);
      }
      // 답변을 글자가 오는 대로 바로 보여줌
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        bubble.textContent = answer;
        log.scrollTop = log.scrollHeight;
      }
      answer += decoder.decode();
      bubble.textContent = answer || '(빈 답변)';
      history.push({ role: 'assistant', content: answer });
    } catch (err) {
      bubble.textContent = err.message;
      bubble.classList.add('aic-err');
      history.pop(); // 실패한 질문은 기록에서 빼서 다시 물어볼 수 있게
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  });
})();
