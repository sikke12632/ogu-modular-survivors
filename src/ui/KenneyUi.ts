import Phaser from 'phaser';

export type KenneyTone = 'blue' | 'green' | 'orange' | 'grey';

const TEXT_COLOR: Record<KenneyTone, string> = {
  blue: '#ffffff',
  green: '#ffffff',
  orange: '#4b3217',
  grey: '#ffffff'
};

export function addKenneyPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  tone: KenneyTone = 'blue'
): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(x, y, `ui-panel-${tone}`, undefined, width, height, 28, 28, 20, 20);
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
  const background = scene.add.nineslice(0, 0, `ui-button-${tone}`, undefined, width, height, 28, 28, 20, 20)
    .setName('background');
  const label = scene.add.text(0, -2, labelText, {
    fontFamily: 'system-ui',
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
    .on('pointerover', () => container.setScale(1.025))
    .on('pointerout', () => container.setScale(1))
    .on('pointerup', () => container.setScale(1.025));
  const handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!hitArea.input?.enabled) return;
    if (pointer.x < x - width / 2 || pointer.x > x + width / 2) return;
    if (pointer.y < y - height / 2 || pointer.y > y + height / 2) return;
    container.setScale(0.98);
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
    this.track = scene.add.image(x, y, 'ui-bar-track').setOrigin(0, 0.5).setDisplaySize(width, height);
    this.fill = scene.add.image(x, y, `ui-bar-${tone}`).setOrigin(0, 0.5).setDisplaySize(width, height);
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
