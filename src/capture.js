// macOS 네이티브 명령만 사용 — 외부 의존성 없음.
// screencapture: 스크린샷 / sips: 리사이즈 / osascript: 활성 앱 감지
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SHOT_PATH = path.join(os.tmpdir(), 'deskghost-shot.jpg');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

// 지금 맨 앞에 있는 앱 이름 (예: "Code", "Safari")
// 최초 실행 시 시스템이 자동화(손쉬운 사용) 권한을 물어봅니다.
async function getActiveApp() {
  const script =
    'tell application "System Events" to get name of first application process whose frontmost is true';
  const out = await run('osascript', ['-e', script]);
  return out.trim();
}

// 화면 전체를 찍어 다운스케일한 JPEG의 base64와 해시를 반환.
// 최초 실행 시 시스템이 화면 기록 권한을 물어봅니다.
async function captureScreen(width) {
  await run('screencapture', ['-x', '-t', 'jpg', SHOT_PATH]);
  await run('sips', ['--resampleWidth', String(width), SHOT_PATH]);
  const buf = fs.readFileSync(SHOT_PATH);
  return {
    base64: buf.toString('base64'),
    hash: crypto.createHash('md5').update(buf).digest('hex'),
  };
}

module.exports = { getActiveApp, captureScreen };
