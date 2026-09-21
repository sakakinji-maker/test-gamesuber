// Tests controller events and board orientation; this is not a browser-rendering test.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const E=require('../public/shogi/engine');
const html=fs.readFileSync(require.resolve('../public/shogi/multiplayer.html'),'utf8');
const controller=fs.readFileSync(require.resolve('../public/shogi/multiplayer.js'),'utf8');
function boot({saved=null,storageFailure=false}={}) {
  const nodes=new Map(),storage=new Map(saved?[['shogi_online_session_v1',JSON.stringify(saved)]]:[]);
  class Element{
    constructor(){this.children=[];this.listeners={};this.dataset={};this.attributes={};this.className='';this.value='';this.textContent='';this.disabled=false;this.open=false;this.hidden=false;this.classList={add:x=>{this.className+=' '+x;}};}
    append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}
    replaceChildren(...items){this.children=[];this.append(...items);}
    setAttribute(k,v){this.attributes[k]=String(v);}
    addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}
    emit(k,e={}){for(const fn of this.listeners[k]||[])fn(e);}
    click(){if(!this.disabled)this.emit('click');}
    focus(){document.activeElement=this;}
    select(){this.selected=true;}
    showModal(){this.open=true;}
    close(value){this.returnValue=value;this.open=false;this.emit('close');}
    querySelector(selector){const p=selector.match(/data-row="(-?\d+)"\]\[data-col="(-?\d+)"/);return p?this.children.find(e=>String(e.dataset.row)===p[1]&&String(e.dataset.col)===p[2]):null;}
  }
  for(const [,id]of html.matchAll(/\bid="([^"]+)"/g))nodes.set(id,new Element());
  const document={activeElement:null,getElementById:id=>nodes.get(id),createElement:()=>new Element()};
  const socket={listeners:{},sent:[],on(k,fn){this.listeners[k]=fn;},timeout(){return this;},emit(event,data,ack){this.sent.push({event,data,ack});if(event==='list')ack(null,{ok:true});},receive(k,data){this.listeners[k]?.(data);},connect(){this.receive('connect');},disconnect(){this.receive('disconnect');}};
  const window={Shogi:E,io:()=>socket,location:{search:'?room=ABC234',origin:'https://example.test',pathname:'/shogi/multiplayer.html'}};
  vm.runInNewContext(controller,{window,document,URLSearchParams,navigator:{clipboard:{async writeText(text){socket.copied=text;}}},
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(storageFailure)throw new Error('blocked');storage.set(k,v);},removeItem:k=>storage.delete(k)}});
  const $=id=>nodes.get(id),square=([r,c])=>$('online-board').children.find(b=>b.dataset.row===r&&b.dataset.col===c);
  const last=()=>socket.sent.at(-1);
  return {$,square,socket,last,storage,active:()=>document.activeElement};
}
function view(you='player',state=E.initialState()){
  return {code:'ABC234',status:'playing',revision:4,you,isHost:you==='player',players:[{name:'선공',owner:'player',connected:true},{name:'후공',owner:'opponent',connected:true}],state,records:[],rematchReady:false,rematchCount:0};
}
test('waiting room controls require both seats and host; invitation contains no session secret',async()=>{
  const ui=boot();ui.$('nickname').value='우리';ui.$('create-room').click();
  assert.equal(ui.last().event,'create');assert.equal(ui.last().data.name,'우리');
  ui.socket.receive('session',{code:'ABC234',token:'private-token',name:'우리'});
  const waiting={...view(),status:'waiting',state:null,players:view().players.slice(0,1)};
  ui.socket.receive('view',waiting);ui.last().ack(null,{ok:true});
  assert.equal(ui.$('start-match').disabled,true);
  assert.equal(ui.$('waiting-panel').hidden,false);
  assert.equal(ui.$('invite-link').value,'https://example.test/shogi/multiplayer.html?room=ABC234');
  ui.$('copy-link').click();await Promise.resolve();assert.ok(!ui.socket.copied.includes('private-token'));
  ui.socket.receive('view',{...waiting,players:view().players});ui.$('start-match').click();
  assert.equal(ui.last().event,'start');assert.equal(ui.last().data.revision,4);
  ui.last().ack(null,{ok:true});ui.socket.receive('view',{...waiting,players:view().players,you:'opponent',isHost:false});
  assert.equal(ui.$('start-match').disabled,true);
});
test('both seats see their own army below and send correct unrotated coordinates',()=>{
  for(const owner of ['player','opponent']){
    const ui=boot(),s=E.initialState();s.turn=owner;ui.socket.receive('view',view(owner,s));
    const from=owner==='player'?[6,7]:[2,1],to=owner==='player'?[5,7]:[3,1];
    assert.equal(ui.$('online-board').children[0].dataset.row,owner==='player'?0:8);
    assert.equal(ui.$('online-board').children[80].children[0].className.includes('player'),true);
    ui.square(from).click();assert.ok(ui.square(to).className.includes('legal'));
    ui.square(to).click();assert.equal(ui.last().event,'move');
    assert.deepEqual(JSON.parse(JSON.stringify(ui.last().data.move)),{from,to,promote:false});
    const count=ui.socket.sent.length;ui.square(from).click();ui.square(to).click();assert.equal(ui.socket.sent.length,count);
  }
});
test('opponent turn and disconnection block moves; keyboard navigation follows flipped board',()=>{
  const ui=boot();ui.socket.receive('view',view('opponent'));
  const count=ui.socket.sent.length;ui.square([2,1]).click();ui.square([3,1]).click();assert.equal(ui.socket.sent.length,count);
  ui.square([2,1]).focus();ui.square([2,1]).emit('keydown',{key:'ArrowUp',preventDefault(){}});assert.equal(ui.active(),ui.square([3,1]));
  const s=E.initialState();s.turn='opponent';const v=view('opponent',s);v.players[0].connected=false;ui.socket.receive('view',v);
  ui.square([2,1]).click();ui.square([3,1]).click();assert.equal(ui.socket.sent.length,count);
  ui.socket.receive('disconnect');assert.equal(ui.$('create-room').disabled,true);
});
test('promotion choices, cancellation and captured piece drop use server moves',()=>{
  const s=E.blank();s.board[8][8]={type:'K',owner:'player'};s.board[0][8]={type:'K',owner:'opponent'};s.board[3][4]={type:'P',owner:'player'};s.hands.player=['G'];
  for(const answer of ['yes','no']){
    const ui=boot();ui.socket.receive('view',view('player',s));ui.square([3,4]).click();ui.square([2,4]).click();
    assert.equal(ui.$('multi-promotion').open,true);ui.$('multi-promotion').close('cancel');assert.equal(ui.last().event,'list');
    ui.square([2,4]).click();ui.$('multi-promotion').close(answer);assert.equal(ui.last().data.move.promote,answer==='yes');
  }
  const ui=boot();ui.socket.receive('view',view('player',s));ui.$('online-my-hand').children[0].click();ui.square([4,4]).click();
  assert.equal(ui.last().data.move.drop,'G');
});
test('expired resume clears stale credentials; disconnect during promotion never sends a move',()=>{
  const ui=boot({saved:{code:'ABC234',token:'old'}});assert.equal(ui.last().event,'resume');
  ui.last().ack(null,{ok:false,error:'expired',code:'ROOM_GONE'});assert.equal(ui.storage.size,0);
  const s=E.blank();s.board[8][8]={type:'K',owner:'player'};s.board[0][8]={type:'K',owner:'opponent'};s.board[3][4]={type:'P',owner:'player'};
  ui.socket.receive('view',view('player',s));ui.square([3,4]).click();ui.square([2,4]).click();ui.socket.receive('disconnect');
  assert.equal(ui.$('multi-promotion').open,false);assert.equal(ui.socket.sent.some(r=>r.event==='move'),false);
});
test('lost acknowledgement syncs state instead of resending a move, and session replacement stops this tab',()=>{
  const ui=boot({storageFailure:true});ui.socket.receive('session',{code:'ABC234',token:'private'});ui.socket.receive('view',view());
  ui.square([6,7]).click();ui.square([5,7]).click();ui.last().ack(new Error('timeout'));
  assert.equal(ui.last().event,'sync');assert.equal(ui.socket.sent.filter(r=>r.event==='move').length,1);
  ui.last().ack(null,{ok:true,inRoom:true});ui.socket.receive('replaced');
  assert.match(ui.$('connection-status').textContent,/다른 탭/);assert.equal(ui.$('room-panel').hidden,true);
});
