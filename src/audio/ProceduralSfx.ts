export type SfxName = 'shoot' | 'hit' | 'hurt' | 'level' | 'boss' | 'ultimate' | 'treasure' | 'ui';

const NOTES: Record<SfxName, [number, number, OscillatorType]> = {
  shoot: [420, 0.035, 'square'], hit: [180, 0.045, 'triangle'], hurt: [95, 0.12, 'sawtooth'],
  level: [660, 0.2, 'sine'], boss: [72, 0.35, 'sawtooth'], ultimate: [120, 0.42, 'square'],
  treasure: [880, 0.24, 'sine'], ui: [520, 0.06, 'triangle']
};

export class ProceduralSfx {
  private context?: AudioContext;
  private lastPlayed = new Map<SfxName, number>();
  enabled = localStorage.getItem('ogu-sound') !== 'off';

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
  }

  play(name: SfxName, volume = 0.06): void {
    if (!this.enabled || !this.context) return;
    const nowMs = performance.now();
    const cooldown = name === 'shoot' ? 80 : name === 'hit' ? 55 : 20;
    if (nowMs - (this.lastPlayed.get(name) ?? 0) < cooldown) return;
    this.lastPlayed.set(name, nowMs);
    const [frequency, duration, type] = NOTES[name];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency * (0.96 + Math.random() * 0.08), this.context.currentTime);
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }
}

export const sfx = new ProceduralSfx();
