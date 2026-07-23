import type { RandomFn } from '../../core/math/random';

export type MissionType = 'kills' | 'survive' | 'noHit' | 'collect' | 'elite';

export interface ActiveMission {
  type: MissionType;
  title: string;
  description: string;
  progress: number;
  goal: number;
  timeLeftMs: number;
  complete: boolean;
  failed: boolean;
}

export type MissionEvent = 'kill' | 'eliteKill' | 'collect' | 'damaged';

export class MissionService {
  active?: ActiveMission;
  private cooldownMs = 18_000;

  constructor(private readonly random: RandomFn) {}

  update(deltaMs: number, elapsedMs: number): 'started' | 'completed' | 'failed' | undefined {
    if (!this.active) {
      this.cooldownMs -= deltaMs;
      if (this.cooldownMs <= 0) {
        this.active = this.create(elapsedMs);
        return 'started';
      }
      return undefined;
    }
    this.active.timeLeftMs -= deltaMs;
    if (this.active.type === 'survive' || this.active.type === 'noHit') this.active.progress += deltaMs;
    if (this.active.progress >= this.active.goal) {
      this.active.complete = true;
      return 'completed';
    }
    if (this.active.timeLeftMs <= 0) {
      this.active.failed = true;
      return 'failed';
    }
    return undefined;
  }

  record(event: MissionEvent): 'completed' | 'failed' | undefined {
    const mission = this.active;
    if (!mission) return undefined;
    if (event === 'damaged' && mission.type === 'noHit') {
      mission.failed = true;
      return 'failed';
    }
    if (event === 'kill' && mission.type === 'kills') mission.progress += 1;
    if (event === 'eliteKill' && mission.type === 'elite') mission.progress += 1;
    if (event === 'collect' && mission.type === 'collect') mission.progress += 1;
    if (mission.progress >= mission.goal) {
      mission.complete = true;
      return 'completed';
    }
    return undefined;
  }

  resolve(): void {
    this.active = undefined;
    this.cooldownMs = 22_000 + this.random() * 15_000;
  }

  private create(elapsedMs: number): ActiveMission {
    const pool: ActiveMission[] = [
      { type: 'kills', title: '사냥 미션', description: '30초 안에 적 18기 처치', progress: 0, goal: 18, timeLeftMs: 30_000, complete: false, failed: false },
      { type: 'survive', title: '생존 미션', description: '25초 동안 생존', progress: 0, goal: 25_000, timeLeftMs: 25_000, complete: false, failed: false },
      { type: 'noHit', title: '집중 미션', description: '15초 동안 피격되지 않기', progress: 0, goal: 15_000, timeLeftMs: 15_000, complete: false, failed: false },
      { type: 'collect', title: '회수 미션', description: '35초 안에 보석 12개 획득', progress: 0, goal: 12, timeLeftMs: 35_000, complete: false, failed: false }
    ];
    if (elapsedMs > 260_000) pool.push({ type: 'elite', title: '정예 미션', description: '45초 안에 엘리트 처치', progress: 0, goal: 1, timeLeftMs: 45_000, complete: false, failed: false });
    return structuredClone(pool[Math.floor(this.random() * pool.length)]!);
  }
}
