export class ComboSystem {
  count = 0;
  private remainingMs = 0;
  private awardedAssemble = false;

  update(deltaMs: number): void {
    if (this.count === 0) return;
    this.remainingMs -= deltaMs;
    if (this.remainingMs <= 0) this.reset();
  }

  registerKill(): { multiplier: number; assemble: boolean } {
    this.count = Math.min(999, this.count + 1);
    this.remainingMs = 3_500;
    const assemble = this.count >= 30 && !this.awardedAssemble;
    if (assemble) this.awardedAssemble = true;
    return { multiplier: 1 + Math.min(0.5, Math.floor(this.count / 5) * 0.05), assemble };
  }

  reset(): void {
    this.count = 0;
    this.remainingMs = 0;
    this.awardedAssemble = false;
  }
}
