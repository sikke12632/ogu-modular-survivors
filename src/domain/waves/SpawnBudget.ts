export interface SpawnBudgetOptions {
  maxActive: number;
  qualityScale: number;
}

export class SpawnBudget {
  private credit = 0;

  update(deltaMs: number, budgetPerSec: number, options: SpawnBudgetOptions): void {
    const cappedDelta = Math.min(250, Math.max(0, deltaMs));
    this.credit = Math.min(
      budgetPerSec * 4,
      this.credit + (cappedDelta / 1000) * budgetPerSec * Math.max(0.4, options.qualityScale)
    );
  }

  canSpend(cost: number, activeCount: number, maxActive: number): boolean {
    return activeCount < maxActive && this.credit >= cost;
  }

  spend(cost: number): boolean {
    if (cost > this.credit) return false;
    this.credit -= cost;
    return true;
  }

  reset(): void { this.credit = 0; }
}
