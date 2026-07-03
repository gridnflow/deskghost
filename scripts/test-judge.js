// 지금 화면을 1번 찍어서 유령의 판정을 바로 확인하는 스크립트 (Electron 불필요).
// 사용법: OPENAI_API_KEY가 환경에 있으면: node scripts/test-judge.js
const { captureScreen, getActiveApp } = require('../src/capture');
const { judge } = require('../src/brain');
const config = require('../src/config');

(async () => {
  const activeApp = await getActiveApp();
  const shot = await captureScreen(config.screenshotWidth);
  const kb = Math.round((shot.base64.length * 3) / 4 / 1024);
  console.log(`활성 앱: ${activeApp} / 스크린샷: ${kb}KB (${config.screenshotWidth}px)`);

  const t0 = Date.now();
  const verdict = await judge({ imageBase64: shot.base64, activeApp, history: [] });
  console.log(`판정 완료 (${((Date.now() - t0) / 1000).toFixed(1)}초)`);

  if (!verdict) {
    console.log('👻 (판정 없음 — refusal 또는 빈 응답)');
  } else if (verdict.should_appear) {
    console.log(`👻 등장! (${verdict.mood}) "${verdict.message}"`);
  } else {
    console.log('👻 ...조용히 지켜보는 중 (침묵 판정)');
  }
})().catch((err) => {
  console.error('실패:', err.message);
  process.exit(1);
});
