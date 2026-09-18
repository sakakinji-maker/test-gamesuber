const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../public/unfinished');
function boot(saved,blocked=false,allowConfirm=true){
 const nodes=new Map();
 function el(tag='div'){return {tag,children:[],textContent:'',className:'',hidden:false,disabled:false,dataset:{},attrs:{},
 append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},
 get childElementCount(){return this.children.length},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]??null;},focus(){},scrollIntoView(){}};}
 const storage={value:saved,getItem(key){if(blocked)throw Error('blocked');assert.equal(key,'unfinished_story_v2');return this.value;},setItem(key,value){if(blocked)throw Error('blocked');assert.equal(key,'unfinished_story_v2');this.value=value;}};
 const ctx={document:{getElementById(id){if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);},createElement:el},localStorage:storage,confirm:()=>allowConfirm};
 vm.createContext(ctx);for(const file of ['story.js','visuals.js','game.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 return {nodes,storage,run:s=>vm.runInContext(s,ctx)};
}
for(let variant=0;variant<2;variant++){
 const t=boot(null);assert.equal(t.nodes.get('game-screen').hidden,true);t.run('go(0)');
 const count=t.run('PAGES.length');assert.equal(t.run('STORY.chapters.length'),15);assert.equal(count,174);
 assert.equal(t.nodes.get('notes').children[0].textContent,'아직 남긴 기록이 없습니다.');
 for(let i=0;i<count;i++){
  assert.equal(t.run('state.cursor'),i);
  const kind=t.run('PAGES[state.cursor].kind');
  if(kind==='explore'){
   assert.equal(t.nodes.get('next').disabled,true);t.run('next()');assert.equal(t.run('state.cursor'),i);
   const items=t.run('PAGES[state.cursor].items.length');
   for(let n=0;n<items;n++)t.nodes.get('interactions').children[n].onclick();
   assert.equal(t.nodes.get('next').disabled,false);
   t.nodes.get('interactions').children[0].onclick();assert.equal(t.run('state.inspected[state.cursor].length'),items);
  }
  if(kind==='choice'){
   assert.equal(t.nodes.get('next').disabled,true);
   t.nodes.get('interactions').children[variant].onclick();
   assert.equal(t.nodes.get('next').disabled,false);
   assert.equal(t.run('state.choices[state.cursor]'),variant);
  }
  const restored=boot(t.storage.value);restored.run('go(state.cursor)');
  assert.equal(restored.run('state.cursor'),i);
  assert.equal(restored.run('ready()'),true);
  t.run('next()');
 }
 assert.equal(t.run('state.completed'),true);assert.equal(t.nodes.get('ending-actions').hidden,false);
 const finalNotes=t.nodes.get('notes').childElementCount;assert.ok(finalNotes>20);
 t.run('go(0)');assert.equal(t.nodes.get('notes').childElementCount,finalNotes);
 assert.equal(t.nodes.get('previous').disabled,true);
 t.nodes.get('restart').onclick();assert.equal(t.run('state.furthest'),0);assert.equal(t.run('state.completed'),false);
}
for(const saved of ['{bad',JSON.stringify({version:1}),JSON.stringify({version:2,cursor:9999,furthest:9999}),JSON.stringify({version:2,started:true,completed:false,cursor:0,furthest:0,choices:{'999':'bad'},inspected:{}})]){
 assert.equal(boot(saved).run('state.started'),false);
}
const blocked=boot(null,true);assert.ok(blocked.nodes.get('save-status').textContent.includes('사용할 수 없습니다'));blocked.run('go(0)');blocked.run('next()');assert.equal(blocked.run('state.cursor'),1);
const cancelled=boot(null,false,false);cancelled.run('go(1)');cancelled.nodes.get('restart').onclick();assert.equal(cancelled.run('state.cursor'),1);
const story=require(path.join(root,'story.js'));const all=JSON.stringify(story);
assert.ok(all.includes('프린터'));assert.ok(all.includes('출력했다. 내 작품집에 끼워'));
assert.ok(all.includes('목차의 이유'));assert.ok(all.includes('오늘 날짜를 적고'));
assert.ok(!all.includes('정답에 벌점'));
const art=boot(null);
assert.equal(art.nodes.get('cast-list').childElementCount,5);
art.run("go(PAGES.findIndex(p=>p.speaker==='윤서진'))");
assert.equal(art.nodes.get('active-character').hidden,false);
assert.equal(art.nodes.get('active-character').children[1].textContent,'윤서진');
art.run("go(PAGES.findIndex(p=>p.speaker==='정은재'))");
assert.equal(art.nodes.get('active-character').children[1].textContent,'정은재');
art.run("go(PAGES.findIndex(p=>p.speaker?.startsWith('과거 · ')))");
assert.equal(art.nodes.get('active-character').hidden,true);
assert.equal(art.nodes.get('scene-time').textContent,'회상 · 고등학교 문예부');
for(const name of ['room','cafe','school','archive'])assert.ok(fs.statSync(path.join(root,'assets',name+'-v1.png')).size>1000);
assert.ok(fs.statSync(path.join(root,'assets/cast-atlas-v1.png')).size>1000);
const named=art.run('JSON.stringify(STORY)');
assert.ok(!/태오은|태오을|은재은|은재을/.test(named));
console.log('PASS: full story, saves, all 5 portraits, memory display, named text and 4 background assets.');
