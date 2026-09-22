const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
// Socket.IO's shipped browser client uses Node's native WebSocket in these tests.
const { io: connect } = require(path.resolve(path.dirname(require.resolve('socket.io')), '../client-dist/socket.io.js'));
const { attachBaduk } = require('../badukMultiplayer');
const E = require('../public/baduk/engine');
async function until(fn) { for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw new Error('Peer state did not arrive'); }
async function fixture(t) {
  let clock = 1000;
  const server = http.createServer(), io = new Server(server), manager = attachBaduk(io,{now:()=>clock,sweepMs:60000});
  const clients=[];
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{clients.forEach(c=>c.socket.disconnect());manager.close();await new Promise(resolve=>io.close(resolve));});
  async function client(namespace='/baduk') {
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
test('Baduk online: server rejects exhausted supply and allows passes to scoring',async t=>{
 const f=await fixture(t),{a,b}=await f.pair();await f.start(a,b);
 const r=f.manager.rooms.get(a.view.code);r.state.captures=[0,40,41];
 assert.equal((await a.act('move',{move:{index:0}})).ok,false);
 await a.act('move',{move:{index:null}});await until(()=>b.view.state.ply===1);
 assert.equal((await b.act('move',{move:{index:1}})).ok,false);
 await b.act('move',{move:{index:null}});await until(()=>a.view.state.phase==='scoring');
 assert.equal((await a.act('continue')).ok,false);
 await a.act('accept');await until(()=>b.view.scoreReady.length===1);await b.act('accept');await until(()=>a.view.status==='finished');
});
test('Baduk online: waiting room, authority, stale requests and private tokens',async t=>{
 const f=await fixture(t),a=await f.client(),b=await f.client(),c=await f.client();
 assert.equal((await a.send('create',{name:'흑',size:13})).ok,true);assert.equal(a.view.size,13);
 assert.equal((await a.act('start')).ok,false);
 await b.send('join',{name:'백',code:a.view.code});await until(()=>a.view.players.length===2);
 assert.equal((await c.send('join',{name:'초과',code:a.view.code})).ok,false);
 assert.equal((await b.act('start')).ok,false);await f.start(a,b);
 assert.equal(a.view.state.board.length,169);assert.equal(a.view.you,1);assert.equal(b.view.you,2);
 assert.equal(JSON.stringify(b.view).includes(a.session.token),false);
 assert.equal((await b.act('move',{move:{index:0}})).ok,false);
 assert.equal((await a.act('move',{move:{index:-1}})).ok,false);
 const revision=a.view.revision;assert.equal((await a.send('move',{revision,move:{index:0}})).ok,true);
 assert.equal((await a.send('move',{revision,move:{index:1}})).code,'STALE');
 await until(()=>b.view.state.ply===1);assert.equal((await b.act('move',{move:{index:0}})).ok,false);
 await b.act('move',{move:{index:1}});await until(()=>a.view.state.ply===2);
 assert.deepEqual(a.view.state,b.view.state);
});
test('Baduk online: passes, dead stones invalidate approval, both agree, rematch',async t=>{
 const f=await fixture(t),{a,b}=await f.pair();await f.start(a,b);
 await a.act('move',{move:{index:0}});await until(()=>b.view.state.ply===1);
 await b.act('move',{move:{index:null}});await until(()=>a.view.state.ply===2);
 await a.act('move',{move:{index:null}});await until(()=>b.view.state.phase==='scoring');
 assert.equal((await b.act('move',{move:{index:1}})).ok,false);
 await a.act('accept');await until(()=>b.view.scoreReady.length===1);assert.equal(a.view.status,'playing');
 await b.act('dead',{index:0});await until(()=>a.view.state.dead.length===1);
 assert.equal(a.view.scoreReady.length,0);
 await a.act('accept');await until(()=>b.view.scoreReady.length===1);
 await b.act('accept');await until(()=>a.view.status==='finished');assert.equal(a.view.state.result.winner,2);
 await a.act('rematch');await until(()=>b.view.rematchCount===1);assert.equal(a.view.status,'finished');
 await b.act('rematch');await until(()=>a.view.status==='playing');assert.equal(a.view.state.ply,0);
});
test('Baduk online: resume scoring, disconnect pauses, token returns, expiry forfeits',async t=>{
 const f=await fixture(t),{a,b}=await f.pair();await f.start(a,b);
 await a.act('move',{move:{index:null}});await until(()=>b.view.state.ply===1);await b.act('move',{move:{index:null}});
 await until(()=>a.view.state.phase==='scoring');await a.act('continue');await until(()=>b.view.state.phase==='play');
 const saved=b.session;b.socket.disconnect();await until(()=>!a.view.players[1].connected);
 assert.equal((await a.act('move',{move:{index:0}})).ok,false);
 const thief=await f.client();assert.equal((await thief.send('resume',{code:saved.code,token:'invalid'})).ok,false);
 const back=await f.client();await back.send('resume',saved);await until(()=>a.view.players[1].connected);
 assert.equal(back.view.you,2);await a.act('move',{move:{index:0}});await until(()=>back.view.state.ply===3);
 back.socket.disconnect();await until(()=>!a.view.players[1].connected);f.advance(90001);await until(()=>a.view.status==='finished');
 assert.equal(a.view.state.result.winner,1);
});
test('Baduk online: server enforces suicide and ko; leave and lobby expiry',async t=>{
 const f=await fixture(t),{a,b}=await f.pair();await f.start(a,b);
 const r=f.manager.rooms.get(a.view.code),s=E.initialState(9);
 [4,12,14].forEach(i=>s.board[i]=1);[13,21,23,31].forEach(i=>s.board[i]=2);s.history=[E.key(s.board)];r.state=s;
 await a.act('move',{move:{index:22}});await until(()=>b.view.state.ply===1);
 assert.equal(b.view.state.captures[1],1);assert.equal((await b.act('move',{move:{index:13}})).ok,false);
 await b.send('leave');await until(()=>a.view.status==='finished');assert.equal(a.view.state.result.winner,1);
 const c=await f.client();await c.send('create',{name:'대기'});const code=c.view.code;f.advance(1800001);assert.equal(f.manager.rooms.has(code),false);
});
