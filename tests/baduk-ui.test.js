// DOM simulation complements (does not replace) real browser checks.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('../public/baduk/engine'),L=require('../public/baduk/lessons');
const html=fs.readFileSync(path.join(__dirname,'../public/baduk/index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../public/baduk/game.js'),'utf8');
function boot(saved,{blocked=false,workerFails=false}={}){
 const nodes=new Map(),storage=new Map(),timers=new Map(),workers=[];let id=0,confirmation=true;
 if(saved)storage.set('baduk_practice_v1',JSON.stringify(saved));
 class El{
 constructor(){this.children=[];this.dataset={};this.style={setProperty(){}};this.className='';this.attributes={};this.textContent='';this.listeners={};this.value='';this.classList={toggle:(name,on)=>{this.className=this.className.split(' ').filter(s=>s!==name).join(' ')+(on?' '+name:'');}};}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(e,f){this.listeners[e]=f;}focus(){document.activeElement=this;}
 click(){if(!this.disabled){this.onclick?.();this.listeners.click?.();}}
 }
 for(const [,key] of html.matchAll(/\bid="([^"]+)"/g))nodes.set(key,new El());
 const modes=['learn','practice','online'].map(m=>{const e=new El();e.dataset.mode=m;return e;});
 const document={activeElement:null,getElementById:key=>nodes.get(key),createElement:()=>new El(),createTextNode:t=>({textContent:t}),querySelectorAll:()=>modes};
 const store={getItem:k=>{if(blocked)throw Error('blocked');return storage.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)};
 class Worker{constructor(){if(workerFails)throw Error('worker');workers.push(this);}postMessage(d){this.data=d;}terminate(){this.terminated=true;}respond(index=E.suggest(this.data.state,this.data.level,()=>.5)){this.onmessage({data:{id:this.data.id,index}});}}
 vm.runInNewContext(script,{Baduk:E,BadukLessons:L,document,window:{},localStorage:store,sessionStorage:store,Worker,URLSearchParams,location:{origin:'http://localhost',search:''},confirm:()=>confirmation,setTimeout:(f,ms)=>{timers.set(++id,{f,ms});return id;},clearTimeout:i=>timers.delete(i)});
 const $=key=>nodes.get(key),click=i=>$('board').children[i].click(),snapshot=()=>JSON.parse(storage.get('baduk_practice_v1'));
 function flush(){for(const [key,t]of [...timers])if(t.ms<1000){timers.delete(key);t.f();}}
 return {$,click,workers,storage,snapshot,modes,flush,setConfirm(v){confirmation=v;}};
}
test('Baduk UI: all lessons complete, wrong move does not complete, hints and replay',()=>{
 const u=boot();u.click(0);assert.equal(u.$('next').disabled,true);
 for(let i=0;i<L.length;i++){u.$('hint').click();if(L[i].answer===null)u.$('pass').click();else u.click(L[i].answer);assert.equal(u.$('next').disabled,false);if(i<11)u.$('next').click();}
 assert.equal(u.$('progress').textContent,'12 / 12 완료');u.$('next').click();assert.equal(u.$('board').children.length,81);
});
test('Baduk UI: practice AI moves and save replay; undo cancels stale worker',()=>{
 const u=boot();u.modes[1].click();u.click(20);const old=u.workers.at(-1);assert.equal(u.snapshot().moves.length,1);
 u.$('undo').click();old.respond();u.flush();assert.equal(u.snapshot().moves.length,0);
 u.click(20);u.workers.at(-1).respond();u.flush();assert.equal(u.snapshot().moves.length,2);
 const restored=boot(u.snapshot());restored.modes[1].click();assert.equal(restored.$('ply').textContent,'2수');
 restored.$('undo').click();assert.equal(restored.snapshot().moves.length,0);
});
test('Baduk UI: hints do not commit, restart cancellation preserves state, board sizes and white start',()=>{
 const u=boot();u.modes[1].click();u.$('hint').click();u.workers.at(-1).respond(40);u.flush();assert.ok(u.$('board').children[40].className.includes('hint'));
 u.click(20);u.setConfirm(false);u.$('new').click();assert.equal(u.snapshot().moves.length,1);
 u.setConfirm(true);u.$('size').value='19';u.$('color').value='2';u.$('level').value='3';u.$('new').click();assert.equal(u.$('board').children.length,361);assert.equal(u.snapshot().human,2);
 u.workers.at(-1).respond(60);u.flush();assert.equal(u.snapshot().moves.length,1);assert.equal(u.$('pass').disabled,false);
});
test('Baduk UI: passes, scoring selection, continue, finish and reload',()=>{
 const u=boot();u.modes[1].click();u.$('pass').click();u.workers.at(-1).respond(null);u.flush();assert.equal(u.$('scoring').hidden,false);
 u.$('resume-play').click();assert.equal(u.$('scoring').hidden,true);
 u.$('pass').click();u.workers.at(-1).respond(null);u.flush();u.$('accept').click();assert.match(u.$('title').textContent,/백 승리/);
 assert.equal(E.restore(u.snapshot()).result.winner,2);
});
test('Baduk UI: storage and worker failures remain usable; corrupted save handled',()=>{
 const u=boot(null,{blocked:true,workerFails:true});u.modes[1].click();u.click(20);assert.equal(u.$('hint').disabled,false);assert.match(u.$('feedback').textContent,/계산/);assert.match(u.$('save-status').textContent,/저장할 수 없습니다/);
 const v=boot({version:1,size:9,moves:[{type:'play',index:999}]});v.modes[1].click();assert.equal(v.$('ply').textContent,'0수');
});

