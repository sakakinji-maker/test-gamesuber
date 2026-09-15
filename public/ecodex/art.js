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
  const tiles = {'#':28, H:29, ',':30, '~':31, r:32, '>':33, '<':33, '^':33};
  currentMap().rows.forEach((row, y) => [...row].forEach((tile, x) => {
    paintArt(fctx, tiles[tile] ?? (player.mapId === 'village' ? 35 : 34), x*TILE, y*TILE, TILE);
  }));
  for (const npc of visibleNpcs()) {
    const index = {elder:25,shopkeeper:26,fisher_spot:27}[npc.id];
    if (index !== undefined) paintArt(fctx,index,npc.gx*TILE,npc.gy*TILE,TILE);
  }
  paintArt(fctx,24,player.gx*TILE,player.gy*TILE,TILE);
  fctx.strokeStyle = '#f4d35e';
  fctx.lineWidth = 2;
  fctx.strokeRect(player.gx*TILE+1,player.gy*TILE+1,TILE-2,TILE-2);
  return true;
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
