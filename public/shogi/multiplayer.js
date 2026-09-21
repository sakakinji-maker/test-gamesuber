(() => {
  'use strict';
  const E = window.Shogi, $ = id => document.getElementById(id);
  const KEY = 'shogi_online_session_v1';
  let socket, room = null, session = null, online = false, pending = false, generation = 0;
  let selected = null, hand = null, promotion = [], promotionRevision = null, confirmCallback = null;
  let storageAvailable = true, displaced = false;
  const coord = ([r,c]) => `${9-c}${'一二三四五六七八九'[r]}`;
  const message = text => { $('multi-message').textContent = text; };
  const myName = () => $('nickname').value.trim();
  function remember(value) {
    session = value;
    try { if (value) sessionStorage.setItem(KEY, JSON.stringify(value)); else sessionStorage.removeItem(KEY); }
    catch (_) { storageAvailable = false; }
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved && typeof saved.code === 'string' && typeof saved.token === 'string') session = saved;
  } catch (_) { storageAvailable = false; }
  if (session?.name) $('nickname').value = session.name;
  $('room-code-input').value = (new URLSearchParams(window.location.search).get('room') || '').slice(0,6).toUpperCase();
  function clearSelection() { selected = null; hand = null; promotion = []; }
  function leaveLocally() {
    room = null; remember(null); clearSelection(); pending = false;
    if ($('multi-promotion').open) $('multi-promotion').close('cancel');
    if ($('multi-confirm').open) $('multi-confirm').close('cancel');
    render();
  }
  function sync() {
    if (!online) return;
    const id = generation; pending = true; render();
    socket.timeout(8000).emit('sync', {}, (error, res) => {
      if (id !== generation) return;
      pending = false;
      if (!error && res?.ok && !res.inRoom) leaveLocally();
      render();
      if (error) message('서버 응답을 기다리고 있어요. 연결 상태를 확인한 뒤 새로고침해 주세요.');
    });
  }
  function request(event, data = {}, done) {
    if (!online || pending) return;
    pending = true; const id = generation; render();
    socket.timeout(8000).emit(event, data, (error, res) => {
      if (id !== generation) return;
      pending = false; render();
      if (error) { message('응답을 확인하지 못했어요. 현재 방 상태를 다시 확인합니다.'); sync(); return; }
      if (!res?.ok) { message(res?.error || '요청을 처리하지 못했어요.'); if (res?.code === 'ROOM_GONE' && (room || event === 'resume')) leaveLocally(); return; }
      done?.(res);
    });
  }
  function connectedPlayers() { return room?.players.length === 2 && room.players.every(p => p.connected); }
  function canMove() { return online && !pending && room?.status === 'playing' && connectedPlayers() && room.state.turn === room.you; }
  function resultText() {
    const result = room.state.result;
    const reasons = { mate:'외통', 'no-moves':'둘 수 있는 수 없음', resign:'기권', leave:'방 나가기', disconnect:'90초 내 복귀하지 않음', repetition:'같은 국면 네 번 반복', 'perpetual-check':'연속 왕수 반복', 'move-limit':'600수 도달' };
    return `${result.winner === null ? '무승부' : result.winner === room.you ? '내 승리' : '상대의 승리'} · ${reasons[result.reason] || '대국 종료'}`;
  }
  function statusText() {
    if (!online) return '연결이 끊겼어요. 자동으로 다시 연결하고 있습니다.';
    if (room.status === 'finished') return resultText();
    if (!connectedPlayers()) return '상대가 연결을 복구하는 동안 대국을 멈춥니다. 90초 안에 복귀하면 이어서 둘 수 있어요.';
    if (pending) return '서버에서 한 수를 확인하고 있어요…';
    if (E.inCheck(room.state.board, room.state.turn)) return room.state.turn === room.you ? '왕수! 왕을 피하거나 공격을 막아야 해요.' : '상대가 왕수를 받고 있어요.';
    return room.state.turn === room.you ? '내 차례예요. 말을 선택하고 이동할 칸을 누르세요.' : '상대가 한 수를 생각하고 있어요.';
  }
  function renderBoard() {
    const state = room.state, flipped = room.you === 'opponent';
    const legal = canMove() && (selected || hand) ? E.legalMoves(state).filter(m => hand ? m.drop === hand : E.equal(m.from,selected)) : [];
    const active = document.activeElement;
    const focus = active?.parentElement === $('online-board') ? [active.dataset.row,active.dataset.col] : null;
    $('online-board').replaceChildren(); $('online-files').replaceChildren(); $('online-ranks').replaceChildren();
    for (let n=0;n<9;n++) {
      const file = document.createElement('span'); file.textContent = flipped ? n+1 : 9-n; $('online-files').append(file);
      const rank = document.createElement('span'); rank.textContent = '一二三四五六七八九'[flipped?8-n:n]; $('online-ranks').append(rank);
    }
    for (let vr=0;vr<9;vr++) for (let vc=0;vc<9;vc++) {
      const r = flipped?8-vr:vr, c = flipped?8-vc:vc, pos=[r,c], p=state.board[r][c];
      const b = document.createElement('button'); b.type='button'; b.className='square'; b.dataset.row=r;b.dataset.col=c;
      const allowed=legal.some(m=>E.equal(m.to,pos));
      if(allowed)b.classList.add('legal');if(allowed&&p)b.classList.add('capture');
      if(E.equal(state.lastMove?.to,pos)||E.equal(state.lastMove?.from,pos))b.classList.add('last-move');
      if(p?.type==='K'&&p.owner===state.turn&&E.inCheck(state.board,state.turn))b.classList.add('king-check');
      b.setAttribute('aria-pressed',String(E.equal(selected,pos)));
      b.setAttribute('aria-label',`${coord(pos)} ${p?`${p.owner===room.you?'내':'상대'} ${E.PIECES[p.type][1]}`:'빈 칸'}${allowed?' · 이동 가능':''}`);
      if(p){const token=document.createElement('span');token.className=`piece ${p.owner===room.you?'player':'opponent'}${p.type.startsWith('+')?' promoted':''}${E.equal(selected,pos)?' selected':''}`;token.textContent=E.PIECES[p.type][0];token.setAttribute('aria-hidden','true');b.append(token);}
      b.addEventListener('click',()=>onSquare(pos));
      b.addEventListener('keydown',event=>{const d={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[event.key];if(!d)return;event.preventDefault();const direction=flipped?-1:1;$('online-board').querySelector(`[data-row="${r+d[0]*direction}"][data-col="${c+d[1]*direction}"]`)?.focus();});
      $('online-board').append(b);
    }
    if(focus)$('online-board').querySelector(`[data-row="${focus[0]}"][data-col="${focus[1]}"]`)?.focus({preventScroll:true});
    for(const [owner,id] of [[room.you,'online-my-hand'],[E.other(room.you),'online-their-hand']]){
      $(id).replaceChildren();
      if(!state.hands[owner].length){const text=document.createElement('small');text.textContent='잡은 말이 없습니다';$(id).append(text);}
      for(const type of E.TYPES){const count=state.hands[owner].filter(t=>t===type).length;if(!count)continue;
        const b=document.createElement('button');b.type='button';b.className=`hand-piece${owner===room.you&&hand===type?' selected':''}`;b.textContent=E.PIECES[type][0];b.disabled=owner!==room.you||!canMove();
        b.setAttribute('aria-label',`${owner===room.you?'내':'상대'} ${E.PIECES[type][1]} ${count}개`);
        const n=document.createElement('span');n.className='hand-count';n.textContent=count;b.append(n);
        b.addEventListener('click',()=>{hand=hand===type?null:type;selected=null;render();});$(id).append(b);
      }
    }
  }
  function render() {
    $('connection-status').textContent = displaced ? '다른 탭에서 대국 중 · 이 탭은 연결 종료' : online ? `● 서버 연결됨${storageAvailable?'':' · 이 탭에서 복귀 정보 저장 불가'}` : '○ 연결 중 · 잠시 기다려 주세요';
    $('lobby-panel').hidden=Boolean(room);$('room-panel').hidden=!room;
    for(const id of ['create-room','join-room','refresh-rooms'])$(id).disabled=!online||pending;
    if(!room)return;
    $('room-title').textContent=room.code;
    $('invite-link').value=`${window.location.origin}${window.location.pathname}?room=${room.code}`;
    $('players-list').replaceChildren();
    for(const owner of ['player','opponent']){
      const p=room.players.find(x=>x.owner===owner),seat=document.createElement('div');seat.className=`player-seat${owner===room.you?' mine':''}`;
      const name=document.createElement('strong');name.textContent=p?`${p.name}${owner===room.you?' · 나':''}`:'상대를 기다리는 자리';
      const info=document.createElement('small');info.textContent=`${owner==='player'?'선공':'후공'} · ${p?p.connected?'연결됨':'연결 끊김 · 90초 복귀 대기':'빈자리'}`;
      seat.append(name,info);$('players-list').append(seat);
    }
    $('leave-room').disabled=!online||pending;
    const waiting=room.status==='waiting';$('waiting-panel').hidden=!waiting;$('online-match').hidden=waiting;
    if(waiting){
      $('waiting-title').textContent=connectedPlayers()?'두 사람이 모두 모였어요.':'상대를 기다리고 있어요.';
      $('waiting-copy').textContent=room.isHost?'위의 코드나 초대 링크를 공유하세요. 두 사람이 연결되면 직접 시작할 수 있어요.':'방장이 대국을 시작하면 판이 열립니다. 잠시 기다려 주세요.';
      $('start-match').disabled=!online||pending||!room.isHost||!connectedPlayers();
      $('start-match').textContent=room.isHost?'대국 시작 →':'방장의 시작을 기다리는 중';return;
    }
    $('online-turn').textContent=room.status==='finished'?'대국 종료':room.state.turn===room.you?'내 차례':'상대 차례';
    $('online-ply').textContent=`${room.state.ply}수 · 나는 ${room.you==='player'?'선공':'후공'}`;
    $('online-status').textContent=statusText();
    $('resign-match').disabled=!online||pending||room.status!=='playing';
    $('rematch').hidden=room.status!=='finished';$('rematch').disabled=!online||pending||!connectedPlayers()||room.rematchReady;
    $('rematch').textContent=room.rematchReady?'상대의 다시 두기 응답 대기':room.rematchCount?'상대가 다시 두기를 원해요 · 수락':'다시 두기 요청';
    $('online-record').replaceChildren();
    for(const record of room.records){const li=document.createElement('li');li.textContent=`${record.ply}. ${record.owner===room.you?'나':'상대'} · ${record.text}`;$('online-record').append(li);}
    $('online-record').scrollTop=$('online-record').scrollHeight;renderBoard();
  }
  function sendMove(move) { if(canMove()){clearSelection();request('move',{revision:room.revision,move});} }
  function onSquare(pos) {
    if(!canMove()||$('multi-promotion').open){if(!canMove())message('내 차례이고 두 사람이 연결되어 있을 때 움직일 수 있어요.');return;}
    const choices=E.legalMoves(room.state).filter(m=>(hand?m.drop===hand:selected&&E.equal(m.from,selected))&&E.equal(m.to,pos));
    if(choices.length===1){sendMove(choices[0]);return;}
    if(choices.length>1){promotion=choices;promotionRevision=room.revision;const p=room.state.board[selected[0]][selected[1]];$('multi-promotion-copy').textContent=`${E.PIECES[p.type][1]}을 ${E.PIECES['+'+p.type][1]}으로 승격할 수 있어요.`;$('multi-promotion').returnValue='';$('multi-promotion').showModal();return;}
    const p=room.state.board[pos[0]][pos[1]];
    if(p?.owner===room.you){selected=E.equal(selected,pos)?null:pos;hand=null;render();}
    else message('내 말을 선택한 뒤 초록 점이 있는 칸을 눌러 주세요.');
  }
  $('multi-promotion').addEventListener('close',()=>{const value=$('multi-promotion').returnValue;const choice=promotion.find(m=>m.promote===(value==='yes'));promotion=[];if(['yes','no'].includes(value)&&room?.revision===promotionRevision&&choice)sendMove(choice);});
  function confirmAction(title,copy,fn){confirmCallback=fn;$('multi-confirm-title').textContent=title;$('multi-confirm-copy').textContent=copy;$('multi-confirm').returnValue='';$('multi-confirm').showModal();}
  $('multi-confirm').addEventListener('close',()=>{const fn=confirmCallback;confirmCallback=null;if($('multi-confirm').returnValue==='yes')fn?.();});
  $('create-room').addEventListener('click',()=>request('create',{name:myName()}));
  $('join-form').addEventListener('submit',event=>{event.preventDefault();request('join',{name:myName(),code:$('room-code-input').value});});
  $('refresh-rooms').addEventListener('click',()=>request('list'));
  $('start-match').addEventListener('click',()=>request('start',{revision:room.revision}));
  $('leave-room').addEventListener('click',()=>confirmAction('방을 나갈까요?',room.status==='playing'?'대국 중 방을 나가면 패배 처리됩니다.':'이 방의 참가 자리와 복귀 정보가 지워집니다.',()=>request('leave')));
  $('resign-match').addEventListener('click',()=>confirmAction('이번 대국을 기권할까요?','상대의 승리로 대국이 종료됩니다.',()=>request('resign',{revision:room.revision})));
  $('rematch').addEventListener('click',()=>request('rematch',{revision:room.revision}));
  async function copy(text){try{await navigator.clipboard.writeText(text);message('복사했어요. 친구에게 보내 주세요.');}catch(_){$('invite-link').focus();$('invite-link').select();message('자동 복사가 어려워요. 위 초대 링크를 직접 복사해 주세요.');}}
  $('copy-code').addEventListener('click',()=>copy(room.code));$('copy-link').addEventListener('click',()=>copy($('invite-link').value));
  if(typeof window.io!=='function'){message('실시간 연결 기능을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.');return;}
  socket=window.io('/shogi',{autoConnect:false});
  socket.on('connect',()=>{
    online=true;pending=false;generation++;render();
    if(session){request('resume',{code:session.code,token:session.token});}
    else {message('닉네임을 입력하고 방을 만들거나 입장해 주세요.');request('list');}
  });
  socket.on('session',data=>remember(data));
  socket.on('view',data=>{
    const previousRevision=room?.revision;
    room=data;clearSelection();
    if($('multi-promotion').open&&previousRevision!==data.revision)$('multi-promotion').close('cancel');
    render();message(data.status==='waiting'?'방에 입장했어요. 친구를 초대하거나 상대를 기다려 주세요.':data.status==='finished'?resultText():'두 사람이 같은 판을 보고 있어요. 한 수씩 이어 두세요.');
  });
  socket.on('rooms',rooms=>{
    $('rooms-list').replaceChildren();
    if(!rooms.length){const li=document.createElement('li');li.textContent='아직 기다리는 방이 없어요. 첫 방을 열어 보세요.';$('rooms-list').append(li);}
    for(const r of rooms){const li=document.createElement('li'),copy=document.createElement('div'),name=document.createElement('strong'),code=document.createElement('small'),button=document.createElement('button');name.textContent=r.name+'님의 방';code.textContent=`${r.code} · 1 / 2명`;copy.append(name,code);button.type='button';button.className='button button-secondary';button.textContent='입장';button.addEventListener('click',()=>{$('room-code-input').value=r.code;request('join',{code:r.code,name:myName()});});li.append(copy,button);$('rooms-list').append(li);}
  });
  socket.on('left',()=>{leaveLocally();message('방에서 나왔어요. 새 방을 만들거나 다른 방에 입장하세요.');});
  socket.on('roomClosed',text=>{leaveLocally();message(text);});
  socket.on('replaced',()=>{displaced=true;leaveLocally();socket.disconnect();online=false;render();message('다른 탭에서 이 자리에 복귀했어요. 이 탭에서는 대국을 종료합니다.');});
  socket.on('disconnect',()=>{online=false;pending=false;generation++;clearSelection();if($('multi-promotion').open)$('multi-promotion').close('cancel');render();message(displaced?'다른 탭에서 이 자리에 복귀했어요. 새로 시작하려면 이 페이지를 새로고침해 주세요.':'연결이 끊겼어요. 자동 재접속 중입니다. 90초 안에 복귀하면 대국을 이어갈 수 있어요.');});
  socket.on('connect_error',()=>{online=false;render();message('서버에 연결하지 못했어요. 잠시 후 자동으로 다시 시도합니다.');});
  socket.connect();
})();
