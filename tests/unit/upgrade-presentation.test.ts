import { describe, expect, it } from 'vitest';
import { PASSIVES } from '../../src/data/passives';
import { WEAPONS } from '../../src/data/weapons';
import type { UpgradeChoice } from '../../src/domain/progression/UpgradeDraft';
import { presentUpgrade } from '../../src/ui/UpgradePresentation';

const visibleLength = (value: string): number => Array.from(value.replace(/\s/g, '')).length;

describe('visual remaster upgrade copy', () => {
  it('keeps ability descriptions short and number-free', () => {
    for (const definition of [...PASSIVES, ...WEAPONS]) {
      expect(definition.description).not.toMatch(/[0-9%+-]/);
      expect(visibleLength(definition.description)).toBeLessThanOrEqual(10);
    }
  });

  it('removes levels and percentages from passive upgrade cards', () => {
    const choice: UpgradeChoice = {
      kind: 'passive',
      id: 'power',
      title: '동력 증폭기 Lv.4',
      description: '피해 +12%',
      icon: '⚔',
      isNew: false
    };

    const presentation = presentUpgrade(choice);
    expect(presentation.title).toBe('⚔ 공격 강해짐');
    expect(presentation.description).toBe('효과가 더 강해짐');
    expect(`${presentation.title}${presentation.description}`).not.toMatch(/[0-9%+-]/);
  });

  it('uses plain-language labels for weapon upgrades and healing', () => {
    const weapon = presentUpgrade({
      kind: 'weapon',
      id: 'pierce_spear',
      title: '관통 창 Lv.3',
      description: '피해·범위·발사 패턴 강화',
      icon: '⇢',
      isNew: false
    });
    const heal = presentUpgrade({
      kind: 'heal',
      id: 'heal',
      title: '응급 수리',
      description: '최대 체력의 35% 회복',
      icon: '✚',
      isNew: false
    });

    expect(weapon).toMatchObject({ title: '긴 자', description: '무기가 더 강해짐' });
    expect(heal).toMatchObject({ title: '체력 회복', description: '체력을 크게 채움' });
    expect(`${weapon.title}${weapon.description}${heal.title}${heal.description}`).not.toMatch(/[0-9%+-]/);
  });
});
