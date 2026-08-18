import Phaser from 'phaser';
import { SCHOOL_FONT } from './SchoolArt';

export type KenneyTone = 'blue' | 'green' | 'orange' | 'grey';

const TEXT_COLOR: Record<KenneyTone, string> = {
  blue: '#4a3423',
  green: '#4a3423',
  orange: '#fff7df',
  grey: '#4a3423'
};

const PANEL_SLICE = 8;

export function addKenneyPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  tone: KenneyTone = 'blue'
): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(
    x,
    y,
    `ui-panel-${tone}`,
    undefined,
    width,
    height,
    PANEL_SLICE,
    PANEL_SLICE,
    PANEL_SLICE,
    PANEL_SLICE
  );
}

export function setKenneyPanelTone(
  panel: Phaser.GameObjects.NineSlice,
  tone: KenneyTone,
  width: number,
  height: number
): Phaser.GameObjects.NineSlice {
  return panel
    .setTexture(`ui-panel-${tone}`)
    .setSlices(width, height, PANEL_SLICE, PANEL_SLICE, PANEL_SLICE, PANEL_SLICE);
}

export function addKenneyButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  labelText: string,
  tone: KenneyTone,
  onClick: (label: Phaser.GameObjects.Text) => void,
  fontSize = 20
): Phaser.GameObjects.Container {
  const background = scene.add.nineslice(
    0,
    0,
    `ui-button-${tone}`,
    undefined,
    width,
    height,
    PANEL_SLICE,
    PANEL_SLICE,
    PANEL_SLICE,
    PANEL_SLICE
  )
    .setName('background');
  const label = scene.add.text(0, -2, labelText, {
    fontFamily: SCHOOL_FONT,
    fontSize: `${fontSize}px`,
    fontStyle: 'bold',
    color: TEXT_COLOR[tone],
    align: 'center'
  }).setOrigin(0.5).setName('label');
  const container = scene.add.container(x, y, [background, label]);
  container.setSize(width, height);
  const hitArea = scene.add.rectangle(x, y, width, height, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
  container.setData('hit-area', hitArea);
  hitArea
    .on('pointerover', () => container.setScale(1.035))
    .on('pointerout', () => container.setScale(1))
    .on('pointerup', () => container.setScale(1.035));
  const handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!hitArea.input?.enabled) return;
    if (pointer.x < x - width / 2 || pointer.x > x + width / 2) return;
    if (pointer.y < y - height / 2 || pointer.y > y + height / 2) return;
    scene.tweens.killTweensOf(container);
    container.setScale(0.94);
    scene.tweens.add({
      targets: container,
      scaleX: 1.035,
      scaleY: 1.035,
      duration: 115,
      ease: 'Back.Out'
    });
    onClick(label);
  };
  scene.input.on('pointerdown', handlePointerDown);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off('pointerdown', handlePointerDown));
  return container;
}

export class KenneyBar {
  readonly track: Phaser.GameObjects.Image;
  readonly fill: Phaser.GameObjects.Image;
  private readonly width: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    tone: Exclude<KenneyTone, 'grey'>
  ) {
    this.width = width;
    this.track = scene.add.image(x, y, 'ui-bar-track')
      .setOrigin(0, 0.5)
      .setDisplaySize(width, height);
    this.fill = scene.add.image(x, y, `ui-bar-${tone}`)
      .setOrigin(0, 0.5)
      .setDisplaySize(width, height)
      .setTint(tone === 'green' ? 0x7ed957 : tone === 'orange' ? 0xffa54f : 0x5fb8ff);
  }

  setValue(ratio: number): this {
    const safe = Phaser.Math.Clamp(ratio, 0, 1);
    this.fill.setCrop(0, 0, this.fill.frame.realWidth * safe, this.fill.frame.realHeight);
    this.fill.setDisplaySize(Math.max(0.01, this.width * safe), this.fill.displayHeight);
    this.fill.setVisible(safe > 0);
    return this;
  }

  setDepth(depth: number): this {
    this.track.setDepth(depth);
    this.fill.setDepth(depth + 0.01);
    return this;
  }
}
