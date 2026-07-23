# Architecture

## 원칙

데이터가 규칙을 선택하고 화면은 이벤트를 구독합니다. `GameScene`은 런타임 객체와 시스템 호출 순서를 조율하지만, 캐릭터·무기·적·웨이브 수치는 `src/data`에 있습니다.

```text
data definitions
  ├─ WaveDirector → SpawnSystem → pooled enemies
  ├─ UpgradeDraft → LevelUpScene → RunState
  └─ Weapon definitions → WeaponSystem → CombatHost

GameScene
  ├─ InputSystem
  ├─ WeaponSystem
  ├─ SpawnSystem / SpawnBudget
  ├─ MissionService / ComboSystem
  ├─ SpatialHashGrid
  ├─ PerformanceSystem
  └─ EventBus → UIScene

RunState → RunSerializer → SaveAdapter → IndexedDB
RunResult → ScoreGateway → LocalPlatformGateway
```

## 책임 경계

- `src/data`: 수치와 표시 정보. 새 콘텐츠는 먼저 여기에 등록합니다.
- `src/domain`: Phaser를 몰라도 테스트할 수 있는 경험치, 피해, 웨이브, 보상, 저장 규칙입니다.
- `src/systems`: 프레임 업데이트 단위 행동입니다.
- `src/entities`: 풀링되는 Phaser 런타임 객체입니다.
- `src/scenes`: 메뉴, 전투 조율, HUD, 모달과 결과 화면입니다.
- `src/persistence`: 직렬화 가능한 스냅샷만 저장합니다.
- `src/platform`: 로컬 기록과 향후 서버 점수 제출의 경계입니다.

## 콘텐츠 추가

1. 데이터 ID와 표시 정보를 추가합니다.
2. 기존 패턴으로 표현 가능하면 데이터만 조정합니다.
3. 새 행동이 필요할 때만 `WeaponSystem` 또는 적 AI에 패턴 하나를 추가합니다.
4. 순수 규칙은 단위 테스트를 먼저 추가합니다.

Firebase나 다른 서버를 붙일 때는 `LocalPlatformGateway`를 대체하는 구현을 추가하고 게임 코어에는 SDK를 import하지 않습니다.
