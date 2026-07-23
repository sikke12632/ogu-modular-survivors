import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { GameScene } from '../scenes/GameScene';
import { LevelUpScene } from '../scenes/LevelUpScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { PauseScene } from '../scenes/PauseScene';
import { ResultScene } from '../scenes/ResultScene';
import { TreasureScene } from '../scenes/TreasureScene';
import { UIScene } from '../scenes/UIScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#050b17',
  width: 1280,
  height: 720,
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
    min: { width: 640, height: 360 },
    max: { width: 1920, height: 1080 }
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false }
  },
  render: { powerPreference: 'high-performance' },
  scene: [BootScene, MainMenuScene, GameScene, UIScene, LevelUpScene, TreasureScene, PauseScene, ResultScene]
};
