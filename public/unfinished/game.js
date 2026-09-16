'use strict';
const KEY='unfinished_story_v1',fresh=()=>({chapter:0,seen:[],solved:false,phase:'title',reply:0});
let state=fresh(),storageOK=true;
try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&Number.isInteger(s.chapter)&&s.chapter>=0&&s.chapter<CHAPTERS.length&&Array.isArray(s.seen)&&s.seen.every(i=>Number.isInteger(i)&&i>=0&&i<3)&&new Set(s.seen).size===s.seen.length&&['title','chapter','letter','ending'].includes(s.phase)&&typeof s.solved==='boolean'&&[0,1,2].includes(s.reply))state=s;}catch{storageOK=false;}
const $=id=>document.getElementById(id);
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}$('save-status').textContent=storageOK?'이 기기에 자동 저장됩니다.':'저장을 사용할 수 없습니다. 이 창에서 계속 플레이할 수 있습니다.';}
function button(label,fn,primary=false){const el=document.createElement('button');el.textContent=label;if(primary)el.className='primary';el.onclick=fn;$('actions').append(el);return el;}
function paragraph(text,parent=$('story')){const p=document.createElement('p');p.textContent=text;parent.append(p);}
function heading(text){const h=document.createElement('h2');h.textContent=text;$('story').append(h);}
function quote(text){const q=document.createElement('blockquote');q.textContent=text;$('story').append(q);}
function clear(){ $('story').replaceChildren();$('actions').replaceChildren();$('feedback').textContent='';}
function notebook(){ $('notes').replaceChildren();CHAPTERS.forEach((c,ci)=>c.clues.forEach((clue,i)=>{if(ci<state.chapter||(ci===state.chapter&&state.seen.includes(i)))paragraph(clue[0]+'\n'+clue[1],$('notes'));}));if(!$('notes').childElementCount)paragraph('아직 발견한 단서가 없습니다.',$('notes'));}
function render(){clear();notebook();save();$('notebook').hidden=state.phase==='title';
if(state.phase==='title'){$('progress').textContent='PROLOGUE';heading('여덟 해 만에 펼친 책');paragraph('다섯 명이 함께 만든 책 한 권.\n한 사람만 다른 결말을 기억하고 있었다.');paragraph('각 장의 단서 세 개를 읽고 추리를 선택하세요. 오답에 벌점은 없습니다. 수첩에서 이전 단서도 다시 읽을 수 있어요.');button('책을 펼친다',()=>{state.phase='chapter';render();},true);return;}
if(state.phase==='letter'){$('progress').textContent='EPILOGUE';heading('나는 답장을 쓴다');paragraph('연락해도 좋다는 허락을 받고 메시지 창을 열었다. 한 줄을 썼다가 지웠다. 사과가 내 마음만 편하게 만드는 일이 되어서는 안 됐다.');quote('그때 네가 보낸 글을 이제야 제대로 읽었어.');paragraph('어떤 말을 덧붙일까? 선택은 내 마지막 독백을 바꿉니다. 상대의 답을 바꾸지는 않습니다.');['좋은 뜻이었다는 말로 변명하지 않을게.','괜찮다면 한 번 만나 사과하고 싶어.','대답하지 않아도 돼. 읽어줘서 고마워.'].forEach((s,i)=>button(s,()=>{state.reply=i;state.phase='ending';render();}));return;}
if(state.phase==='ending'){$('progress').textContent='BAD END / 너무 늦게 읽은 문장';heading('사흘 뒤, 답장이 왔다');quote('읽어줘서 고마워.\n그때 즐거웠던 일도 있었어. 그건 나도 기억해.\n그런데 나는 이제 그때 이야기를 다시 하고 싶지 않아.\n만나지는 말자.');paragraph(['좋은 뜻이었다는 말을 지웠다. 지웠다고 해서 그때의 내가 달라지는 것은 아니었다.','다시 만나면 돌려놓을 수 있을 거라고 생각했다. 그 역시 나 혼자 정한 다음 장이었다.','답장을 바라지 않는다고 썼지만 마음 한편에서는 용서를 기다렸다. 그 기대도 내가 내려놓아야 했다.'][state.reply]);paragraph('그 아이는 자신의 삶을 살고 있었다. 내가 책을 펼칠 때까지 같은 방에서 기다리던 사람이 아니었다.\n\n휴대전화를 내려놓고 마지막 장을 펼쳤다. 내가 고쳐 쓴 문장 옆에 다섯 명의 사진이 있었다.');quote('우리는 그 뒤로도 오래도록 함께했다.');paragraph('모든 단서가 맞아떨어졌다.\n그런데 아무도 돌아오지 않았다.');button('책을 덮는다 · 처음부터',()=>{state=fresh();render();},true);button('수첩 다시 읽기',()=>{$('notebook').open=true;$('notebook').scrollIntoView({behavior:'smooth'});});return;}
const c=CHAPTERS[state.chapter];$('progress').textContent='CHAPTER '+(state.chapter+1)+' / '+CHAPTERS.length+' · 단서 '+state.seen.length+'/3';heading(c.title);paragraph(c.intro);quote(c.quote);
c.clues.forEach((clue,i)=>button((state.seen.includes(i)?'✓ ':'○ ')+clue[0],()=>readClue(i)));
if(state.solved){paragraph(c.solution);button(state.chapter===CHAPTERS.length-1?'연락을 보낸다':'다음 장을 읽는다',()=>{if(state.chapter===CHAPTERS.length-1)state.phase='letter';else{state.chapter++;state.seen=[];state.solved=false;}render();$('story').focus();},true);}else{button('단서를 연결해 추리하기',deduce,true).disabled=state.seen.length<3;}}
function readClue(i){if(!state.seen.includes(i))state.seen.push(i);render();clear();const c=CHAPTERS[state.chapter].clues[i];heading(c[0]);paragraph(c[1]);button('책으로 돌아가기',render,true);$('story').focus();}
function deduce(){clear();const c=CHAPTERS[state.chapter];heading('단서 연결');paragraph(c.question);c.options.forEach((s,i)=>button(s,()=>{if(i===c.answer){state.solved=true;render();$('story').focus();}else $('feedback').textContent='이 결론은 단서와 맞지 않습니다. '+c.hint;}));button('책과 단서 다시 보기',render);}
$('restart').onclick=()=>{if(confirm('저장된 진행을 지우고 처음부터 시작할까요?')){state=fresh();render();}};
render();
