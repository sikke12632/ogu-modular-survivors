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
  registerSW({
    immediate: false,
    onNeedRefresh() { window.dispatchEvent(new CustomEvent('ogu:update-ready')); },
    onOfflineReady() { window.dispatchEvent(new CustomEvent('ogu:offline-ready')); }
  });
  const game = new Phaser.Game(gameConfig);
  window.__OGU_GAME__ = game;
  if (new URLSearchParams(location.search).has('dev')) {
    window.__OGU_TEST__ = createOguTestBridge(game);
  }
  return game;
}
