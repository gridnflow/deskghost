// DeskGhost 설정 — 필요에 따라 자유롭게 조절하세요.
module.exports = {
  // Claude 모델
  model: 'claude-opus-4-8',

  // 가벼운 체크 주기 (활성 앱 이름만 확인, API 호출 없음)
  tickMs: 15_000,

  // Claude 호출 최소 간격 — 이보다 자주 부르지 않음 (비용 게이트)
  minCallIntervalMs: 60_000,

  // 앱 전환으로 인한 즉시 호출의 디바운스 — 창을 휙휙 넘길 때 연타 방지
  appChangeDebounceMs: 20_000,

  // 스크린샷 다운스케일 가로폭(px) — 이미지 토큰 절약
  screenshotWidth: 1280,

  // 말풍선 표시 시간
  bubbleMs: 9_000,

  // 유령 창 크기
  windowWidth: 340,
  windowHeight: 300,

  // "코딩 중"으로 인정하는 앱들 (기지개 이스터에그용)
  devApps: [
    'Code', 'Cursor', 'Terminal', 'iTerm2', 'Warp', 'Ghostty',
    'Xcode', 'IntelliJ IDEA', 'WebStorm', 'PyCharm', 'GoLand', 'Zed',
  ],

  // 연속 코딩 몇 시간이면 기지개를 켤까
  stretchAfterMs: 3 * 60 * 60 * 1000,

  // 코딩 앱에서 벗어난 지 이만큼 지나면 연속 기록 리셋
  streakBreakMs: 5 * 60 * 1000,

  // Claude에게 함께 보내는 직전 관찰 기록 개수 (잔소리 반복 방지)
  historySize: 5,
};
