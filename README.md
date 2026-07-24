# 오구서바이벌: 모듈러 아레나

> **이름 안내:** 이 프로젝트의 “오구”는 2026년 학급 공동체의 애칭에서 유래했습니다. 특정 상용 게임·캐릭터 브랜드와 관련이 없으며, 해당 브랜드의 코드나 에셋을 사용하지 않습니다. 자세한 내용은 [이름 및 비제휴 안내](BRAND_NOTICE.md)를 참고하세요.

기존 `sikke12632/59sur`의 자동 공격, 콤보, 미션, 보물상자, 오구 어셈블 흐름을 제품 설계 기준으로 삼아 새로 만든 Phaser 3.90 + TypeScript 서바이버라이크입니다. 기존 단일 HTML과 이미지 파일은 포함하지 않았습니다.

라이브 버전: [https://sikke12632.github.io/ogu-modular-survivors/](https://sikke12632.github.io/ogu-modular-survivors/)

## 현재 구현

- 15분, 45초 단위 20개 웨이브
- 수호자·사수·술사 3개 캐릭터
- 서로 다른 패턴의 무기 12종과 보스 상자 진화
- 보조 능력 8종
- 일반 적 12종, 엘리트 4종, 상태 기반 보스 3종
- 콤보, 30콤보 오구 어셈블, 무작위 미션, 멀리 등장하는 보물상자
- 키보드·마우스/터치, 가상 조이스틱, 반응형 HUD
- v2 체크포인트 자동 저장/이어하기, IndexedDB 장애 대체 저장과 로컬 최고기록
- 설치형 PWA와 오프라인 캐시
- 공간 해시, Phaser Group 풀, 생성 예산, 자동 품질 조절
- Vitest 단위 테스트와 Playwright 브라우저 스모크 테스트

## 실행

Node.js 20 이상과 pnpm 11을 권장합니다.

```bash
pnpm install
pnpm dev
```

프로덕션 빌드:

```bash
pnpm build
pnpm preview
```

테스트:

```bash
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test:e2e`에는 가속된 15분 전체 타임라인, 모바일 터치 조이스틱, PWA 오프라인 재실행 검증이 포함됩니다. 전체 브라우저 검증은 약 1분 정도 걸립니다.

`?dev=1`을 붙이면 웨이브 시간이 약 15배 빨라지고 공격력이 높아져 전체 흐름을 빠르게 확인할 수 있습니다.

## 조작

- 이동: `WASD` 또는 방향키
- 필살기: `Q` 또는 오른쪽 아래 원형 버튼
- 일시정지: `Esc` 또는 오른쪽 위 버튼
- 모바일: 화면 왼쪽 첫 터치 위치에 가상 조이스틱 생성

## 스킨 교체

현재 그래픽은 `BootScene`에서 런타임 생성됩니다. 실제 오구 캐릭터를 붙일 때는 ID를 유지한 채 preload 텍스처를 `player-{characterId}`, `enemy-{enemyId}` 키로 등록하면 전투 코어를 수정할 필요가 없습니다.

## 문서

- [아키텍처](docs/ARCHITECTURE.md)
- [게임 규칙](docs/GAME_RULES.md)
- [밸런스 가이드](docs/BALANCE_GUIDE.md)
- [저장 스키마](docs/SAVE_SCHEMA.md)
- [성능 예산](docs/PERFORMANCE_BUDGET.md)
- [QA 체크리스트](docs/QA_CHECKLIST.md)
- [서드파티 고지](THIRD_PARTY_NOTICES.md)
- [에셋 목록](ASSET_MANIFEST.csv)
