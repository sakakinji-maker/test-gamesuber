// Generated illustration atlas. Cell order is explicit; species array order may change.
const ART_IDS = ['nutria','bullfrog','sicyos','lanternfly','fireant_red','hornet_yl',
  'planthopper_us','brownwing_bug','planthopper_brown','crazyant_long','locust_pectin','ant_argentine',
  'fireant_tropical','crazyant_tropical','turtle_redear','turtle_river_cooter','turtle_chinese_stripe','turtle_alligator_snapper',
  'turtle_florida_redbelly','turtle_snapping','crayfish_us','bluegill','bass_largemouth','trout_brown'];
const gameAtlas = new Image();
let atlasReady = false;
function paintArt(ctx, index, x, y, size) {
  const cell = gameAtlas.naturalWidth / 6;
  ctx.drawImage(gameAtlas, (index % 6) * cell, Math.floor(index / 6) * cell,
    cell, cell, x, y, size, size);
}
function artCanvas(index, label, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:8px;vertical-align:middle;max-width:100%';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  paintArt(canvas.getContext('2d'), index, 0, 0, size);
  return canvas;
}
function setSpeciesArt(element, species) {
  const index = ART_IDS.indexOf(species.id);
  if (!atlasReady || index < 0) { element.textContent = species.icon; return; }
  element.replaceChildren(artCanvas(index, species.name));
}
function renderArtField() {
  if (!atlasReady) return false;
  const rows = currentMap().rows;
  const ctx = fctx;
  ctx.lineWidth = 1;
  rows.forEach((row, y) => [...row].forEach((tile, x) => {
    const px = x*TILE, py = y*TILE;
    ctx.fillStyle = tile === '~' ? '#40869c' : tile === '#' ? '#294f40'
      : tile === ',' ? '#62884a' : tile === 'r' ? '#aba681' : '#d4c39b';
    ctx.fillRect(px,py,TILE,TILE);
    if (tile === '#') {
      ctx.fillStyle = '#38644b';
      ctx.beginPath(); ctx.arc(px+24,py+24,21,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#497654';
      ctx.beginPath(); ctx.arc(px+19,py+17,12,0,Math.PI*2); ctx.fill();
    } else if (tile === ',') {
      ctx.strokeStyle = '#365d35'; ctx.lineWidth = 2;
      for (let k=0;k<4;k++) {
        const gx=px+9+(k%2)*24, gy=py+18+Math.floor(k/2)*23;
        ctx.beginPath(); ctx.moveTo(gx-4,gy-6); ctx.lineTo(gx,gy); ctx.lineTo(gx+4,gy-8); ctx.stroke();
      }
    } else if (tile === '~') {
      ctx.strokeStyle = '#8ec4cb'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px+7,py+17); ctx.quadraticCurveTo(px+18,py+22,px+30,py+17); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px+22,py+35); ctx.lineTo(px+39,py+35); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(85,69,41,0.14)';
      ctx.fillRect(px+12,py+17,2,2); ctx.fillRect(px+35,py+34,2,2);
    }
    if (currentMap().exits?.[tile]) {
      ctx.fillStyle = '#377568'; ctx.fillRect(px+3,py+3,42,42);
      ctx.fillStyle = '#fff7db'; ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(y === 0 ? '↑' : '↓',px+24,py+24);
    }
  }));
  // Render each contiguous rectangular house footprint only once.
  rows.forEach((row,y) => [...row].forEach((tile,x) => {
    if (tile !== 'H' || row[x-1] === 'H' || rows[y-1]?.[x] === 'H') return;
    let w=1,h=1;
    while(row[x+w] === 'H') w++;
    while(rows[y+h]?.[x] === 'H') h++;
    const px=x*TILE,py=y*TILE,width=w*TILE,height=h*TILE;
    ctx.fillStyle='#695c4c'; ctx.fillRect(px+5,py+height-9,width-6,9);
    ctx.fillStyle='#efdfb8'; ctx.fillRect(px+7,py+25,width-14,height-32);
    ctx.fillStyle='#455465'; ctx.beginPath(); ctx.moveTo(px+2,py+34);
    ctx.lineTo(px+width/2,py+4); ctx.lineTo(px+width-2,py+34); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#77573e'; ctx.fillRect(px+width/2-9,py+height-34,18,27);
    ctx.fillStyle='#83b4bb'; ctx.fillRect(px+16,py+43,14,14);
  }));
  for (const npc of visibleNpcs()) {
    const index = {elder:25,shopkeeper:26,fisher_spot:27}[npc.id];
    if (index !== undefined) drawMapPortrait(index,npc.gx,npc.gy,'#ffffff');
  }
  drawMapPortrait(24,player.gx,player.gy,'#ffda65');
  updateMapLegend();
  return true;
}
function drawMapPortrait(index,gx,gy,color) {
  const x=gx*TILE,y=gy*TILE;
  fctx.save(); fctx.beginPath(); fctx.arc(x+24,y+24,21,0,Math.PI*2); fctx.clip();
  paintArt(fctx,index,x,y,TILE); fctx.restore();
  fctx.strokeStyle=color; fctx.lineWidth=3;
  fctx.beginPath(); fctx.arc(x+24,y+24,21,0,Math.PI*2); fctx.stroke();
}
function updateMapLegend() {
  let legend=document.getElementById('map-legend');
  if (!legend) {
    legend=document.createElement('p'); legend.id='map-legend';
    legend.style.cssText='color:#e8dfc5;line-height:1.8;margin:10px auto;max-width:720px';
    document.getElementById('field-canvas').insertAdjacentElement('afterend',legend);
  }
  const names={village:'마을',wild:'풀숲',river:'강가'};
  legend.textContent=names[player.mapId]+' · 노란 테두리: 나 · 흰 테두리: 주민/낚시터 · 화살표: 다음 지역\n밝은 길: 안전한 이동 · 풀/강둑: 생물 출현 · 나무/집/물: 이동 불가';
  const hint=document.querySelector('#field-screen .hint');
  if(hint) hint.textContent='방향키 또는 WASD로 이동 · 주민에게 다가가면 대화합니다.';
}
function refreshDexArt() {
  if (!atlasReady) return;
  document.querySelectorAll('#dex-list .dex-card').forEach((card,index) => {
    const species = SPECIES[index];
    if (!species || !dex[species.id]?.met) return;
    const icon = card.querySelector('.icon');
    const artIndex = ART_IDS.indexOf(species.id);
    if (icon && artIndex >= 0 && !icon.querySelector('canvas')) {
      icon.style.cssText = 'width:72px;flex-shrink:0';
      icon.replaceChildren(artCanvas(artIndex,species.name,72));
    }
  });
}
window.addEventListener('DOMContentLoaded', () => {
  new MutationObserver(refreshDexArt).observe(document.getElementById('dex-list'), {childList:true});
});
gameAtlas.onload = () => {
  atlasReady = true;
  document.querySelector('#player-info .sprite').replaceChildren(artCanvas(24,'탐사 대원',96));
  if (typeof player !== 'undefined' && player?.mapId) renderField();
  if (typeof battle !== 'undefined' && battle) renderBattle();
  refreshDexArt();
};
gameAtlas.onerror = () => console.warn('Game artwork unavailable; using original icons.');
gameAtlas.src = 'assets/ecology-atlas-v1.png';
