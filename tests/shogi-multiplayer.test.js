const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
// Socket.IO's shipped browser client uses Node's native WebSocket in these tests.
const { io: connect } = require(path.resolve(path.dirname(require.resolve('socket.io')), '../client-dist/socket.io.js'));
const { attachShogi } = require('../shogiMultiplayer');
const E = require('../public/shogi/engine');
const D = require('../public/shogi/strategies-data');
async function until(fn) { for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw new Error('Peer state did not arrive'); }
async function fixture(t) {
  let clock = 1000;
  const server = http.createServer(), io = new Server(server), manager = attachShogi(io,{now:()=>clock,sweepMs:60000});
  const clients=[];
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{clients.forEach(c=>c.socket.disconnect());manager.close();await new Promise(resolve=>io.close(resolve));});
  async function client(namespace='/shogi') {
    const socket=connect(`http://127.0.0.1:${server.address().port}${namespace}`,{transports:['websocket'],reconnection:false,forceNew:true});
    const c={socket,view:null,session:null,rooms:[],replaced:false};clients.push(c);
    socket.on('view',v=>{c.view=v;});socket.on('session',s=>{c.session=s;});socket.on('rooms',r=>{c.rooms=r;});socket.on('replaced',()=>{c.replaced=true;});
    socket.on('left',()=>{c.view=null;c.session=null;});socket.on('roomClosed',()=>{c.view=null;c.session=null;});
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
    c.send=(event,data={})=>new Promise((resolve,reject)=>socket.timeout(2000).emit(event,data,(error,result)=>error?reject(error):resolve(result)));
    c.act=(event,data={})=>c.send(event,{revision:c.view?.revision,...data});
    return c;
  }
  async function pair(){const a=await client(),b=await client();assert.equal((await a.send('create',{name:'선공'})).ok,true);assert.equal((await b.send('join',{code:a.view.code,name:'후공'})).ok,true);await until(()=>a.view.players.length===2);return {a,b};}
  async function start(a,b){assert.equal((await a.act('start')).ok,true);await until(()=>b.view.status==='playing');}
  return {client,pair,start,manager,advance(ms){clock+=ms;manager.sweep();}};
}
test('two clients create, wait, join and start; third seat and guest start are rejected',async t=>{
  const f=await fixture(t),a=await f.client(),b=await f.client(),c=await f.client();
  assert.equal((await a.send('create',{name:''})).ok,false);
  assert.equal((await a.send('create',{name:'방장'})).ok,true);
  assert.equal(a.view.status,'waiting');assert.equal(a.view.you,'player');
  assert.equal((await a.act('start')).ok,false);
  assert.equal((await a.send('create',{name:'다른방'})).ok,false);
  await until(()=>b.rooms.length===1);assert.equal(b.rooms[0].code,a.view.code);
  assert.equal((await b.send('join',{code:a.view.code.toLowerCase(),name:'친구'})).ok,true);
  assert.equal(b.view.you,'opponent');assert.equal((await b.act('start')).ok,false);
  assert.equal((await c.send('join',{code:a.view.code,name:'세번째'})).ok,false);
  await until(()=>a.view.players.length===2);await f.start(a,b);
  assert.deepEqual(a.view.state.board,b.view.state.board);
  assert.equal(JSON.stringify(b.view).includes(a.session.token),false);
  assert.equal(JSON.stringify(c.rooms).includes(a.session.token),false);
});
test('server validates turn, coordinates, king safety and stale/double submissions',async t=>{
  const f=await fixture(t),{a,b}=await f.pair();await f.start(a,b);
  assert.equal((await b.act('move',{move:D.move('33-34')})).ok,false);
  assert.equal((await a.act('move',{move:D.move('27-24')})).ok,false);
  assert.equal((await a.act('move',{move:{from:[6,7],to:[99,7],promote:false}})).ok,false);
  assert.equal((await a.act('move',{move:{drop:'K',to:[4,4]}})).ok,false);
  assert.equal((await a.send('move',null)).ok,false);
  const revision=a.view.revision;
  assert.equal((await a.send('move',{revision,move:D.move('27-26')})).ok,true);
  assert.equal((await a.send('move',{revision,move:D.move('27-26')})).code,'STALE');
  await until(()=>b.view.state.ply===1);
  assert.equal((await b.act('move',{move:D.move('33-34')})).ok,true);
  await until(()=>a.view.state.ply===2);
  assert.equal(a.view.records.length,2);assert.deepEqual(a.view.state,b.view.state);
  // A legal fixture with a checked king verifies server-side self-check rejection.
  const internal=f.manager.rooms.get(a.view.code),s=E.blank();
  s.board[8][4]={type:'K',owner:'player'};s.board[0][0]={type:'K',owner:'opponent'};
  s.board[0][4]={type:'R',owner:'opponent'};s.board[6][8]={type:'P',owner:'player'};
  internal.state=s;
  assert.equal((await a.act('move',{move:D.move('17-16')})).ok,false);
});
test('capture, promotion, hand drop and shared board work over the real socket connection',async t=>{
  const f=await fixture(t),{a,b}=await f.pair();await f.start(a,b);
  const sequence=['57-56','53-54','56-55','61-62','55-54','62-72','54-53','91-92'];
  for(let i=0;i<sequence.length;i++){
    const mover=i%2?b:a,other=i%2?a:b;
    assert.equal((await mover.act('move',{move:{...D.move(sequence[i]),promote:i===6}})).ok,true);
    await until(()=>other.view.state.ply===i+1);
  }
  assert.equal(a.view.state.board[2][4].type,'+P');assert.deepEqual(a.view.state.hands.player,['P']);
  assert.equal((await a.act('move',{move:{drop:'P',to:[4,4]}})).ok,true);
  await until(()=>b.view.state.ply===9);
  assert.equal(b.view.state.board[4][4].type,'P');assert.equal(b.view.state.hands.player.length,0);
});
test('disconnect pauses game; token resumes same seat; old and stolen sessions cannot act',async t=>{
  const f=await fixture(t),{a,b}=await f.pair();await f.start(a,b);
  const session=a.session;a.socket.disconnect();await until(()=>b.view.players.some(p=>!p.connected));
  assert.equal((await b.act('move',{move:D.move('33-34')})).ok,false);
  const attacker=await f.client();assert.equal((await attacker.send('resume',{code:session.code,token:'fake'})).ok,false);
  const restored=await f.client();assert.equal((await restored.send('resume',session)).ok,true);
  await until(()=>b.view.players.every(p=>p.connected));
  assert.equal(restored.view.you,'player');assert.equal(restored.view.state.ply,0);
  assert.equal((await restored.act('move',{move:D.move('27-26')})).ok,true);
  const takeover=await f.client();assert.equal((await takeover.send('resume',session)).ok,true);
  await until(()=>restored.replaced);assert.equal(takeover.view.you,'player');
  assert.equal(takeover.view.players.every(p=>p.connected),true);
});
test('explicit leave and reconnect expiry finish games, while waiting host transfers correctly',async t=>{
  const f=await fixture(t),{a,b}=await f.pair();
  await a.send('leave');await until(()=>b.view.isHost);
  assert.equal(b.view.you,'player');assert.equal(b.view.status,'waiting');
  const c=await f.client();await c.send('join',{code:b.view.code,name:'새친구'});await until(()=>b.view.players.length===2);await f.start(b,c);
  const session=c.session;c.socket.disconnect();await until(()=>b.view.players.some(p=>!p.connected));
  f.advance(90001);await until(()=>b.view.status==='finished');
  assert.deepEqual(b.view.state.result,{winner:'player',reason:'disconnect'});
  const late=await f.client();assert.equal((await late.send('resume',session)).code,'ROOM_GONE');
  await b.send('leave');assert.equal(f.manager.rooms.size,0);
});
test('resignation and mutual rematch reset state, one vote cannot reset the board',async t=>{
  const f=await fixture(t),{a,b}=await f.pair();await f.start(a,b);
  await a.act('resign');await until(()=>b.view.status==='finished');
  assert.equal(b.view.state.result.winner,'opponent');
  assert.equal((await a.act('rematch')).ok,true);await until(()=>b.view.rematchCount===1);
  assert.equal(a.view.status,'finished');
  assert.equal((await b.act('rematch')).ok,true);await until(()=>a.view.status==='playing');
  assert.equal(a.view.state.ply,0);assert.equal(a.view.rematchCount,0);
  await b.send('leave');await until(()=>a.view.status==='finished');
  assert.deepEqual(a.view.state.result,{winner:'player',reason:'leave'});
});
test('waiting room cleanup and namespace isolation preserve the existing game channel',async t=>{
  const f=await fixture(t),a=await f.client(),root=await f.client('/');
  await a.send('create',{name:'대기'});const session=a.session;
  let leaked=false;root.socket.on('view',()=>{leaked=true;});
  f.advance(1800001);await until(()=>a.view===null);
  assert.equal(f.manager.rooms.size,0);assert.equal(leaked,false);
  assert.equal((await a.send('resume',session)).code,'ROOM_GONE');
});
