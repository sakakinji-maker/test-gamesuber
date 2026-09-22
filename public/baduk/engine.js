/* Learning rules: area scoring, positional superko, no suicide, white komi 6.5. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Baduk=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const other=c=>3-c, key=b=>b.join(''), coord=(i,n)=>'ABCDEFGHJKLMNOPQRST'[i%n]+(n-Math.floor(i/n));
function initialState(size=9){if(![5,9,13,19].includes(size))throw Error('잘못된 판 크기입니다.');const board=Array(size*size).fill(0);return {size,board,turn:1,ply:0,passes:0,captures:[0,0,0],history:[key(board)],phase:'play',dead:[],result:null,lastMove:null};}
function neighbors(i,n){const a=[];if(i>=n)a.push(i-n);if(i<n*(n-1))a.push(i+n);if(i%n)a.push(i-1);if(i%n<n-1)a.push(i+1);return a;}
function group(board,i,n){const stones=[],liberties=new Set(),seen=new Set([i]),todo=[i],color=board[i];if(!color)return {stones,liberties};while(todo.length){const p=todo.pop();stones.push(p);for(const q of neighbors(p,n)){if(!board[q])liberties.add(q);else if(board[q]===color&&!seen.has(q)){seen.add(q);todo.push(q);}}}return {stones,liberties};}
function play(s,index){
 if(s.phase!=='play'||s.result)throw Error('착수할 수 있는 단계가 아닙니다.');
 if(index===null){return {...s,turn:other(s.turn),ply:s.ply+1,passes:s.passes+1,phase:s.passes===1?'scoring':'play',dead:[],lastMove:null};}
 if(!Number.isInteger(index)||index<0||index>=s.board.length)throw Error('교차점을 선택하세요.');
 if(s.board[index])throw Error('이미 돌이 놓인 자리입니다.');
 const board=s.board.slice(),captures=s.captures.slice();board[index]=s.turn;let count=0;const seen=new Set();
 for(const p of neighbors(index,s.size)){if(board[p]!==other(s.turn)||seen.has(p))continue;const g=group(board,p,s.size);g.stones.forEach(q=>seen.add(q));if(!g.liberties.size){count+=g.stones.length;g.stones.forEach(q=>board[q]=0);}}
 if(!group(board,index,s.size).liberties.size)throw Error('활로가 없는 자충수는 둘 수 없습니다.');
 const hash=key(board);if(s.history.includes(hash))throw Error('패·반복 금지: 이전과 같은 판을 만들 수 없습니다.');
 captures[s.turn]+=count;return {...s,board,captures,turn:other(s.turn),ply:s.ply+1,passes:0,history:[...s.history,hash],lastMove:index};
}
function toggleDead(s,i){if(s.phase!=='scoring'||s.result||!Number.isInteger(i)||!s.board[i])throw Error('계가 중인 돌을 선택하세요.');const dead=new Set(s.dead),g=group(s.board,i,s.size);if(dead.has(i))g.stones.forEach(p=>dead.delete(p));else g.stones.forEach(p=>dead.add(p));return {...s,dead:[...dead].sort((a,b)=>a-b)};}
function resume(s){if(s.phase!=='scoring'||s.result)throw Error('대국을 재개할 수 없습니다.');return {...s,phase:'play',dead:[],passes:0};}
function score(s){
 const b=s.board.slice();s.dead.forEach(i=>b[i]=0);
 const stones=[0,0,0],territory=[0,0,0],owners=Array(b.length).fill(0),seen=new Set();
 b.forEach(c=>stones[c]++);
 for(let i=0;i<b.length;i++){if(b[i]||seen.has(i))continue;const region=[],border=new Set(),todo=[i];seen.add(i);while(todo.length){const p=todo.pop();region.push(p);for(const q of neighbors(p,s.size)){if(b[q])border.add(b[q]);else if(!seen.has(q)){seen.add(q);todo.push(q);}}}if(border.size===1){const color=[...border][0];territory[color]+=region.length;region.forEach(p=>owners[p]=color);}}
 const black=stones[1]+territory[1],white=stones[2]+territory[2]+6.5;
 return {black,white,stones,territory,owners,komi:6.5,winner:black>white?1:2,margin:Math.abs(black-white)};
}
function finish(s){if(s.phase!=='scoring'||s.result)throw Error('먼저 두 사람이 연속으로 패스해야 합니다.');const total=score(s);return {...s,phase:'finished',result:{...total,reason:'score'}};}
function resign(s,color=s.turn){if(s.result||![1,2].includes(color))throw Error('종료된 대국입니다.');return {...s,phase:'finished',result:{winner:other(color),reason:'resign'}};}
function isEye(s,i){const ns=neighbors(i,s.size);if(!ns.every(p=>s.board[p]===s.turn))return false;const r=Math.floor(i/s.size),c=i%s.size;let bad=0,total=0;for(const dr of [-1,1])for(const dc of [-1,1])if(r+dr>=0&&r+dr<s.size&&c+dc>=0&&c+dc<s.size){total++;if(s.board[(r+dr)*s.size+c+dc]!==s.turn)bad++;}return total===4?bad<=1:bad===0;}
/* Heuristic opponent, not a professional-strength Go engine. */
function suggest(s,level=2,rng=Math.random){
 if(s.phase!=='play'||s.result)return null;const candidates=[];
 for(let i=0;i<s.board.length;i++){if(s.board[i]||isEye(s,i))continue;let next;try{next=play(s,i);}catch{continue;}
 const g=group(next.board,i,s.size),captured=next.captures[s.turn]-s.captures[s.turn];
 const r=Math.floor(i/s.size),c=i%s.size,edge=Math.min(r,c,s.size-1-r,s.size-1-c);
 let value=rng()*(level===0?30:level===1?8:2)+Math.min(edge,3)*0.6;
 value+=captured*(level===0?2:18);if(g.liberties.size===1)value-=level===0?2:22;else value+=Math.min(g.liberties.size,5)*0.8;
 for(const p of neighbors(i,s.size)){if(s.board[p]===s.turn&&group(s.board,p,s.size).liberties.size===1)value+=12;
 if(next.board[p]===other(s.turn)){const enemy=group(next.board,p,s.size);if(enemy.liberties.size===1)value+=level>=2?7:2;}}
 if(neighbors(i,s.size).every(p=>s.board[p]===s.turn))value-=15;
 if(level>=3&&g.liberties.size===1){try{const reply=play(next,[...g.liberties][0]);value-=(reply.captures[other(s.turn)]-next.captures[other(s.turn)])*10;}catch{}}
 candidates.push({i,value});
 }
 candidates.sort((a,b)=>b.value-a.value);
 // Let a learner finish a settled board, but still take urgent captures.
 if(s.passes&&(!candidates.length||candidates[0].value<15))return null;
 return candidates.length?candidates[0].i:null;
}
function restore(data){
 if(!data||data.version!==1||![9,13,19].includes(data.size)||!Array.isArray(data.moves)||data.moves.length>4000)throw Error('저장 형식이 올바르지 않습니다.');
 let s=initialState(data.size);
 for(const action of data.moves){
 if(!action||typeof action!=='object')throw Error('손상된 기보입니다.');
 if(action.type==='play')s=play(s,action.index);
 else if(action.type==='dead')s=toggleDead(s,action.index);
 else if(action.type==='resume')s=resume(s);
 else if(action.type==='finish')s=finish(s);
 else if(action.type==='resign')s=resign(s,action.color);
 else throw Error('손상된 기보입니다.');
 }
 return s;
}
return {initialState,other,key,coord,neighbors,group,play,toggleDead,resume,score,finish,resign,suggest,restore};
});

