(() => {
  'use strict';
  const E = window.Shogi, D = window.ShogiStrategies;
  const $ = id => document.getElementById(id);
  const KEY = 'shogi_strategies_v1';
  const coord = ([r,c]) => `${9-c}${'一二三四五六七八九'[r]}`;
  let completed = new Set(), storageWarning = false;
  try { const saved = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(saved)) completed = new Set(saved.filter(id => D.lessons.some(l => l.id === id))); }
  catch (_) { storageWarning = true; }
  let current, snapshots, index = 0, selected = null, hint = false, preview = false;
  function announce(text) { $('strategy-feedback').textContent = text; }
  function state() { return snapshots[preview ? snapshots.length - 1 : index]; }
  function moveText(before, m) { return `${E.PIECES[before.board[m.from[0]][m.from[1]].type][1]} ${coord(m.from)} → ${coord(m.to)}`; }
  function renderCards() {
    const query = $('strategy-search').value.trim().toLowerCase();
    const category = $('strategy-category').value;
    $('strategy-cards').replaceChildren();
    for (const l of D.lessons.filter(l => (category === 'all' || l.category === category) && `${l.title} ${l.japanese} ${l.summary}`.toLowerCase().includes(query))) {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'strategy-card';
      card.setAttribute('aria-pressed', String(l.id === current.id));
      const meta = document.createElement('small'); meta.textContent = `${l.category} · ${l.level} · 직접 두는 ${l.steps.length}수${completed.has(l.id) ? ' · 완료 ✓' : ''}`;
      const title = document.createElement('strong'); title.textContent = l.title;
      const japanese = document.createElement('small'); japanese.textContent = l.japanese;
      const summary = document.createElement('p'); summary.textContent = l.summary;
      card.append(meta,title,japanese,summary);
      card.addEventListener('click', () => { load(l.id); $('strategy-title').focus({preventScroll:true}); $('strategy-lesson').scrollIntoView({behavior:'auto',block:'start'}); });
      $('strategy-cards').append(card);
    }
    $('search-empty').hidden = $('strategy-cards').children.length > 0;
    $('completion-count').textContent = `${completed.size} / ${D.lessons.length} 수업 완료${storageWarning ? ' · 기록 저장 불가' : ''}`;
  }
  function renderBoard() {
    const s = state(), target = current.steps[index]?.move;
    const possible = !preview && selected ? E.legalMoves(s).filter(m => E.equal(m.from,selected)) : [];
    const active = document.activeElement;
    const focus = active?.parentElement === $('strategy-board') ? [active.dataset.row, active.dataset.col] : null;
    $('strategy-board').replaceChildren();
    for (let r=0;r<9;r++) for(let c=0;c<9;c++) {
      const pos=[r,c], p=s.board[r][c], b=document.createElement('button');
      b.type='button'; b.className='square'; b.dataset.row=r; b.dataset.col=c;
      b.disabled=preview || index === current.steps.length;
      const legal=possible.some(m=>E.equal(m.to,pos));
      if(legal)b.classList.add('legal');
      if(E.equal(selected,pos))b.classList.add('hint');
      if(!preview && hint && target && (E.equal(target.from,pos)||E.equal(target.to,pos)))b.classList.add('target');
      const last = current.steps[(preview ? current.steps.length : index)-1]?.move;
      if(last && (E.equal(last.from,pos)||E.equal(last.to,pos)))b.classList.add('last-move');
      b.setAttribute('aria-label',`${coord(pos)} ${p ? `${p.owner==='player'?'내':'상대'} ${E.PIECES[p.type][1]}` : '빈 칸'}${legal?' · 이동 가능':''}${hint && E.equal(target?.to,pos)?' · 목표 칸':''}`);
      b.setAttribute('aria-pressed',String(E.equal(selected,pos)));
      if(p){const token=document.createElement('span');token.className=`piece ${p.owner}${E.equal(selected,pos)?' selected':''}`;token.textContent=E.PIECES[p.type][0];token.setAttribute('aria-hidden','true');b.append(token);}
      b.addEventListener('click',()=>onSquare(pos));
      b.addEventListener('keydown',e=>{const d={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];if(d){e.preventDefault();$('strategy-board').querySelector(`[data-row="${r+d[0]}"][data-col="${c+d[1]}"]`)?.focus();}});
      $('strategy-board').append(b);
    }
    if(focus)$('strategy-board').querySelector(`[data-row="${focus[0]}"][data-col="${focus[1]}"]`)?.focus({preventScroll:true});
    for(const owner of ['player','opponent'])$('strategy-'+owner+'-hand').textContent = s.hands[owner].map(t=>E.PIECES[t][1]).join(' · ') || '잡은 말이 없습니다';
  }
  function render() {
    const done=index===current.steps.length;
    $('strategy-meta').textContent=`${current.category} · ${current.level}`;
    $('strategy-title').textContent=current.title;
    $('strategy-japanese').textContent=current.japanese;
    for(const key of ['explanation','strength','caution'])$('strategy-'+key).textContent=current[key];
    $('strategy-source').href=current.source;
    $('step-count').textContent=preview?'완성 모습 미리보기':done?'수업 완료!':`${index+1} / ${current.steps.length} 단계 · ${moveText(state(),current.steps[index].move)}`;
    $('strategy-turn').textContent=preview?'완성 진형 · 살펴보기':done?'진형 완성 · 자유 대국으로':'내 차례 · 선공';
    $('step-reason').textContent=preview?current.next:done?current.next:current.steps[index].why;
    $('strategy-progress').max=current.steps.length; $('strategy-progress').value=index;
    $('strategy-back').disabled=index===0 || preview;
    $('strategy-hint').disabled=done || preview;
    $('strategy-preview').textContent=preview?'실습으로 돌아가기':'완성 모습 보기';
    $('strategy-preview').setAttribute('aria-pressed',String(preview));
    $('strategy-finish').hidden=!done || preview;
    $('strategy-next-tip').textContent=current.next;
    $('strategy-play').href=`/shogi/practice.html?strategy=${encodeURIComponent(current.id)}`;
    $('strategy-next').textContent=D.lessons.indexOf(current)===D.lessons.length-1?'첫 수업으로 →':'다음 수업 →';
    $('strategy-record').replaceChildren();
    const limit=preview?current.steps.length:index;
    for(let i=0;i<limit;i++){
      const step=current.steps[i], mid=E.play(snapshots[i],step.move);
      for(const [before,m,who] of [[snapshots[i],step.move,'나'],[mid,step.reply,'상대']]){
        const li=document.createElement('li');li.textContent=`${who} · ${moveText(before,m)}`;$('strategy-record').append(li);
      }
    }
    renderBoard(); renderCards();
  }
  function load(id) {
    current=D.lessons.find(l=>l.id===id)||D.lessons[0];index=0;selected=null;hint=false;preview=false;
    snapshots=[E.initialState()];
    for(const s of current.steps)snapshots.push(E.play(E.play(snapshots.at(-1),s.move),s.reply));
    window.history.replaceState(null,'',`#${current.id}`);
    render();announce('한 수의 이유를 읽고, 내 말을 선택해 보세요. 완성 모습은 언제든 미리 볼 수 있어요.');
  }
  function onSquare(pos){
    if(preview || index===current.steps.length)return;
    const s=state(), step=current.steps[index];
    if(selected){
      const candidate=E.legalMoves(s).find(m=>E.equal(m.from,selected)&&E.equal(m.to,pos)&&!m.promote);
      if(candidate){
        if(!E.sameMove(candidate,step.move)){announce('규칙상 가능한 수지만 이번 단계의 목표와 달라요. 위의 이동 안내를 확인하거나 힌트를 눌러 보세요.');return;}
        const replyText=moveText(E.play(s,step.move),step.reply);
        index++;selected=null;hint=false;
        const done=index===current.steps.length;
        if(done){completed.add(current.id);try{localStorage.setItem(KEY,JSON.stringify([...completed]));}catch(_){storageWarning=true;}}
        render();announce(done?`${current.title} 실습 완료! 이제 이 진형으로 컴퓨터와 대국할 수 있어요.`:`잘 두었어요. 상대: ${replyText}. 다음 한 수를 이어 두세요.`);return;
      }
    }
    if(s.board[pos[0]][pos[1]]?.owner==='player'){
      selected=E.equal(selected,pos)?null:pos;renderBoard();
      announce(selected?`${E.PIECES[s.board[pos[0]][pos[1]].type][1]} 선택. 이동할 칸을 누르세요.`:'선택을 해제했어요.');
    }else announce('먼저 내 말을 선택한 뒤 이동 가능한 칸을 누르세요.');
  }
  $('strategy-search').addEventListener('input',renderCards);
  $('strategy-category').addEventListener('change',renderCards);
  $('strategy-hint').addEventListener('click',()=>{hint=true;selected=current.steps[index].move.from;renderBoard();announce(`${moveText(state(),current.steps[index].move)}. 테두리로 표시한 출발 칸에서 도착 칸으로 움직이세요.`);});
  $('strategy-back').addEventListener('click',()=>{if(index>0){index--;selected=null;hint=false;render();announce('이전 단계로 돌아왔어요. 한 수의 이유를 다시 생각해 보세요.');}});
  $('strategy-reset').addEventListener('click',()=>load(current.id));
  $('strategy-preview').addEventListener('click',()=>{preview=!preview;selected=null;hint=false;render();announce(preview?'완성 모습을 살펴보세요. 실습 진행 상황은 그대로 유지됩니다.':'진행하던 단계로 돌아왔어요.');});
  $('strategy-next').addEventListener('click',()=>{load(D.lessons[(D.lessons.indexOf(current)+1)%D.lessons.length].id);$('strategy-title').focus();});
  window.addEventListener('hashchange',()=>load(window.location.hash.slice(1)));
  load(window.location.hash.slice(1));
})();
