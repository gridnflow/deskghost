const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');

// .env 로더 (의존성 없음) — Finder/launchd 경유 실행 시 셸 환경변수가 없으므로
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // .env 없으면 셸 환경변수 그대로 사용
}

// 로그를 파일에도 남김 — GUI로 실행하면 터미널이 없으므로
const LOG_PATH = path.join(__dirname, 'deskghost.log');
function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  try { fs.appendFileSync(LOG_PATH, msg + '\n'); } catch {}
}
const { getActiveApp, captureScreen } = require('./src/capture');
const { judge } = require('./src/brain');
const { t, getLanguage, setLanguage } = require('./src/i18n');

const TEST_RUN = process.argv.includes('--test-run');

let win = null;
let tray = null;
let paused = false;

// 감시 루프 상태
let lastApp = null;
let lastCallAt = 0;
let lastAppChangeCallAt = 0;
let bubbleUntil = 0; // 말풍선이 떠 있는 동안 스크린샷 금지(자기 자신을 찍지 않게)
let cooldownUntil = 0; // 등장 후 쿨다운 — 잔소리 스팸 방지
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
  // assets/tray.png(18px) + tray@2x.png(36px) — 레티나 자동 선택
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png')));
  tray.setToolTip('DeskGhost');
  const rebuild = () => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: paused ? t('trayResume') : t('trayPause'),
          click: () => {
            paused = !paused;
            tray.setTitle(paused ? '💤' : ''); // 아이콘 옆에 잠듦 표시만
            rebuild();
          },
        },
        { label: t('trayJudge'), click: () => tick(true) },
        {
          label: t('trayLanguage'),
          submenu: [
            {
              label: '한국어',
              type: 'radio',
              checked: getLanguage() === 'ko',
              click: () => { setLanguage('ko'); rebuild(); },
            },
            {
              label: 'English',
              type: 'radio',
              checked: getLanguage() === 'en',
              click: () => { setLanguage('en'); rebuild(); },
            },
          ],
        },
        { type: 'separator' },
        { label: t('trayQuit'), click: () => app.quit() },
      ]),
    );
  };
  rebuild();
}

// 유령이 말도 함 — macOS 내장 TTS (비용 0)
function speak(message) {
  if (config.voice === false || !message) return;
  const voice = config.voice || t('voice'); // null이면 언어별 기본 음성
  execFile('say', ['-v', voice, message], (err) => {
    if (err) log(`TTS 실패: ${err.message}`);
  });
}

function showGhost(payload) {
  if (!win) return;
  bubbleUntil = Date.now() + config.bubbleMs;
  cooldownUntil = Date.now() + config.cooldownAfterAppearMs;
  win.webContents.send('ghost', payload);
  speak(payload.message);
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
        message: t('stretch', hours),
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
  if (!force && now < cooldownUntil) return; // 등장 직후 쿨다운 — 판정도 쉼 (비용 절약)

  let activeApp;
  try {
    activeApp = await getActiveApp();
  } catch (err) {
    log(`활성 앱 감지 실패(자동화 권한 확인): ${err.message}`);
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
    log(`스크린샷 실패(화면 기록 권한 확인): ${err.message}`);
    return;
  }

  lastCallAt = now;
  if (appChangeTrigger) lastAppChangeCallAt = now;

  let verdict;
  try {
    verdict = await judge({ imageBase64: shot.base64, activeApp, history });
  } catch (err) {
    log(`OpenAI 호출 실패: ${err.message}`);
    if (/api.?key|auth/i.test(err.message)) {
      showGhost({
        should_appear: true,
        mood: 'sigh',
        message: t('noApiKey'),
      });
    }
    return;
  }

  if (!verdict) return;
  pushHistory(activeApp, verdict.should_appear ? verdict.message : '');
  if (verdict.should_appear && verdict.message) {
    log(`👻 (${verdict.mood}) ${verdict.message}`);
    showGhost(verdict);
  } else {
    log(`... 침묵 판정 (활성 앱: ${activeApp})`);
  }
}

app.whenReady().then(() => {
  // Dock에 유령 아이콘 표시 (개발 실행 시에도 기본 Electron 아이콘 대신)
  if (process.platform === 'darwin') {
    app.dock?.setIcon(nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')));
  }
  createWindow();
  createTray();

  if (TEST_RUN) {
    // 검증용: 창만 띄워보고 8초 뒤 종료 (감시 루프/권한 요청 없음)
    win.webContents.once('did-finish-load', () => {
      showGhost({ should_appear: true, mood: 'cheer', message: t('testBoot') });
    });
    setTimeout(() => app.quit(), 8000);
    return;
  }

  setInterval(tick, config.tickMs);
  tick(); // 첫 판정은 바로 (권한 요청도 이때 뜸)
});

app.on('window-all-closed', () => app.quit());
