import Phaser from 'phaser';
import { CHARACTERS, type CharacterId } from '../data/characters';
import type { RunSnapshot } from '../domain/run/RunSerializer';
import { saveAdapter } from '../persistence/IndexedDbSaveAdapter';
import { platformGateway } from '../platform/LocalPlatformGateway';
import { sfx } from '../audio/ProceduralSfx';
import { GAME_VERSION } from '../app/version';

export class MainMenuScene extends Phaser.Scene {
  private selectedCharacter: CharacterId = 'guardian';
  private cards: Phaser.GameObjects.Container[] = [];
  private continueButton?: Phaser.GameObjects.Container;
  private snapshot?: RunSnapshot;
  private profileText?: Phaser.GameObjects.Text;

  constructor() { super('MainMenuScene'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#040b18');
    this.drawBackdrop();
    this.add.text(64, 46, 'OGU // MODULAR ARENA', { fontFamily: 'system-ui', fontSize: '18px', color: '#74efff', letterSpacing: 4 }).setAlpha(0.8);
    this.add.text(64, 78, '오구서바이벌', { fontFamily: 'system-ui', fontSize: '58px', fontStyle: 'bold', color: '#f4fbff', stroke: '#127c99', strokeThickness: 3 });
    this.add.text(68, 146, '조립식 게임 엔진 프로토타입', { fontFamily: 'system-ui', fontSize: '24px', color: '#b5c7e8' });
    this.add.text(68, 191, '15분 · 20 웨이브 · 12 무기 · 3 보스', { fontFamily: 'system-ui', fontSize: '17px', color: '#73f0a7' });

    this.add.text(64, 253, '캐릭터 선택', { fontFamily: 'system-ui', fontSize: '22px', fontStyle: 'bold', color: '#ffffff' });
    CHARACTERS.forEach((character, index) => this.cards.push(this.createCharacterCard(character.id, 64 + index * 272, 295)));

    this.makeButton(906, 312, 300, 72, '새 게임 시작', 0x176f7e, () => {
      sfx.unlock(); sfx.play('ui');
      void saveAdapter.clearRun();
      this.scene.start('GameScene', { characterId: this.selectedCharacter });
    });
    this.continueButton = this.makeButton(906, 402, 300, 64, '이어하기 확인 중…', 0x44367c, () => {
      if (!this.snapshot) return;
      sfx.unlock(); sfx.play('ui');
      this.scene.start('GameScene', { characterId: this.snapshot.state.characterId, snapshot: this.snapshot });
    });
    this.setButtonEnabled(this.continueButton, false);

    this.makeButton(906, 484, 300, 54, '소리 켜기 / 끄기', 0x233452, () => {
      sfx.unlock();
      sfx.enabled = !sfx.enabled;
      localStorage.setItem('ogu-sound', sfx.enabled ? 'on' : 'off');
      this.showToast(sfx.enabled ? '소리를 켰습니다.' : '소리를 껐습니다.');
    });
    this.profileText = this.add.text(906, 566, '로컬 기록을 불러오는 중…', { fontFamily: 'system-ui', fontSize: '16px', color: '#a9bddf', lineSpacing: 8 });
    this.add.text(64, 675, `v${GAME_VERSION} · WASD/방향키 이동 · Q 필살기 · ESC 일시정지 · 모바일 가상 조이스틱`, { fontFamily: 'system-ui', fontSize: '14px', color: '#6680a7' });

    this.input.once('pointerdown', () => sfx.unlock());
    void this.refreshLocalData();
    window.addEventListener('ogu:offline-ready', this.onOfflineReady, { once: true });
  }

  private async refreshLocalData(): Promise<void> {
    const [snapshot, profile] = await Promise.all([saveAdapter.loadRun(), platformGateway.loadProfile()]);
    this.snapshot = snapshot;
    if (this.continueButton) {
      const label = this.continueButton.getByName('label') as Phaser.GameObjects.Text;
      label.setText(snapshot ? `이어하기 · Lv.${snapshot.state.level}` : '저장된 판 없음');
      this.setButtonEnabled(this.continueButton, Boolean(snapshot));
    }
    this.profileText?.setText([
      `최고 점수  ${profile.bestScore.toLocaleString()}`,
      `최장 생존  ${this.formatTime(profile.bestTimeMs)}`,
      `도전 ${profile.totalRuns}회 · 승리 ${profile.victories}회`,
      '기록은 이 기기의 IndexedDB에 저장됩니다.'
    ]);
  }

  private createCharacterCard(id: CharacterId, x: number, y: number): Phaser.GameObjects.Container {
    const definition = CHARACTERS.find((character) => character.id === id)!;
    const background = this.add.rectangle(0, 0, 248, 318, 0x0b1729, 0.94).setStrokeStyle(2, 0x294365);
    const portrait = this.add.image(0, -82, `player-${id}`).setScale(1.5);
    const title = this.add.text(0, -14, definition.name, { fontFamily: 'system-ui', fontSize: '25px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const subtitle = this.add.text(0, 20, definition.subtitle, { fontFamily: 'system-ui', fontSize: '14px', color: '#7ceeff' }).setOrigin(0.5);
    const description = this.add.text(0, 67, definition.description, { fontFamily: 'system-ui', fontSize: '14px', color: '#b9c8df', align: 'center', wordWrap: { width: 202 } }).setOrigin(0.5);
    const stats = this.add.text(0, 126, `HP ${definition.maxHp} · 속도 ${definition.moveSpeed}`, { fontFamily: 'system-ui', fontSize: '13px', color: '#72f2a2' }).setOrigin(0.5);
    const container = this.add.container(x + 124, y + 159, [background, portrait, title, subtitle, description, stats]);
    container.setSize(248, 318).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.selectedCharacter = id;
      sfx.play('ui');
      this.updateCardSelection();
    });
    container.setData('id', id);
    this.updateCardSelection();
    return container;
  }

  private updateCardSelection(): void {
    for (const card of this.cards) {
      const selected = card.getData('id') === this.selectedCharacter;
      const background = card.list[0] as Phaser.GameObjects.Rectangle;
      background.setStrokeStyle(selected ? 4 : 2, selected ? 0x47f0ff : 0x294365).setFillStyle(selected ? 0x102b3b : 0x0b1729, 0.96);
      card.setScale(selected ? 1.02 : 1);
    }
  }

  private makeButton(x: number, y: number, width: number, height: number, label: string, color: number, onClick: () => void): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, width, height, color, 0.96).setStrokeStyle(2, 0x8df7ff, 0.7);
    const text = this.add.text(0, 0, label, { fontFamily: 'system-ui', fontSize: height > 60 ? '23px' : '17px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setName('label');
    const container = this.add.container(x + width / 2, y + height / 2, [background, text]);
    container.setSize(width, height).setInteractive({ useHandCursor: true }).on('pointerover', () => background.setAlpha(0.82)).on('pointerout', () => background.setAlpha(1)).on('pointerdown', onClick);
    return container;
  }

  private setButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
    button.setAlpha(enabled ? 1 : 0.45);
    if (enabled) button.setInteractive({ useHandCursor: true });
    else button.disableInteractive();
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1b4267, 0.32);
    for (let x = 0; x <= 1280; x += 64) graphics.lineBetween(x, 0, x, 720);
    for (let y = 0; y <= 720; y += 64) graphics.lineBetween(0, y, 1280, y);
    graphics.fillStyle(0x00d9ff, 0.08).fillCircle(1050, 120, 300);
    graphics.fillStyle(0x974dff, 0.08).fillCircle(950, 620, 260);
  }

  private showToast(message: string): void {
    const toast = this.add.text(1054, 630, message, { fontFamily: 'system-ui', fontSize: '15px', color: '#ffffff', backgroundColor: '#112842', padding: { x: 14, y: 9 } }).setOrigin(0.5);
    this.tweens.add({ targets: toast, alpha: 0, y: 614, delay: 900, duration: 400, onComplete: () => toast.destroy() });
  }

  private onOfflineReady = (): void => { this.showToast('오프라인 플레이 준비 완료'); };

  private formatTime(ms: number): string {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
}
