'use strict';
const KEY = 'unfinished_story_v2';
const PAGES = STORY.chapters.flatMap((chapter, chapterIndex) =>
  chapter.pages.map((page, localIndex) => ({...page, chapterIndex, localIndex})));
const fresh = () => ({version:2, started:false, cursor:0, furthest:0, choices:{}, inspected:{}, completed:false});
let state = fresh();
let storageOK = true;
const $ = id => document.getElementById(id);
function validSave(s) {
  if (!s || s.version!==2 || typeof s.started!=='boolean' || typeof s.completed!=='boolean' ||
      !Number.isInteger(s.cursor) || !Number.isInteger(s.furthest) ||
      s.cursor<0 || s.cursor>s.furthest || s.furthest>=PAGES.length ||
      !s.choices || typeof s.choices!=='object' || Array.isArray(s.choices) ||
      !s.inspected || typeof s.inspected!=='object' || Array.isArray(s.inspected)) return false;
  for (const [key,value] of Object.entries(s.choices)) {
    const p = PAGES[Number(key)];
    if (!/^\d+$/.test(key) || Number(key)>s.furthest || p?.kind!=='choice' ||
        !Number.isInteger(value) || !p.choices[value]) return false;
  }
  for (const [key,value] of Object.entries(s.inspected)) {
    const p=PAGES[Number(key)];
    if (!/^\d+$/.test(key) || Number(key)>s.furthest || p?.kind!=='explore' || !Array.isArray(value) ||
        new Set(value).size!==value.length || value.some(i=>!Number.isInteger(i)||!p.items[i])) return false;
  }
  return true;
}
try {
  const saved=JSON.parse(localStorage.getItem(KEY));
  if (validSave(saved)) state=saved;
} catch { storageOK=false; }
function persist() {
  try { localStorage.setItem(KEY,JSON.stringify(state));storageOK=true; } catch { storageOK=false; }
  $('save-status').textContent=storageOK?'자동 저장 · 이 브라우저에 보관됩니다.':'저장을 사용할 수 없습니다. 창을 닫으면 진행이 사라질 수 있어요.';
}
function element(tag,text,cls) {
  const el=document.createElement(tag);
  if (text!==undefined) el.textContent=text;
  if (cls) el.className=cls;
  return el;
}
function addButton(parent,label,action,cls) {
  const b=element('button',label,cls);
  b.onclick=action;parent.append(b);return b;
}
function ready(page=PAGES[state.cursor]) {
  if(page.kind==='explore') return (state.inspected[state.cursor]||[]).length===page.items.length;
  if(page.kind==='choice') return Number.isInteger(state.choices[state.cursor]);
  return true;
}
function updateNavigation() {
  $('previous').disabled=state.cursor===0;
  $('next').disabled=!ready();
  const page=PAGES[state.cursor];
  $('next').textContent=page.ending?'책을 덮는다':page.localIndex===STORY.chapters[page.chapterIndex].pages.length-1?'다음 장 →':'계속 읽기 →';
  $('feedback').textContent=page.kind==='explore'&&!ready()?'물건을 눌러 모두 살펴본 뒤 계속 읽을 수 있어요.':
    page.kind==='choice'&&!ready()?'마음에 가까운 말을 고르세요. 정답이나 벌점은 없습니다.':'';
}
function renderNotes() {
  const notes=$('notes');notes.replaceChildren();
  for(let i=0;i<=state.furthest;i++) {
    const p=PAGES[i];
    if(p.note) {const box=element('section');box.append(element('h3',p.note.title),element('p',p.note.text));notes.append(box);}
    if(p.kind==='explore') for(const index of state.inspected[i]||[]) {
      const item=p.items[index],box=element('section');
      box.append(element('h3',item.title),element('p',item.text));notes.append(box);
    }
  }
  if(!notes.childElementCount) notes.append(element('p','아직 남긴 기록이 없습니다.'));
  $('chapters').replaceChildren();
  STORY.chapters.forEach((c,ci)=>{
    const index=PAGES.findIndex(p=>p.chapterIndex===ci);
    if(index<=state.furthest) addButton($('chapters'),String(ci+1).padStart(2,'0')+' · '+c.title,()=>go(index));
  });
}
function showInspection(title,text) {
  $('inspection').replaceChildren(element('h3',title),element('p',text));
  $('inspection').hidden=false;
  $('inspection').focus();
}
function renderPage() {
  $('title-screen').hidden=true;$('game-screen').hidden=false;
  const p=PAGES[state.cursor],chapter=STORY.chapters[p.chapterIndex];
  $('stage').dataset.scene=chapter.scene;
  $('scene-place').textContent=chapter.place;
  $('scene-time').textContent=chapter.time;
  $('chapter-title').textContent=chapter.title;
  $('chapter-number').textContent='CHAPTER '+String(p.chapterIndex+1).padStart(2,'0')+' / 15';
  $('page-count').textContent=(p.localIndex+1)+' / '+chapter.pages.length;
  $('story').replaceChildren();$('interactions').replaceChildren();$('inspection').hidden=true;
  $('ending-actions').hidden=true;
  if(p.kind==='document') {
    const paper=element('div',undefined,'paper');
    paper.append(element('h3',p.title),element('p',p.text));$('story').append(paper);
  } else {
    if(p.kind==='dialogue') $('story').append(element('div',p.speaker,'speaker'+(p.speaker==='나'?' self':'')));
    $('story').append(element('p',p.text,p.kind==='dialogue'?'dialogue-text':'narration'));
  }
  if(p.kind==='explore') p.items.forEach((item,index)=>{
    const seen=(state.inspected[state.cursor]||[]).includes(index);
    const b=addButton($('interactions'),(seen?'✓ ':'살펴보기 · ')+item.title,()=>{
      const list=state.inspected[state.cursor]||(state.inspected[state.cursor]=[]);
      if(!list.includes(index))list.push(index);
      persist();renderPage();showInspection(item.title,item.text);
    },seen?'selected':'');
    b.setAttribute('aria-pressed',String(seen));
  });
  if(p.kind==='choice') {
    p.choices.forEach((choice,index)=>{
      const selected=state.choices[state.cursor]===index;
      const b=addButton($('interactions'),choice.label,()=>{
        state.choices[state.cursor]=index;persist();renderPage();
      },selected?'selected':'');
      b.setAttribute('aria-pressed',String(selected));
    });
    const selected=p.choices[state.choices[state.cursor]];
    if(selected) {showInspection('나의 생각',selected.response);}
  }
  if(p.ending&&state.completed) showEnding();
  updateNavigation();renderNotes();
}
function showEnding() {
  $('ending-actions').hidden=false;$('ending-actions').replaceChildren();
  $('ending-actions').append(element('p','END · 아직 이 년'));
  addButton($('ending-actions'),'처음 화면으로',showTitle,'primary');
  addButton($('ending-actions'),'기록 수첩 펼치기',()=>{$('notebook').open=true;$('notebook').scrollIntoView({behavior:'smooth'});});
}
function go(index) {
  if(!Number.isInteger(index)||index<0||index>=PAGES.length)return;
  state.cursor=index;state.furthest=Math.max(state.furthest,index);state.started=true;
  persist();renderPage();$('story').focus();
}
function next() {
  if(!ready())return;
  if(PAGES[state.cursor].ending) {state.completed=true;persist();showEnding();$('ending-actions').scrollIntoView({behavior:'smooth'});}
  else go(state.cursor+1);
}
function restart() {
  if(!confirm('새 이야기의 저장된 진행을 지우고 처음부터 읽을까요?'))return;
  state=fresh();state.started=true;persist();renderPage();
}
function showTitle() {
  $('title-screen').hidden=false;$('game-screen').hidden=true;
  $('title-actions').replaceChildren();
  if(state.started) {
    addButton($('title-actions'),state.completed?'마지막 페이지 다시 보기':'이어서 읽기',()=>go(state.cursor),'primary');
    addButton($('title-actions'),'새로 읽기',restart);
  } else addButton($('title-actions'),'책을 펼친다',()=>go(0),'primary');
}
$('next').onclick=next;
$('previous').onclick=()=>go(state.cursor-1);
$('restart').onclick=restart;
showTitle();persist();
