import Phaser from 'phaser';

export const VFX_COLORS = {
  heal: 0x55e879,
  fire: 0xff554d,
  ice: 0x58b9ff,
  lightning: 0xffdd45,
  blue: 0x55cfff,
  orange: 0xffa13d
} as const;

export type VisualEffectKind =
  | 'hit'
  | 'critical'
  | 'death'
  | 'level-up'
  | 'boss'
  | 'ultimate'
  | 'pickup'
  | 'mission';

interface EffectStyle {
  texture: string;
  size: number;
  duration: number;
  startScale: number;
  endScale: number;
  alpha: number;
}

const EFFECT_STYLES: Record<VisualEffectKind, EffectStyle> = {
  hit: { texture: 'vfx-burst', size: 54, duration: 170, startScale: 0.15, endScale: 0.7, alpha: 0.86 },
  critical: { texture: 'vfx-critical', size: 130, duration: 300, startScale: 0.35, endScale: 1.05, alpha: 1 },
  death: { texture: 'vfx-burst', size: 110, duration: 310, startScale: 0.3, endScale: 1.2, alpha: 0.9 },
  'level-up': { texture: 'vfx-ring', size: 210, duration: 520, startScale: 0.2, endScale: 1.25, alpha: 0.9 },
  boss: { texture: 'vfx-ring', size: 360, duration: 850, startScale: 0.25, endScale: 1.45, alpha: 1 },
  ultimate: { texture: 'vfx-ring', size: 430, duration: 700, startScale: 0.18, endScale: 1.55, alpha: 1 },
  pickup: { texture: 'vfx-glint', size: 76, duration: 260, startScale: 0.25, endScale: 1, alpha: 0.9 },
  mission: { texture: 'vfx-glint', size: 190, duration: 620, startScale: 0.2, endScale: 1.35, alpha: 1 }
};

export function playVisualEffect(
  scene: Phaser.Scene,
  kind: VisualEffectKind,
  x: number,
  y: number,
  color: number
): Phaser.GameObjects.Image {
  const style = EFFECT_STYLES[kind];
  const image = scene.add.image(x, y, style.texture)
    .setDisplaySize(style.size, style.size)
    .setScale(style.startScale)
    .setTint(color)
    .setAlpha(style.alpha)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(35);
  scene.tweens.add({
    targets: image,
    scale: style.endScale,
    alpha: 0,
    angle: kind === 'critical' ? 12 : 32,
    duration: style.duration,
    ease: 'Cubic.easeOut',
    onComplete: () => image.destroy()
  });
  return image;
}
