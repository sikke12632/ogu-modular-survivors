import Phaser from 'phaser';
import { GAME_VERSION } from '../app/version';
import { sfx } from '../audio/ProceduralSfx';
import { CHARACTERS, type CharacterId } from '../data/characters';
import type { RunSnapshot } from '../domain/run/RunSerializer';
import { saveAdapter } from '../persistence/IndexedDbSaveAdapter';
import { platformGateway } from '../platform/LocalPlatformGateway';
import {
  addKenneyButton,
  addKenneyPanel,
  setKenneyPanelTone,
  type KenneyTone
} from '../ui/KenneyUi';
import { SCHOOL_FONT, SCHOOL_PALETTE } from '../ui/SchoolArt';

export class MainMenuScene extends Phaser.Scene {
  private selectedCharacter: CharacterId = 'guardian';
  private cards: Phaser.GameObjects.Container[] = [];
  private continueButton?: Phaser.GameObjects.Container;
  private snapshot?: RunSnapshot;
  private profileText?: Phaser.GameObjects.Text;

  constructor() { super('MainMenuScene'); }

  create(): void {
    this.cards.length = 0;
    this.continueButton = undefined;
    this.snapshot = undefined;
    this.profileText = undefined;
    this.cameras.main.setBackgroundColor('#78c7e3');
    this.drawBackdrop();

    addKenneyPanel(this, 356, 118, 650, 178, 'orange').setAlpha(0.97);
    this.add.text(64, 44, 'OGU SCHOOL DEFENSE', {
      fontFamily: SCHOOL_FONT, fontSize: '16px', color: '#7a442f', letterSpacing: 3
    });
    this.add.text(64, 66, '오구서바이벌', {
      fontFamily: SCHOOL_FONT, fontSize: '58px', fontStyle: 'bold', color: '#7b3e35',
      stroke: '#fff7df', strokeThickness: 5
    });
    this.add.text(68, 137, '학교를 지켜라!', {
      fontFamily: SCHOOL_FONT, fontSize: '25px', fontStyle: 'bold', color: '#503528'
    });
    this.add.text(68, 172, '연필과 지우개로 낙서 몬스터를 막아요', {
      fontFamily: SCHOOL_FONT, fontSize: '16px', color: '#6f5343'
    });

    this.add.text(64, 241, '누가 학교를 지킬까?', {
      fontFamily: SCHOOL_FONT, fontSize: '22px', fontStyle: 'bold', color: '#29384a',
      stroke: '#fff3cf', strokeThickness: 4
    });
    CHARACTERS.forEach((character, index) => {
      this.cards.push(this.createCharacterCard(character.id, 64 + index * 272, 295));
    });
    this.updateCardSelection();

    this.makeButton(906, 298, 300, 72, '▶  새 게임 시작', 'green', () => {
      sfx.unlock();
      sfx.play('ui');
      void this.startNewRun();
    });
    this.continueButton = this.makeButton(906, 388, 300, 64, '이어하기 확인 중…', 'blue', () => {
      if (!this.snapshot) return;
      sfx.unlock();
      sfx.play('ui');
      this.scene.start('GameScene', { characterId: this.snapshot.state.characterId, snapshot: this.snapshot });
    });
    this.setButtonEnabled(this.continueButton, false);
    this.makeButton(906, 470, 300, 58, '♪  소리 켜기 / 끄기', 'orange', () => {
      sfx.unlock();
      sfx.enabled = !sfx.enabled;
      localStorage.setItem('ogu-sound', sfx.enabled ? 'on' : 'off');
      this.showToast(sfx.enabled ? '소리를 켰습니다.' : '소리를 껐습니다.');
    });

    addKenneyPanel(this, 1_056, 590, 324, 134, 'blue').setAlpha(0.9);
    this.profileText = this.add.text(920, 548, '로컬 기록을 불러오는 중…', {
      fontFamily: SCHOOL_FONT, fontSize: '15px', fontStyle: 'bold', color: '#263849', lineSpacing: 7
    });
    this.add.text(64, 675, `v${GAME_VERSION} · WASD/방향키 이동 · Q 필살기 · ESC 일시정지 · 모바일 가상 조이스틱`, {
      fontFamily: SCHOOL_FONT, fontSize: '14px', color: '#4d5a62',
      backgroundColor: '#fff0c5', padding: { x: 10, y: 5 }
    });

    this.input.once('pointerdown', () => sfx.unlock());
    void this.refreshLocalData();
    window.addEventListener('ogu:offline-ready', this.onOfflineReady, { once: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  private async refreshLocalData(): Promise<void> {
    const [snapshotResult, profileResult] = await Promise.allSettled([saveAdapter.loadRun(), platformGateway.loadProfile()]);
    if (!this.sys.isActive()) return;
    const snapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value : undefined;
    this.snapshot = snapshot;
    if (this.continueButton) {
      const label = this.continueButton.getByName('label') as Phaser.GameObjects.Text;
      label.setText(snapshot ? `이어하기 · 레벨 ${snapshot.state.level}` : '저장된 판 없음');
      this.setButtonEnabled(this.continueButton, Boolean(snapshot));
    }
    if (profileResult.status === 'fulfilled') {
      const profile = profileResult.value;
      this.profileText?.setText([
        `최고 점수  ${profile.bestScore.toLocaleString()}`,
        `최장 생존  ${this.formatTime(profile.bestTimeMs)}`,
        `도전 ${profile.totalRuns}회 · 승리 ${profile.victories}회`,
        '기록은 이 기기에 저장됩니다.'
      ]);
    } else {
      this.profileText?.setText('로컬 기록을 불러오지 못했습니다.');
    }
    if (snapshotResult.status === 'rejected') this.showToast('저장된 게임을 불러오지 못했습니다.');
  }

  private async startNewRun(): Promise<void> {
    try {
      await saveAdapter.clearRun();
    } catch {
      this.showToast('기존 저장 데이터를 지우지 못했습니다.');
      return;
    }
    this.scene.start('GameScene', { characterId: this.selectedCharacter });
  }

  private createCharacterCard(id: CharacterId, x: number, y: number): Phaser.GameObjects.Container {
    const definition = CHARACTERS.find((character) => character.id === id)!;
    const background = addKenneyPanel(this, 0, 0, 248, 318, 'blue');
    const slot = this.add.image(0, -82, 'ui-slot-green').setDisplaySize(96, 96);
    const portrait = this.add.sprite(0, -84, `player-${id}`, 0).setDisplaySize(96, 96);
    portrait.play(`player-${id}-walk-down`);
    const selected = this.add.text(0, -143, '선택됨', {
      fontFamily: SCHOOL_FONT, fontSize: '13px', fontStyle: 'bold', color: '#4b3217'
    }).setOrigin(0.5).setName('selected');
    const title = this.add.text(0, -14, definition.name, {
      fontFamily: SCHOOL_FONT, fontSize: '25px', fontStyle: 'bold', color: '#263849'
    }).setOrigin(0.5);
    const subtitle = this.add.text(0, 20, definition.subtitle, {
      fontFamily: SCHOOL_FONT, fontSize: '13px', fontStyle: 'bold', color: '#2b6887'
    }).setOrigin(0.5);
    const description = this.add.text(0, 67, definition.description, {
      fontFamily: SCHOOL_FONT, fontSize: '16px', fontStyle: 'bold', color: '#34495e',
      align: 'center', wordWrap: { width: 202 }
    }).setOrigin(0.5);
    const hpDots = Math.round(definition.maxHp / 50);
    const speedDots = Math.round(definition.moveSpeed / 85);
    const stats = this.add.text(0, 122, `♥ ${'●'.repeat(hpDots)}  ➤ ${'●'.repeat(speedDots)}`, {
      fontFamily: SCHOOL_FONT, fontSize: '14px', fontStyle: 'bold', color: '#31596d'
    }).setOrigin(0.5);
    const container = this.add.container(x + 124, y + 159, [
      background, slot, portrait, selected, title, subtitle, description, stats
    ]);
    container.setSize(248, 318).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.selectedCharacter = id;
      sfx.play('ui');
      this.updateCardSelection();
    });
    container.setData('id', id);
    return container;
  }

  private updateCardSelection(): void {
    for (const card of this.cards) {
      const selected = card.getData('id') === this.selectedCharacter;
      const background = card.list[0] as Phaser.GameObjects.NineSlice;
      setKenneyPanelTone(background, selected ? 'orange' : 'blue', 248, 318);
      (card.getByName('selected') as Phaser.GameObjects.Text).setVisible(selected);
      card.setScale(selected ? 1.035 : 1);
    }
  }

  private makeButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    tone: KenneyTone,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    return addKenneyButton(
      this,
      x + width / 2,
      y + height / 2,
      width,
      height,
      label,
      tone,
      onClick,
      height > 60 ? 22 : 17
    );
  }

  private setButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
    button.setAlpha(enabled ? 1 : 0.45);
    const hitArea = button.getData('hit-area') as Phaser.GameObjects.Rectangle;
    if (enabled) hitArea.setInteractive({ useHandCursor: true });
    else hitArea.disableInteractive();
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics().setDepth(-1);
    graphics.fillStyle(SCHOOL_PALETTE.sky).fillRect(0, 0, 1_280, 310);
    graphics.fillStyle(SCHOOL_PALETTE.cloud, 0.9)
      .fillCircle(140, 72, 34).fillCircle(178, 62, 46).fillCircle(220, 76, 31)
      .fillCircle(690, 54, 28).fillCircle(724, 44, 39).fillCircle(762, 59, 27);
    this.add.tileSprite(640, 515, 1_280, 410, 'school-ground-speckle')
      .setTileScale(3.5)
      .setTint(0xf1bd80)
      .setDepth(-2);
    graphics.lineStyle(5, SCHOOL_PALETTE.chalk, 0.68).strokeRoundedRect(42, 322, 820, 330, 18);
    graphics.lineStyle(3, SCHOOL_PALETTE.blue, 0.42).lineBetween(452, 322, 452, 652);

    this.add.image(1_045, 151, 'school-building').setDisplaySize(455, 348).setDepth(-0.5);
    this.add.rectangle(1_045, 52, 190, 50, 0xffedc2, 0.98)
      .setStrokeStyle(4, 0x7b3e35)
      .setDepth(0.2);
    this.add.text(1_045, 72, '오 구 초 등 학 교', {
      fontFamily: SCHOOL_FONT,
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#7b3e35'
    }).setOrigin(0.5).setY(52).setDepth(0.3);
  }

  private showToast(message: string): void {
    const toast = this.add.text(1_054, 666, message, {
      fontFamily: SCHOOL_FONT, fontSize: '15px', color: '#29384a',
      backgroundColor: '#ffedc2', padding: { x: 14, y: 9 }
    }).setOrigin(0.5);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: 650,
      delay: 900,
      duration: 400,
      onComplete: () => toast.destroy()
    });
  }

  private onOfflineReady = (): void => { this.showToast('오프라인 플레이 준비 완료'); };

  private onShutdown(): void {
    window.removeEventListener('ogu:offline-ready', this.onOfflineReady);
    this.cards.length = 0;
    this.continueButton = undefined;
    this.profileText = undefined;
  }

  private formatTime(ms: number): string {
    const total = Math.floor(ms / 1_000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }
}
