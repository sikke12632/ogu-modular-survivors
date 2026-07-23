import Phaser from 'phaser';

export const eventBus = new Phaser.Events.EventEmitter();

export const GameEvents = {
  hud: 'run:hud',
  message: 'run:message',
  mission: 'run:mission',
  boss: 'run:boss',
  joystick: 'input:joystick',
  runEnded: 'run:ended'
} as const;

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  xp: number;
  xpNext: number;
  level: number;
  elapsedMs: number;
  score: number;
  combo: number;
  ultimate: number;
  ultimateMax: number;
  weapons: Array<{ name: string; level: number; evolved: boolean }>;
  mission?: { title: string; progress: number; goal: number; timeLeftMs: number };
  boss?: { name: string; hp: number; maxHp: number; phase: number };
  fps: number;
  enemies: number;
  quality: 'high' | 'medium' | 'low';
}
