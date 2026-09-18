'use strict';
// Public profiles deliberately omit all plot reveals.
const CAST = [
 {name:'윤서진',short:'서진',role:'나 · 문예부 글 담당',index:0,description:'27세. 말하기 전에 오래 생각하는 편. 초록색 카디건과 오래된 책이 익숙하다.'},
 {name:'한도윤',short:'도윤',role:'문예부 부장',index:1,description:'27세. 단정한 옷차림, 차분한 말투. 문예부의 일정과 제작을 맡았다.'},
 {name:'이서연',short:'서연',role:'편집 담당',index:2,description:'27세. 짧은 단발과 둥근 안경. 확인되지 않은 일은 서둘러 단정하지 않는다.'},
 {name:'강태오',short:'태오',role:'그림 담당',index:3,description:'27세. 자연스러운 갈색 웨이브와 올리브색 재킷. 그림과 농담으로 모임의 분위기를 이끌었다.'},
 {name:'정은재',short:'은재',role:'문예부 동기',index:4,description:'27세. 어깨에 닿는 머리와 푸른 셔츠. 오랜만에 받은 연락에 짧고 분명하게 답한다.'}
];
const SPEAKER_NAMES = {'나':'윤서진','부장':'한도윤','편집 담당':'이서연','그림 담당':'강태오','당시 지목된 부원':'정은재'};
function namedText(value) {
 if(typeof value!=='string')return value;
 let text=value;
 for(const [role,name] of [['당시 지목된 부원','은재'],['그림 담당','태오']]) {
  for(const [from,to] of [['으로','로'],['이랑','랑'],['은','는'],['이','가'],['을','를'],['과','와']])
   text=text.replaceAll(role+from,name+to);
  text=text.replaceAll(role,name);
 }
 return text.replaceAll('편집 담당','서연').replaceAll('부장','도윤');
}
function applyCastNames(story) {
 if(story.namedCast)return story;
 for(const chapter of story.chapters) {
  chapter.title=namedText(chapter.title);
  if(chapter.place==='내 방')chapter.place='서진의 방';
  else chapter.place=chapter.place.replace('내 방','서진의 방');
  for(const p of chapter.pages) {
   if(p.speaker) {
    const past=p.speaker.startsWith('과거 · ');
    const role=p.speaker.replace('과거 · ','');
    p.speaker=(past?'과거 · ':'')+(SPEAKER_NAMES[role]||role);
   }
   p.text=namedText(p.text);
   if(p.title)p.title=namedText(p.title);
   if(p.note){p.note.title=namedText(p.note.title);p.note.text=namedText(p.note.text);}
   for(const item of p.items||[]){item.title=namedText(item.title);item.text=namedText(item.text);}
   for(const choice of p.choices||[]){choice.label=namedText(choice.label);choice.response=namedText(choice.response);}
  }
 }
 story.namedCast=true;
 return story;
}
function castPortrait(person,cls='cast-portrait') {
 const el=element('div',undefined,cls);
 el.setAttribute('role','img');
 el.setAttribute('aria-label',person.name+'의 현재 모습');
 el.setAttribute('style','background-position:'+((person.index%3)*50)+'% '+(Math.floor(person.index/3)*100)+'%');
 return el;
}
function renderCastList() {
 const list=$('cast-list');list.replaceChildren();
 for(const person of CAST) {
  const card=element('section',undefined,'cast-card');
  const info=element('div');
  info.append(element('h3',person.name),element('small',person.role),element('p',person.description));
  card.append(castPortrait(person),info);list.append(card);
 }
}
function updateVisuals(page,chapter) {
 const past=Boolean(page.speaker?.startsWith('과거 · '));
 const ci=page.chapterIndex;
 const background=ci===6?'cafe':ci===8?'archive':ci===7||ci===9?'school':'room';
 const image=$('scene-image'),source='assets/'+background+'-v1.png';
 if(image.getAttribute('src')!==source) {
  image.onload=()=>{image.hidden=false;};
  image.onerror=()=>{image.hidden=true;};
  image.setAttribute('src',source);
 }
 image.setAttribute('alt',{'room':'해질 무렵 서진의 책상과 책장','cafe':'책과 노트북이 놓인 조용한 카페','school':'오후 햇빛이 비치는 학교 복도','archive':'오래된 회의록이 놓인 학교 자료 열람실'}[background]);
 $('stage').dataset.memory=past?'true':'false';
 if(past)$('scene-time').textContent='회상 · 고등학교 문예부';
 const card=$('active-character');card.replaceChildren();card.hidden=true;
 // Flashbacks use the environment only; adult portraits are not presented as teenagers.
 if(page.kind==='dialogue'&&!past) {
  const person=CAST.find(p=>p.name===page.speaker);
  if(person) {
   card.hidden=false;
   const label=chapter.place.includes('메시지')?'메시지':chapter.place.includes('통화')?'통화 중':'대화';
   card.append(castPortrait(person,'cast-portrait active-portrait'),element('strong',person.name),element('small',person.role+' · '+label));
  }
 }
}
if(typeof module!=='undefined')module.exports={CAST,namedText,applyCastNames};
if(typeof document!=='undefined')applyCastNames(STORY);
