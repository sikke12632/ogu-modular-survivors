export type EnemyCooldownKey = 'attackCooldownMs' | 'specialCooldownMs' | 'radialCooldownMs';

export interface EnemyCooldownState {
  attackCooldownMs: number;
  specialCooldownMs: number;
  radialCooldownMs: number;
}

export function tickEnemyCooldowns(state: EnemyCooldownState, deltaMs: number): void {
  const elapsed = Math.max(0, deltaMs);
  state.attackCooldownMs -= elapsed;
  state.specialCooldownMs -= elapsed;
  state.radialCooldownMs -= elapsed;
}

export function tryConsumeEnemyCooldown(
  state: EnemyCooldownState,
  key: EnemyCooldownKey,
  durationMs: number
): boolean {
  if (state[key] > 0) return false;
  state[key] = Math.max(0, durationMs);
  return true;
}
