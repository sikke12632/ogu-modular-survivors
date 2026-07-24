import type Phaser from 'phaser';
import type { RunResult } from '../platform/LocalPlatformGateway';
import type { GameScene } from '../scenes/GameScene';
import type { ResultScene } from '../scenes/ResultScene';

export interface OguTestBridge {
  startRunAutomation(): void;
  stopRunAutomation(): void;
  getRunResult(): Readonly<RunResult> | undefined;
}

export function createOguTestBridge(game: Phaser.Game): OguTestBridge {
  let automationTimer: number | undefined;

  const stopRunAutomation = (): void => {
    if (automationTimer === undefined) return;
    window.clearInterval(automationTimer);
    automationTimer = undefined;
  };

  return {
    startRunAutomation(): void {
      stopRunAutomation();
      automationTimer = window.setInterval(() => {
        if (game.scene.isActive('ResultScene')) {
          stopRunAutomation();
          return;
        }
        if (!game.scene.isActive('GameScene') && !game.scene.isPaused('GameScene')) return;
        (game.scene.getScene('GameScene') as GameScene).runQaAutomationStep();
      }, 50);
    },
    stopRunAutomation,
    getRunResult(): Readonly<RunResult> | undefined {
      if (!game.scene.isActive('ResultScene')) return undefined;
      return (game.scene.getScene('ResultScene') as ResultScene).getRunResult();
    }
  };
}
