export interface DamageInput {
  amount: number;
  armor?: number;
  multiplier?: number;
  criticalChance?: number;
  criticalMultiplier?: number;
  random?: () => number;
}

export interface DamageResult {
  amount: number;
  critical: boolean;
}

export function resolveDamage(input: DamageInput): DamageResult {
  const base = Math.max(0, input.amount);
  const armor = Math.max(0, Math.min(0.8, input.armor ?? 0));
  const multiplier = Math.max(0, input.multiplier ?? 1);
  const critical = (input.random ?? Math.random)() < Math.max(0, Math.min(1, input.criticalChance ?? 0));
  const criticalMultiplier = critical ? Math.max(1, input.criticalMultiplier ?? 1.75) : 1;
  return { amount: Math.max(1, base * (1 - armor) * multiplier * criticalMultiplier), critical };
}
