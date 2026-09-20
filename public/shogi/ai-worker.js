importScripts('engine.js');
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, move: Shogi.chooseMove(data.state, data.level) });
  } catch (_) {
    self.postMessage({ id: data.id, error: '컴퓨터 계산을 완료하지 못했습니다.' });
  }
};
