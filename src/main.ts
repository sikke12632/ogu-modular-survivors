import '@fontsource-variable/noto-sans-kr/wght.css';
import '@fontsource/black-han-sans/korean-400.css';
import './style.css';
import { bootstrap } from './app/bootstrap';

async function start(): Promise<void> {
  if (document.fonts) {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 18px "Noto Sans KR Variable"', '오구서바이벌 학교를 지켜라'),
        document.fonts.load('400 32px "Black Han Sans"', '새 능력을 골라요')
      ]),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1_500))
    ]);
  }
  bootstrap();
}

void start();
