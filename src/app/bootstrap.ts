import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import { gameConfig } from './gameConfig';
import { createOguTestBridge, type OguTestBridge } from './OguTestBridge';

declare global {
  interface Window {
    __OGU_GAME__?: Phaser.Game;
    __OGU_TEST__?: OguTestBridge;
  }
}

export function bootstrap(): Phaser.Game {
  // autoUpdate: 새 버전을 올리면 다음 접속(새로고침)에서 바로 적용된다.
  // 이전 'prompt' 방식은 수락 UI가 없어서 학생들이 구버전에 갇혔었다.
  registerSW({
    immediate: true,
    onOfflineReady() { window.dispatchEvent(new CustomEvent('ogu:offline-ready')); }
  });
  const game = new Phaser.Game(gameConfig);
  window.__OGU_GAME__ = game;
  if (new URLSearchParams(location.search).has('dev')) {
    window.__OGU_TEST__ = createOguTestBridge(game);
  }
  return game;
}
