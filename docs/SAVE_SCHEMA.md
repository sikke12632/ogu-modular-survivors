# Save schema

IndexedDB 키: `ogu-modular-active-run`

```ts
interface RunSnapshot {
  schemaVersion: number;
  gameVersion: string;
  savedAt: number;
  runId: string;
  state: RunState;
}
```

`RunState`에는 캐릭터, 경과 시간, 시드, 점수, 처치, 레벨/경험치, 필살기, 무기, 보조 능력, 계산된 플레이어 능력치, 처치한 보스와 활성 보스 축약 상태가 들어갑니다.

Phaser Sprite, Physics Body, Scene, 이벤트 리스너, 오디오 컨텍스트는 저장하지 않습니다. 복구할 때 풀과 물리 객체를 다시 만들고, 저장된 경과 시간에서 웨이브를 재개합니다.

현재 `schemaVersion`은 1입니다. 알 수 없는 버전은 안전하게 거부하며 새 판을 시작할 수 있게 합니다.
