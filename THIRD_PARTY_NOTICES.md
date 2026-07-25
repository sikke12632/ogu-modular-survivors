# Third-party notices

This project was authored as a new modular implementation. No image, audio, or source file from `sikke12632/59sur` is included; its gameplay rules were used as product-design reference only.

The production bundle and offline service worker include the following open-source components. The complete copyright notices and license texts are shipped with the site at [`public/THIRD_PARTY_LICENSES.txt`](public/THIRD_PARTY_LICENSES.txt).

The visual remaster also includes selected or composited image files from
JIK-A-4's MetroCity character and external environment packs, plus Kenney UI
Pack - Pixel Adventure, Tiny Dungeon 1.0, and Particle Pack 1.1. All five
packs are released under CC0 1.0. Exact file groups and source pages are
listed in [`ASSET_CREDITS.md`](ASSET_CREDITS.md) and
[`ASSET_MANIFEST.csv`](ASSET_MANIFEST.csv).

| Component | Version | License | Source |
|---|---:|---|---|
| Phaser | 3.90.0 | MIT | https://github.com/phaserjs/phaser |
| EventEmitter3 | 5.0.4 | MIT | https://github.com/primus/eventemitter3 |
| Matter.js (bundled by Phaser) | Phaser 3.90.0 copy | MIT | https://github.com/liabru/matter-js |
| poly-decomp.js (bundled by Phaser) | 0.3.0 | MIT | https://github.com/schteppe/poly-decomp.js |
| idb-keyval | 6.2.2 | Apache-2.0 | https://github.com/jakearchibald/idb-keyval |
| Workbox | 7.3.0 | MIT | https://github.com/GoogleChrome/workbox |

Development and build dependencies are not copied into the published site:

| Package | Version | License | Source |
|---|---:|---|---|
| TypeScript | 5.8.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| Vite | 7.0.6 | MIT | https://github.com/vitejs/vite |
| vite-plugin-pwa | 1.0.2 | MIT | https://github.com/vite-pwa/vite-plugin-pwa |
| Vitest | 3.2.4 | MIT | https://github.com/vitest-dev/vitest |
| Playwright | 1.54.1 | Apache-2.0 | https://github.com/microsoft/playwright |

The installed dependency graph was reviewed before public release. Its declared licenses are permissive (MIT, Apache-2.0, BSD, ISC, BlueOak, CC0, or CC-BY for build-time browser-compatibility data). No GPL, AGPL, proprietary game asset, downloaded font, music, or sound sample is included in the repository or production bundle.
