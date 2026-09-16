const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../public/unfinished');
function boot(saved,blocked=false){
  const nodes=new Map();
  function el(){return {children:[],textContent:'',className:'',disabled:false,append(x){this.children.push(x)},replaceChildren(){this.children=[]},get childElementCount(){return this.children.length},focus(){},scrollIntoView(){}};}
  const storage={value:saved,getItem(){if(blocked)throw Error('blocked');return this.value},setItem(k,v){if(blocked)throw Error('blocked');this.value=v}};
  const ctx={document:{getElementById(id){if(!nodes.has(id))nodes.set(id,el());return nodes.get(id)},createElement:el},localStorage:storage,confirm:()=>true};
  vm.createContext(ctx);for(const file of ['story.js','game.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
  return {ctx,nodes,storage,run:s=>vm.runInContext(s,ctx)};
}
for(let reply=0;reply<3;reply++){
 const t=boot(null);t.nodes.get('actions').children[0].onclick();
 for(let chapter=0;chapter<4;chapter++){
  assert.equal(t.nodes.get('actions').children[3].disabled,true);
  for(let i=0;i<3;i++){t.run('readClue('+i+')');t.nodes.get('actions').children[0].onclick();}
  assert.equal(t.nodes.get('actions').children[3].disabled,false);
  t.run('deduce()');
  const answer=t.run('CHAPTERS[state.chapter].answer');
  t.nodes.get('actions').children[(answer+1)%3].onclick();
  assert.ok(t.nodes.get('feedback').textContent.length>0);
  t.nodes.get('actions').children[answer].onclick();
  assert.equal(t.run('state.solved'),true);
  const restored=boot(t.storage.value);
  assert.equal(restored.run('state.chapter'),chapter);
  assert.equal(restored.run('state.solved'),true);
  t.nodes.get('actions').children[3].onclick();
 }
 assert.equal(t.run('state.phase'),'letter');
 t.nodes.get('actions').children[reply].onclick();
 assert.equal(t.run('state.phase'),'ending');
 assert.equal(t.run('state.reply'),reply);
 assert.equal(t.nodes.get('notes').childElementCount,12);
 assert.ok(t.nodes.get('progress').textContent.includes('BAD END'));
 assert.equal(boot(t.storage.value).run('state.phase'),'ending');
}
assert.equal(boot('{bad').run('state.phase'),'title');
assert.equal(boot(JSON.stringify({chapter:999})).run('state.phase'),'title');
const blocked=boot(null,true);assert.ok(blocked.nodes.get('save-status').textContent.includes('사용할 수 없습니다'));
blocked.nodes.get('actions').children[0].onclick();assert.equal(blocked.run('state.phase'),'chapter');
console.log('PASS: 4 chapters, 12 clues, wrong answers, locks, notebook, save/restore, 3 ending choices, corrupt/blocked storage.');
