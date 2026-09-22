
(function(root){'use strict';
const L=[
 {title:'교차점에 놓기',group:'왕초보',text:'돌은 네모 칸이 아닌 선과 선의 교차점에 놓습니다. 흑이 먼저 시작합니다.',black:[],white:[],answer:12,mission:'작은 5줄판의 한가운데 C3에 흑돌을 놓으세요.',success:'첫 한 수예요! 한 번 놓은 돌은 움직이지 않습니다.'},
 {title:'활로 하나 막기',group:'왕초보',text:'활로는 돌의 상하좌우에 붙은 빈자리입니다. 대각선은 활로가 아닙니다.',black:[7,11],white:[12],answer:13,mission:'C3 백돌의 오른쪽 D3에 두어 활로를 줄이세요.',success:'백돌은 이제 아래쪽 C2 한 곳에만 활로가 남았습니다.'},
 {title:'돌 하나 잡기',group:'왕초보',text:'상대 돌의 마지막 활로를 막으면 판에서 들어냅니다.',black:[7,11,13],white:[12],answer:17,mission:'C2에 두어 가운데 백돌을 잡으세요.',success:'백돌의 활로가 0개가 되어 잡혔어요.'},
 {title:'연결해서 지키기',group:'초보',text:'같은 색 돌은 상하좌우로 이어지면 한 무리가 됩니다. 대각선으로만 닿으면 연결이 아닙니다.',black:[11,13],white:[],answer:12,mission:'C3에 두어 두 흑돌을 하나로 연결하세요.',success:'세 돌이 활로를 공유하는 한 무리가 되었습니다.'},
 {title:'단수에서 탈출',group:'초보',text:'내 돌의 활로가 하나뿐이면 단수입니다. 열린 방향으로 뻗어 활로를 늘려 보세요.',black:[12],white:[7,11,13],answer:17,mission:'C2로 뻗어 흑돌을 구하세요.',success:'연결된 흑돌에 새 활로가 생겼습니다.'},
 {title:'모서리에서 잡기',group:'초보',text:'모서리 돌의 활로는 처음부터 두 개뿐입니다. 판 가장자리도 활용해 보세요.',black:[1],white:[0],answer:5,mission:'A4에 두어 모서리 A5의 백돌을 잡으세요.',success:'모서리는 두 방향만 막아도 돌을 잡을 수 있습니다.'},
 {title:'한 무리 잡기',group:'중급',text:'이어진 돌은 활로를 공유합니다. 마지막 활로를 막으면 전부 함께 잡힙니다.',black:[6,7,10,13,16],white:[11,12],answer:17,mission:'C2에 두어 백돌 두 개를 한 번에 잡으세요.',success:'백돌 두 개가 한 무리여서 함께 잡혔습니다.'},
 {title:'상대를 잡으며 들어가기',group:'중급',text:'겉보기에는 막힌 자리여도 상대를 잡아 새 활로가 생기면 둘 수 있습니다.',black:[2,6,8],white:[7,11,13,17],answer:12,mission:'C3에 두세요. 위의 백돌을 잡아 활로를 만듭니다.',success:'상대를 먼저 잡고 내 활로를 검사합니다. 자충수가 아니에요.'},
 {title:'끊긴 돌 이어주기',group:'중급',text:'상대에게 끊기기 전에 내 돌을 연결하면 서로를 도울 수 있습니다.',black:[6,8],white:[1,11,13],answer:7,mission:'C4에 두어 왼쪽과 오른쪽 흑돌을 연결하세요.',success:'두 흑돌이 한 무리로 연결되었습니다.'},
 {title:'끊어서 압박하기',group:'응용',text:'상대가 아직 연결하지 못한 빈자리에 두면 두 무리를 분리할 수 있습니다.',black:[2,12],white:[6,8],answer:7,mission:'C4에 흑돌을 놓아 두 백돌 사이를 끊으세요.',success:'두 백돌은 연결되지 않았고 따로 활로를 확보해야 합니다.'},
 {title:'두 집의 모양',group:'응용',text:'한 무리 안에 독립된 두 눈이 있으면 상대는 한 수로 활로를 모두 없앨 수 없습니다.',black:[0,1,2,3,4,5,9,10,11,12,13,14],white:[],answer:7,mission:'C4에 두어 내부 빈 공간을 두 눈으로 나누세요.',success:'B4와 D4가 독립된 두 눈입니다. 이 흑돌 무리는 안전합니다.'},
 {title:'패스도 한 수',group:'응용',text:'더 둘 곳이 없다고 판단하면 패스합니다. 두 사람이 연속으로 패스하면 계가를 확인합니다.',black:[],white:[],answer:null,mission:'아래의 패스 버튼을 눌러 보세요. 실제 대국에서는 충분히 집을 만든 뒤 사용하세요.',success:'패스를 익혔어요! 이제 컴퓨터 연습에서 한 판을 두어 보세요.'}
];
if(typeof module==='object'&&module.exports)module.exports=L;else root.BadukLessons=L;
})(typeof globalThis!=='undefined'?globalThis:this);

