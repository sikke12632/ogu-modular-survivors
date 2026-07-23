export class PerformanceSystem {
  quality: 'high' | 'medium' | 'low' = 'high';
  maxEnemies = 230;
  effectsScale = 1;
  private sampleMs = 0;
  private frameCount = 0;
  private lowSamples = 0;
  private highSamples = 0;

  update(deltaMs: number): void {
    this.sampleMs += deltaMs;
    this.frameCount += 1;
    if (this.sampleMs < 2_000) return;
    const fps = this.frameCount / (this.sampleMs / 1000);
    this.lowSamples = fps < 43 ? this.lowSamples + 1 : 0;
    this.highSamples = fps > 55 ? this.highSamples + 1 : 0;
    if (this.lowSamples >= 2 && this.quality !== 'low') this.stepDown();
    else if (this.highSamples >= 4 && this.quality !== 'high') this.stepUp();
    this.sampleMs = 0;
    this.frameCount = 0;
  }

  get qualityScale(): number { return this.quality === 'high' ? 1 : this.quality === 'medium' ? 0.78 : 0.58; }

  private stepDown(): void {
    this.quality = this.quality === 'high' ? 'medium' : 'low';
    this.maxEnemies = this.quality === 'medium' ? 185 : 135;
    this.effectsScale = this.quality === 'medium' ? 0.7 : 0.4;
    this.lowSamples = 0;
  }

  private stepUp(): void {
    this.quality = this.quality === 'low' ? 'medium' : 'high';
    this.maxEnemies = this.quality === 'medium' ? 185 : 230;
    this.effectsScale = this.quality === 'medium' ? 0.7 : 1;
    this.highSamples = 0;
  }
}
