const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const config = require('./src/config');
const { getActiveApp, captureScreen } = require('./src/capture');
const { judge } = require('./src/brain');

const TEST_RUN = process.argv.includes('--test-run');

let win = null;
let tray = null;
let paused = false;

// 감시 루프 상태
let lastApp = null;
let lastCallAt = 0;
let lastAppChangeCallAt = 0;
let bubbleUntil = 0; // 말풍선이 떠 있는 동안 스크린샷 금지(자기 자신을 찍지 않게)
let history = [];

// 연속 코딩(기지개 이스터에그) 상태
let codingSince = null;
let lastCodingSeenAt = 0;
let nextStretchAt = config.stretchAfterMs;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: config.windowWidth,
    height: config.windowHeight,
    x: width - config.windowWidth - 16,
    y: height - config.windowHeight - 16,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true }); // 클릭이 뒤 창으로 통과
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('👻');
  tray.setToolTip('DeskGhost');
  const rebuild = () => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: paused ? '다시 훔쳐보기' : '잠깐 눈 감기 (일시정지)',
          click: () => {
            paused = !paused;
            tray.setTitle(paused ? '💤' : '👻');
            rebuild();
          },
        },
        { label: '지금 바로 판정하기', click: () => tick(true) },
        { type: 'separator' },
        { label: '성불하기 (종료)', click: () => app.quit() },
      ]),
    );
  };
  rebuild();
}

function showGhost(payload) {
  if (!win) return;
  bubbleUntil = Date.now() + config.bubbleMs;
  win.webContents.send('ghost', payload);
}

function pushHistory(app_, message) {
  const time = new Date().toTimeString().slice(0, 5);
  history.push({ time, app: app_, message });
  if (history.length > config.historySize) history.shift();
}

// 연속 코딩 시간 추적 → 3시간마다 기지개 이스터에그 (API 호출 없이 로컬 판정)
function trackCodingStreak(activeApp, now) {
  const isCoding = config.devApps.includes(activeApp);
  if (isCoding) {
    if (codingSince === null || now - lastCodingSeenAt > config.streakBreakMs) {
      codingSince = now;
      nextStretchAt = config.stretchAfterMs;
    }
    lastCodingSeenAt = now;
    const streak = now - codingSince;
    if (streak >= nextStretchAt) {
      nextStretchAt += config.stretchAfterMs;
      const hours = Math.round(streak / 3_600_000);
      showGhost({
        should_appear: true,
        mood: 'stretch',
        message: `${hours}시간째 코딩 중... 유령도 삭신이 쑤셔요. 기지개 한번 켜시죠.`,
      });
      return true; // 이번 틱은 이걸로 충분
    }
  }
  return false;
}

async function tick(force = false) {
  if (paused && !force) return;
  const now = Date.now();
  if (now < bubbleUntil) return; // 말풍선 떠 있는 동안은 쉬기

  let activeApp;
  try {
    activeApp = await getActiveApp();
  } catch (err) {
    console.warn('[deskghost] 활성 앱 감지 실패(자동화 권한 확인):', err.message);
    return;
  }

  const appChanged = lastApp !== null && activeApp !== lastApp;
  lastApp = activeApp;

  if (trackCodingStreak(activeApp, now)) return;

  // ── 비용 게이트: 언제 OpenAI를 부를까 ──
  // 1) 앱이 바뀌었고 디바운스가 지났으면 즉시
  // 2) 그 외엔 최소 호출 간격이 지났을 때만
  const appChangeTrigger =
    appChanged && now - lastAppChangeCallAt >= config.appChangeDebounceMs;
  const intervalTrigger = now - lastCallAt >= config.minCallIntervalMs;
  if (!force && !appChangeTrigger && !intervalTrigger) return;

  let shot;
  try {
    shot = await captureScreen(config.screenshotWidth);
  } catch (err) {
    console.warn('[deskghost] 스크린샷 실패(화면 기록 권한 확인):', err.message);
    return;
  }

  lastCallAt = now;
  if (appChangeTrigger) lastAppChangeCallAt = now;

  let verdict;
  try {
    verdict = await judge({ imageBase64: shot.base64, activeApp, history });
  } catch (err) {
    console.warn('[deskghost] OpenAI 호출 실패:', err.message);
    if (/api.?key|auth/i.test(err.message)) {
      showGhost({
        should_appear: true,
        mood: 'sigh',
        message: 'OPENAI_API_KEY가 없네요... 유령도 영혼의 양식이 필요해요.',
      });
    }
    return;
  }

  if (!verdict) return;
  pushHistory(activeApp, verdict.should_appear ? verdict.message : '');
  if (verdict.should_appear && verdict.message) {
    console.log(`[deskghost] 👻 (${verdict.mood}) ${verdict.message}`);
    showGhost(verdict);
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide(); // Dock에 안 보이게
  createWindow();
  createTray();

  if (TEST_RUN) {
    // 검증용: 창만 띄워보고 8초 뒤 종료 (감시 루프/권한 요청 없음)
    win.webContents.once('did-finish-load', () => {
      showGhost({ should_appear: true, mood: 'cheer', message: '테스트 부팅 성공! 👻' });
    });
    setTimeout(() => app.quit(), 8000);
    return;
  }

  setInterval(tick, config.tickMs);
  tick(); // 첫 판정은 바로 (권한 요청도 이때 뜸)
});

app.on('window-all-closed', () => app.quit());
