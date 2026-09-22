/* Shared controller: lessons, local practice and server-authoritative online play. */
(()=>{
'use strict';
const E=Baduk,L=BadukLessons,$=id=>document.getElementById(id),KEY='baduk_practice_v1',DONE='baduk_lessons_v1',SESSION='baduk_online_v1';
let mode='learn',state=E.initialState(5),lesson=0,solved=false,completed=[],moves=[],size=9,level=2,human=1,hint=null;
let worker=null,busy=false,job=0,jobTimer=null,sound=false,audio=null,room=null,socket=null,session=null,connected=false,pending=false,requestId=0;
const color=c=>c===1?'흑':'백',say=text=>$('feedback').textContent=text;
function read(key,storage=localStorage){try{return JSON.parse(storage.getItem(key));}catch{return null;}}
function write(key,value,storage=localStorage){try{storage.setItem(key,JSON.stringify(value));return true;}catch{$('save-status').textContent='이 브라우저에서는 저장할 수 없습니다. 창을 닫으면 진행이 사라집니다.';return false;}}
try{const d=read(DONE);if(Array.isArray(d))completed=d.filter(x=>Number.isInteger(x)&&x>=0&&x<L.length);}catch{}
function persist(){if(mode==='practice'&&write(KEY,{version:1,size,level,human,moves}))$('save-status').textContent='이 기기에 자동 저장됨 · '+state.ply+'수';}
function loadPractice(){
 cancelAI();const data=read(KEY);
 try{if(!data)throw Error('new');state=E.restore(data);moves=data.moves;size=data.size;level=[0,1,2,3].includes(data.level)?data.level:2;human=[1,2].includes(data.human)?data.human:1;}
 catch{size=9;level=2;human=1;moves=[];state=E.initialState(size);if(data)say('손상된 저장 데이터를 불러오지 못해 새 판으로 시작합니다.');}
 $('size').value=String(size);$('level').value=String(level);$('color').value=String(human);
}
function tick(){if(!sound)return;try{audio||=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(550,audio.currentTime);o.frequency.exponentialRampToValueAtTime(170,audio.currentTime+.08);g.gain.setValueAtTime(.1,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.1);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.11);}catch{}}
function cancelAI(){job++;worker?.terminate();worker=null;clearTimeout(jobTimer);busy=false;}
function computer(isHint=false){
 if(mode!=='practice'||state.phase!=='play'||state.result||busy)return;
 busy=true;hint=null;render();say(isHint?'추천 수를 생각하고 있어요.':'컴퓨터가 생각하고 있어요.');
 const id=++job,started=Date.now();
 const fail=()=>{if(id!==job)return;cancelAI();render();say('컴퓨터 계산을 불러오지 못했어요. 힌트/계속 버튼으로 다시 시도하거나 새로고침해 주세요.');};
 try{
 worker=new Worker('ai-worker.js');jobTimer=setTimeout(fail,15000);worker.onerror=fail;
 worker.onmessage=({data})=>{if(id!==job||mode!=='practice')return;if(data.error)return fail();
 clearTimeout(jobTimer);worker?.terminate();worker=null;
 jobTimer=setTimeout(()=>{if(id!==job||mode!=='practice')return;busy=false;
 if(isHint){hint=data.index;render();say(data.index===null?'추천: 패스하고 계가를 확인해 보세요.':'추천: '+E.coord(data.index,state.size)+' · 돌 잡기와 활로를 고려한 학습용 추천입니다.');}
 else act({type:'play',index:data.index});
 },Math.max(0,600-(Date.now()-started)));};
 worker.postMessage({id,state,level:isHint?3:level});
 }catch{fail();}
}
function schedule(){if(mode==='practice'&&state.phase==='play'&&!state.result&&state.turn!==human&&!busy)computer();}
function apply(s,a){if(a.type==='play')return E.play(s,a.index);if(a.type==='dead')return E.toggleDead(s,a.index);if(a.type==='resume')return E.resume(s);if(a.type==='finish')return E.finish(s);if(a.type==='resign')return E.resign(s,a.color);throw Error('알 수 없는 동작입니다.');}
function act(a){try{state=apply(state,a);moves.push(a);hint=null;persist();render();if(a.type==='play'){if(a.index!==null)tick();say(a.index===null?color(E.other(state.turn))+'이 패스했습니다.':color(E.other(state.turn))+' · '+E.coord(a.index,state.size)+' 착수');}if(state.phase==='scoring')say('연속 패스입니다. 사석을 표시하고 계가를 확인하거나 대국을 재개하세요.');if(state.result)say(resultText());schedule();}catch(error){say(error.message);render();}}
function resultText(){if(!state.result)return '';const r=state.result;return color(r.winner)+' 승리'+(r.reason==='score'?' · '+r.margin+'점 차':r.reason==='resign'?' · 기권승':' · 상대 퇴장/연결 종료');}
function setupLesson(index){cancelAI();lesson=index;solved=false;hint=null;state=E.initialState(5);L[index].black.forEach(i=>state.board[i]=1);L[index].white.forEach(i=>state.board[i]=2);state.history=[E.key(state.board)];render();say('설명을 읽고 한 수를 직접 두어 보세요.');}
function lessonMove(i){if(solved)return;if(i!==L[lesson].answer){say('다시 생각해 보세요. '+L[lesson].mission);return;}try{state=E.play(state,i);solved=true;if(!completed.includes(lesson))completed.push(lesson);write(DONE,completed);hint=null;tick();render();say(L[lesson].success);}catch(e){say(e.message);}}
function canPlay(){if(busy||state.result||state.phase!=='play')return false;if(mode==='learn')return !solved;if(mode==='practice')return state.turn===human;return connected&&!pending&&room?.status==='playing'&&room.players.length===2&&room.players.every(p=>p.connected)&&room.you===state.turn;}
function onlineAction(event,data={}){return request(event,{revision:room?.revision,...data});}
function choose(i){if(mode==='online'){if(state.phase==='scoring'&&room?.status==='playing'&&connected&&!pending&&room.players.every(p=>p.connected))onlineAction('dead',{index:i});else if(canPlay())onlineAction('move',{move:{index:i}});return;}
 if(mode==='learn')return lessonMove(i);
 if(state.phase==='scoring'&&!state.result&&!busy)return act({type:'dead',index:i});
 if(canPlay())act({type:'play',index:i});
}
function renderBoard(){
 const focusIndex=document.activeElement?.dataset?.index,n=state.size,total=state.phase==='scoring'||state.result?.reason==='score'?E.score(state):null;
 $('board').replaceChildren();$('board').style.setProperty('--n',n);$('board').classList.toggle('large',n===19);$('board').setAttribute('aria-label',n+'줄 바둑판');
 const star=n===9?[2,4,6]:n===13?[3,6,9]:n===19?[3,9,15]:[2];
 state.board.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.className='point';b.dataset.index=i;
 const r=Math.floor(i/n),col=i%n;b.dataset.top=r===0;b.dataset.bottom=r===n-1;b.dataset.left=col===0;b.dataset.right=col===n-1;
 b.dataset.letter='ABCDEFGHJKLMNOPQRST'[col];
 if(col===0){const label=document.createElement('span');label.className='axis-y';label.textContent=n-r;label.setAttribute('aria-hidden','true');b.append(label);}
 b.classList.toggle('last',state.lastMove===i);b.classList.toggle('hint',hint===i);b.classList.toggle('dead',state.dead.includes(i));
 b.setAttribute('aria-label',E.coord(i,n)+' '+(c?color(c)+'돌':'빈자리')+(state.dead.includes(i)?' 사석 표시':''));
 if(c){const stone=document.createElement('span');stone.className='stone '+(c===1?'black':'white');stone.setAttribute('aria-hidden','true');if(state.dead.includes(i))stone.textContent='×';b.append(stone);}
 else if(total?.owners[i]){const mark=document.createElement('span');mark.className='territory '+(total.owners[i]===1?'black':'white');b.append(mark);}
 else if(star.includes(r)&&star.includes(col)){const mark=document.createElement('span');mark.className='star';b.append(mark);}
 b.addEventListener('click',()=>choose(i));b.addEventListener('keydown',event=>{let target=i;if(event.key==='ArrowLeft')target=i-1;else if(event.key==='ArrowRight')target=i+1;else if(event.key==='ArrowUp')target=i-n;else if(event.key==='ArrowDown')target=i+n;else return;event.preventDefault();$('board').children[Math.max(0,Math.min(n*n-1,target))].focus();});
 $('board').append(b);
 });if(focusIndex!==undefined)$('board').children[Number(focusIndex)]?.focus({preventScroll:true});
}
function render(){
 $('lessons').hidden=mode!=='learn';$('settings').hidden=mode!=='practice';$('online').hidden=mode!=='online';
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode);});
 $('progress').textContent=completed.length+' / 12 완료';$('lesson-list').replaceChildren();
 L.forEach((l,i)=>{const b=document.createElement('button');b.className=i===lesson?'active':'';const small=document.createElement('small');small.textContent=l.group+' · '+String(i+1).padStart(2,'0');b.append(small,document.createTextNode(l.title+(completed.includes(i)?' ✓':'')));b.onclick=()=>setupLesson(i);$('lesson-list').append(b);});
 $('kicker').textContent=mode==='learn'?'LESSON '+String(lesson+1).padStart(2,'0'):mode==='practice'?'PRACTICE · '+state.size+' × '+state.size:'ONLINE · '+(room?.code||'LOBBY');
 $('title').textContent=mode==='learn'?L[lesson].title:state.result?resultText():mode==='practice'?'한 판, 천천히.':'친구와 마주 앉아.';
 $('description').textContent=mode==='learn'?L[lesson].text:mode==='practice'?'나: '+color(human)+' · 컴퓨터: '+color(E.other(human))+' · '+['왕초보','초보','중급','고급'][level]+' · 백 덤 6.5점':'방장은 흑, 참가자는 백입니다. 서버가 양쪽에 같은 판을 전달합니다.';
 $('mission-label').textContent=mode==='learn'?'MISSION':'CURRENT TURN';$('mission').textContent=mode==='learn'?L[lesson].mission:state.result?resultText():state.phase==='scoring'?'사석을 확인하고 계가에 동의하세요.':mode==='online'&&!room?'방을 만들거나 코드로 입장하세요.':color(state.turn)+' 차례'+(mode==='practice'?(state.turn===human?' · 내가 둘 차례':' · 컴퓨터 차례'):(room?.you===state.turn?' · 내가 둘 차례':' · 상대 차례'));
 $('turn').textContent=state.result?'대국 종료':state.phase==='scoring'?'계가 확인':color(state.turn)+' 차례';$('turn-dot').style.background=state.turn===1?'#252620':'#ddd9cc';$('ply').textContent=state.ply+'수';
 $('black-count').textContent=state.captures[1];$('white-count').textContent=state.captures[2];
 $('hint').hidden=mode==='online';$('hint').disabled=busy||Boolean(state.result)||state.phase!=='play';$('hint').textContent=mode==='practice'&&state.turn!==human?'컴퓨터 계속':'힌트 보기';
 $('reset-lesson').hidden=mode!=='learn';$('next').hidden=mode!=='learn';$('next').disabled=!solved;$('next').textContent=lesson===11?'연습 대국 시작 →':'다음 문제 →';
 $('pass').hidden=mode==='learn'&&L[lesson].answer!==null;$('pass').disabled=!canPlay();
 $('undo').hidden=mode!=='practice';$('undo').disabled=!moves.length;
 $('resign').hidden=mode==='learn';$('resign').disabled=Boolean(state.result)||(mode==='online'&&(!room||room.status!=='playing'||!connected||pending));
 $('scoring').hidden=state.phase!=='scoring'&&state.result?.reason!=='score';
 $('accept').hidden=Boolean(state.result);$('resume-play').hidden=Boolean(state.result);
 if(!$('scoring').hidden){const s=E.score(state);$('score-detail').textContent='흑 '+s.black+' = 돌 '+s.stones[1]+' + 빈자리 '+s.territory[1]+'\n백 '+s.white+' = 돌 '+s.stones[2]+' + 빈자리 '+s.territory[2]+' + 덤 6.5';$('agreement').textContent=state.result?'확정된 최종 점수입니다.':mode==='online'?'동의 '+(room?.scoreReady?.length||0)+' / 2 · 사석을 바꾸면 동의가 초기화됩니다.':'학습자가 사석을 검토합니다. AI가 생사를 판정하지 않습니다.';}
 $('accept').disabled=mode==='online'&&(!connected||pending||room?.players.some(p=>!p.connected)||room?.scoreReady?.includes(room.you));$('resume-play').disabled=mode==='online'&&(!connected||pending||room?.players.some(p=>!p.connected));
 $('record-panel').hidden=mode==='learn';$('records').replaceChildren();
 const records=mode==='online'?(room?.records||[]).map(r=>r.text):moves.filter(a=>a.type==='play').map((a,i)=>color(i%2+1)+' '+(a.index===null?'패스':E.coord(a.index,state.size)));
 records.slice(-200).forEach(t=>{const li=document.createElement('li');li.textContent=t;$('records').append(li);});
 renderBoard();renderRoom();
}
function changeMode(next){if(next===mode)return;if(room&&next!=='online'){say('온라인 방에서 먼저 나가 주세요.');return;}cancelAI();hint=null;mode=next;say('');if(mode==='learn')setupLesson(lesson);else if(mode==='practice'){loadPractice();render();schedule();}else{state=E.initialState(9);render();connectOnline();}}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>changeMode(b.dataset.mode));
$('hint').onclick=()=>{if(mode==='learn'){hint=L[lesson].answer;render();say(hint===null?'패스 버튼을 눌러 보세요.':'금색 고리가 표시된 '+E.coord(hint,state.size)+'에 두세요.');}else computer(state.turn===human);};
$('reset-lesson').onclick=()=>setupLesson(lesson);$('next').onclick=()=>{if(!solved)return;if(lesson===11)changeMode('practice');else setupLesson(lesson+1);};
$('pass').onclick=()=>{if(!canPlay())return;if(mode==='learn')lessonMove(null);else if(mode==='online')onlineAction('move',{move:{index:null}});else act({type:'play',index:null});};
$('new').onclick=()=>{if(moves.length&&!confirm('저장된 대국을 지우고 새로 시작할까요?'))return;cancelAI();size=Number($('size').value);level=Number($('level').value);human=Number($('color').value);moves=[];state=E.initialState(size);hint=null;persist();render();say('새 대국입니다. 흑이 먼저 둡니다.');schedule();};
$('undo').onclick=()=>{if(!moves.length)return;cancelAI();let end=moves.length;while(end>0){end--;try{const previous=E.restore({version:1,size,moves:moves.slice(0,end)});if(previous.phase==='play'&&previous.turn===human){moves=moves.slice(0,end);state=previous;break;}}catch{}}
 if(!end){moves=[];state=E.initialState(size);}hint=null;persist();render();say('내가 두기 전으로 되돌렸습니다.');schedule();};
$('resign').onclick=()=>{if(!confirm('이 대국을 기권할까요?'))return;cancelAI();if(mode==='online')onlineAction('resign');else act({type:'resign',color:human});};
$('accept').onclick=()=>{if(mode==='online')onlineAction('accept');else if(confirm('표시된 사석과 점수로 대국을 마칠까요?'))act({type:'finish'});};
$('resume-play').onclick=()=>{if(mode==='online')onlineAction('continue');else act({type:'resume'});};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',sound);tick();};
function network(text){$('network').textContent=text;}
function remember(data){session=data;write(SESSION,data,sessionStorage);}
function clearRoom(){room=null;session=null;try{sessionStorage.removeItem(SESSION);}catch{}state=E.initialState(9);render();}
function renderRoom(){
 if(mode!=='online')return;$('lobby').hidden=Boolean(room);$('room-info').hidden=!room;$('rooms').hidden=Boolean(room);
 ['create','join'].forEach(id=>$(id).disabled=!connected||pending);
 if(!room)return;
 // Render names only through textContent, never server-provided HTML.
 $('room-label').textContent='방 '+room.code+' · '+room.players.map(p=>p.name+' ('+color(p.owner)+')'+(p.connected?'':' · 재접속 대기')).join(' / ');
 $('invite').value=location.origin+'/baduk/?room='+room.code;
 $('start').hidden=room.status!=='waiting'||!room.isHost;$('start').disabled=!connected||pending||room.players.length!==2||room.players.some(p=>!p.connected);
 $('rematch').hidden=room.status!=='finished';$('rematch').disabled=!connected||pending||room.rematchReady;$('rematch').textContent='다시 두기 동의 ('+room.rematchCount+'/2)';
 $('leave').disabled=!connected||pending;
}
function request(event,data={}){
 if(!socket||!connected||pending)return;pending=true;const id=++requestId;render();
 socket.timeout(7000).emit(event,data,(err,res)=>{if(id!==requestId)return;pending=false;
 if(err){network('응답이 늦습니다. 현재 방 상태를 다시 확인합니다.');socket.emit('sync',{},()=>{});}
 else if(!res?.ok){network(res?.error||'요청에 실패했습니다.');if(res?.code==='ROOM_GONE')clearRoom();}
 render();});
}
function connectOnline(){
 if(socket){render();return;}
 if(typeof io!=='function'){network('서버 연결 스크립트를 불러오지 못했습니다. 새로고침해 주세요.');return;}
 session=read(SESSION,sessionStorage);socket=io('/baduk',{autoConnect:false});
 socket.on('connect',()=>{connected=true;pending=false;requestId++;network('연결되었습니다.');render();if(session)request('resume',session);else request('list');});
 socket.on('session',remember);
 socket.on('view',v=>{room=v;if(mode==='online'){state=v.state||E.initialState(v.size||9);hint=null;render();say(v.state?.result?resultText():v.status==='waiting'?'상대를 초대하고 대국을 시작하세요.':v.players.some(p=>!p.connected)?'연결이 끊긴 상대를 기다립니다. 90초 뒤 패배 처리됩니다.':state.phase==='scoring'?'사석을 확인하고 두 사람 모두 계가에 동의하세요.':'내 차례에 한 수를 두세요.');}});
 socket.on('rooms',list=>{$('rooms').replaceChildren();if(!list.length)$('rooms').textContent='대기 중인 방이 없습니다. 첫 방을 만들어 보세요.';list.forEach(r=>{const li=document.createElement('li'),b=document.createElement('button');b.textContent=r.name+'님의 방 · '+r.code+' · '+r.size+'줄';b.onclick=()=>request('join',{code:r.code,name:$('nickname').value});li.append(b);$('rooms').append(li);});});
 socket.on('left',()=>{clearRoom();network('방에서 나왔습니다.');});
 socket.on('roomClosed',text=>{clearRoom();network(text);});
 socket.on('replaced',()=>{clearRoom();socket.disconnect();network('다른 탭이 이 대국에 복귀했습니다. 새로고침 후 새 방을 이용하세요.');});
 socket.on('disconnect',()=>{connected=false;pending=false;requestId++;render();network('연결이 끊겼습니다. 90초 안에 자동 재접속하면 이어 둘 수 있습니다.');});
 socket.on('connect_error',()=>{connected=false;render();network('서버에 연결하지 못했습니다. 자동으로 다시 시도합니다.');});
 socket.connect();
}
$('create').onclick=()=>request('create',{name:$('nickname').value,size:Number($('online-size').value)});
$('join').onclick=()=>request('join',{name:$('nickname').value,code:$('code').value});
$('start').onclick=()=>onlineAction('start');$('rematch').onclick=()=>onlineAction('rematch');
$('leave').onclick=()=>{if(room?.status==='playing'&&!confirm('진행 중 나가면 패배합니다. 나갈까요?'))return;request('leave');};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').value);network('초대 링크를 복사했습니다.');}catch{$('invite').select();network('위 링크를 선택해 직접 복사하세요.');}};
setupLesson(0);
const invite=new URLSearchParams(location.search).get('room');
if(invite){$('code').value=invite.toUpperCase().slice(0,6);changeMode('online');}
else if(read(SESSION,sessionStorage))changeMode('online');
})();
