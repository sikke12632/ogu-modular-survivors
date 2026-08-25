import Phaser from 'phaser';
import { sfx } from './ProceduralSfx';

// 배경음악 관리자. 소리 켜기/끄기 버튼(sfx.enabled)을 그대로 따른다.
// 브라우저 자동재생 정책 때문에 첫 입력 전에는 오디오가 잠겨 있으므로,
// 잠긴 상태에서 play가 불리면 unlocked 이벤트에서 재생을 시작한다.
class Bgm {
  private current?: Phaser.Sound.BaseSound;
  private key?: string;

  play(scene: Phaser.Scene, key: string, volume = 0.24): void {
    if (this.key === key && this.current?.isPlaying) return;
    this.stop();
    if (!scene.cache.audio.exists(key)) return;
    this.current = scene.sound.add(key, { loop: true, volume });
    this.key = key;
    if (!sfx.enabled) return;
    if (scene.sound.locked) {
      scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        if (this.key === key && sfx.enabled) this.current?.play();
      });
    } else {
      this.current.play();
    }
  }

  /** 소리 토글 후 호출: 현재 곡을 켜거나 끈다. */
  applyEnabled(): void {
    if (!this.current) return;
    if (sfx.enabled) {
      if (!this.current.isPlaying) this.current.play();
    } else if (this.current.isPlaying) {
      this.current.stop();
    }
  }

  stop(): void {
    this.current?.stop();
    this.current?.destroy();
    this.current = undefined;
    this.key = undefined;
  }
}

export const bgm = new Bgm();
